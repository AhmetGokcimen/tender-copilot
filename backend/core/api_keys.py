"""API keys: create, look up, revoke, and meter.

A key looks like `ofk_<43 url-safe chars>` (256 bits). Only its SHA-256 is
stored. `authenticate` is the one place a presented key turns into a user; it
rejects unknown, revoked and expired keys with the same 401 so a caller cannot
probe which keys exist.

Two limits apply to every call: a per-key burst limit kept in memory (cheap,
per serverless instance, so best effort) and the plan's daily quota counted in
the database (exact, shared by all instances).
"""

import hashlib
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from backend.core.membership import resolve_user_company
from backend.core.plans import API_MAX_KEYS, api_daily_limit, user_plan
from backend.db import get_session
from backend.models.api_key import ApiKey, ApiKeyUsage
from backend.models.company import CompanyProfile
from backend.models.user import User

KEY_PREFIX = "ofk_"
BURST_LIMIT = 60  # calls per key per BURST_WINDOW seconds
BURST_WINDOW = 60

_bearer = HTTPBearer(auto_error=False)
_burst: dict[int, deque[float]] = defaultdict(deque)
_burst_lock = threading.Lock()


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def active_keys(session: Session, user_id: int) -> list[ApiKey]:
    now = _utcnow()
    keys = session.exec(
        select(ApiKey).where(ApiKey.user_id == user_id, ApiKey.revoked_at == None)
        .order_by(ApiKey.id)
    ).all()
    return [k for k in keys if k.expires_at is None or _aware(k.expires_at) > now]


def create_key(
    session: Session, user: User, *, name: str, company_id: int | None, expires_in_days: int | None
) -> tuple[ApiKey, str]:
    """Returns the stored row and the raw key (the only time it exists in
    the clear). 409 when the user already holds the maximum."""
    name = name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Give the key a name")
    if len(active_keys(session, user.id)) >= API_MAX_KEYS:
        raise HTTPException(
            status_code=409, detail=f"At most {API_MAX_KEYS} active keys — revoke one first"
        )
    if company_id is not None:
        resolve_user_company(session, user, company_id)  # 404/403 for strangers' companies
    raw = KEY_PREFIX + secrets.token_urlsafe(32)
    key = ApiKey(
        user_id=user.id,
        name=name[:80],
        prefix=raw[: len(KEY_PREFIX) + 6],
        key_hash=hash_key(raw),
        company_id=company_id,
        expires_at=_utcnow() + timedelta(days=expires_in_days) if expires_in_days else None,
    )
    session.add(key)
    session.commit()
    session.refresh(key)
    return key, raw


def revoke_key(session: Session, user: User, key_id: int) -> None:
    key = session.get(ApiKey, key_id)
    if key is None or key.user_id != user.id:
        raise HTTPException(status_code=404, detail="Key not found")
    if key.revoked_at is None:
        key.revoked_at = _utcnow()
        session.add(key)
        session.commit()


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Missing or invalid API key — send 'Authorization: Bearer ofk_…' (create one in Settings)",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _check_burst(key_id: int) -> None:
    now = time.monotonic()
    with _burst_lock:
        calls = _burst[key_id]
        while calls and now - calls[0] > BURST_WINDOW:
            calls.popleft()
        if len(calls) >= BURST_LIMIT:
            retry = max(1, int(BURST_WINDOW - (now - calls[0])))
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests — at most {BURST_LIMIT} per minute per key",
                headers={"Retry-After": str(retry)},
            )
        calls.append(now)


def _count_call(session: Session, key: ApiKey) -> None:
    """Adds one call to today's counter. Atomic UPDATE first (the common
    case), insert on the day's first call."""
    day = _utcnow().strftime("%Y-%m-%d")
    bumped = session.execute(
        update(ApiKeyUsage)
        .where(ApiKeyUsage.key_id == key.id, ApiKeyUsage.day == day)
        .values(calls=ApiKeyUsage.calls + 1)
    )
    if bumped.rowcount == 0:
        try:
            session.add(ApiKeyUsage(key_id=key.id, day=day, calls=1))
            session.commit()
        except IntegrityError:  # lost the race for the day's first row
            session.rollback()
            session.execute(
                update(ApiKeyUsage)
                .where(ApiKeyUsage.key_id == key.id, ApiKeyUsage.day == day)
                .values(calls=ApiKeyUsage.calls + 1)
            )
    session.commit()


def daily_usage(session: Session, user_id: int) -> int:
    """Calls made today across all of the user's keys."""
    day = _utcnow().strftime("%Y-%m-%d")
    rows = session.exec(
        select(ApiKeyUsage.calls)
        .join(ApiKey, ApiKey.id == ApiKeyUsage.key_id)
        .where(ApiKey.user_id == user_id, ApiKeyUsage.day == day)
    ).all()
    return int(sum(rows))


class ApiPrincipal:
    """Who an API call acts as: the key's owner, plus the key itself."""

    def __init__(self, user: User, key: ApiKey, used: int, limit: int):
        self.user = user
        self.key = key
        self.used = used
        self.limit = limit

    def company(self, session: Session) -> CompanyProfile | None:
        return resolve_user_company(session, self.user, self.key.company_id)


def authenticate(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: Session = Depends(get_session),
) -> ApiPrincipal:
    raw = creds.credentials if creds and creds.scheme.lower() == "bearer" else None
    if not raw or not raw.startswith(KEY_PREFIX):
        raise _unauthorized()
    key = session.exec(select(ApiKey).where(ApiKey.key_hash == hash_key(raw))).first()
    if key is None or key.revoked_at is not None:
        raise _unauthorized()
    if key.expires_at is not None and _aware(key.expires_at) <= _utcnow():
        raise _unauthorized()
    user = session.get(User, key.user_id)
    if user is None:
        raise _unauthorized()

    _check_burst(key.id)
    limit = api_daily_limit(user_plan(user))
    # The quota is per user, not per key, so extra keys do not buy extra calls.
    if daily_usage(session, user.id) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily API limit of {limit} calls reached — it resets at 00:00 UTC",
            headers={"Retry-After": str(_seconds_to_midnight())},
        )
    _count_call(session, key)
    used = daily_usage(session, user.id)
    key.last_used_at = _utcnow()
    session.add(key)
    session.commit()
    request.state.api_key_id = key.id
    return ApiPrincipal(user, key, used, limit)


def _seconds_to_midnight() -> int:
    now = _utcnow()
    nxt = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((nxt - now).total_seconds()))
