"""OAuth 2.1 authorization server for the MCP endpoint.

Why: claude.ai and ChatGPT connectors cannot send a custom `Authorization`
header; they sign the user in through OAuth. This module lets them do that
against Licits' own login, then hands out tokens that /api/mcp accepts exactly
like an API key.

What it implements (the subset MCP clients use):
- dynamic client registration (RFC 7591), public clients only (no secret)
- authorization code flow with mandatory PKCE S256
- refresh tokens that rotate; replaying a used one disconnects the app
- discovery documents (RFC 8414, RFC 9728), built in routes

Scope is a single read-only scope, `tenders.read`, same as an API key.
"""

import base64
import hashlib
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import timedelta
from urllib.parse import urlencode, urlsplit

from fastapi import HTTPException
from sqlmodel import Session, select

from backend.core.api_keys import ACCESS_PREFIX, _aware, _utcnow, hash_key
from backend.models.api_key import ApiKey
from backend.models.oauth import OAuthClient, OAuthCode, OAuthToken

SCOPE = "tenders.read"
REFRESH_PREFIX = "ofr_"
CODE_TTL = timedelta(minutes=5)
ACCESS_TTL = timedelta(hours=1)
REFRESH_TTL = timedelta(days=30)
MAX_REDIRECT_URIS = 5
REGISTER_LIMIT = 10  # registrations per client IP per hour (best effort, per instance)

_BLOCKED_SCHEMES = {"javascript", "data", "vbscript", "file", "blob", "about", "ftp"}
_LOOPBACK = {"127.0.0.1", "localhost", "[::1]", "::1"}

_registrations: dict[str, deque[float]] = defaultdict(deque)
_registrations_lock = threading.Lock()


class OAuthError(Exception):
    """An error in the shape RFC 6749 §5.2 wants on the token endpoint."""

    def __init__(self, error: str, description: str = "", status: int = 400):
        super().__init__(description or error)
        self.error = error
        self.description = description
        self.status = status


# --- clients -------------------------------------------------------------------------------


def _valid_redirect_uri(uri: object) -> bool:
    if not isinstance(uri, str) or not uri or len(uri) > 500 or "#" in uri:
        return False
    parts = urlsplit(uri)
    scheme = parts.scheme.lower()
    if not scheme or scheme in _BLOCKED_SCHEMES:
        return False
    if scheme == "https":
        return bool(parts.hostname)
    if scheme == "http":  # only for apps on the user's own machine
        return parts.hostname in {"127.0.0.1", "localhost", "::1"}
    return scheme.isascii() and scheme.replace("-", "").replace(".", "").replace("+", "").isalnum()


def register_client(session: Session, body: dict, client_ip: str) -> OAuthClient:
    with _registrations_lock:
        now = time.monotonic()
        calls = _registrations[client_ip]
        while calls and now - calls[0] > 3600:
            calls.popleft()
        if len(calls) >= REGISTER_LIMIT:
            raise OAuthError("temporarily_unavailable", "Too many registrations, try again later", 429)
        calls.append(now)

    uris = body.get("redirect_uris")
    if not isinstance(uris, list) or not uris or len(uris) > MAX_REDIRECT_URIS:
        raise OAuthError("invalid_redirect_uri", f"Send 1 to {MAX_REDIRECT_URIS} redirect_uris")
    if not all(_valid_redirect_uri(u) for u in uris):
        raise OAuthError("invalid_redirect_uri", "A redirect URI is not allowed")
    method = body.get("token_endpoint_auth_method", "none")
    if method != "none":
        raise OAuthError("invalid_client_metadata", "Only public clients are supported (token_endpoint_auth_method: none)")
    grants = body.get("grant_types") or ["authorization_code"]
    if not isinstance(grants, list) or not set(grants) <= {"authorization_code", "refresh_token"}:
        raise OAuthError("invalid_client_metadata", "Unsupported grant_types")
    name = body.get("client_name")
    name = " ".join(name.split())[:80] if isinstance(name, str) and name.strip() else "AI assistant"

    client = OAuthClient(id="lc_" + secrets.token_urlsafe(18), name=name, redirect_uris=list(uris))
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


def redirect_allowed(client: OAuthClient, uri: str) -> bool:
    """Exact match with a registered URI; a registered loopback URI also
    matches on any port (RFC 8252 §7.3: desktop apps pick a free one)."""
    if uri in client.redirect_uris:
        return True
    want = urlsplit(uri)
    for registered in client.redirect_uris:
        have = urlsplit(registered)
        if (
            have.scheme == "http" and want.scheme == "http" and have.hostname in _LOOPBACK
            and want.hostname == have.hostname and want.path == have.path and want.query == have.query
        ):
            return True
    return False


def get_client(session: Session, client_id: str) -> OAuthClient | None:
    return session.get(OAuthClient, client_id) if client_id else None


def checked_client(session: Session, client_id: str, redirect_uri: str) -> OAuthClient:
    """Unknown client or unregistered redirect: a plain 400 for the user,
    never a redirect (that would let anyone bounce users to any URL)."""
    client = get_client(session, client_id)
    if client is None or not redirect_uri or not redirect_allowed(client, redirect_uri):
        raise HTTPException(status_code=400, detail="Unknown app or redirect address")
    return client


# --- authorization (user consent) ---------------------------------------------------------


def _redirect(uri: str, **params: str) -> str:
    sep = "&" if "?" in uri else "?"
    return uri + sep + urlencode({k: v for k, v in params.items() if v})


def authorize(
    session: Session,
    *,
    user_id: int,
    client: OAuthClient,
    redirect_uri: str,
    response_type: str,
    code_challenge: str,
    code_challenge_method: str,
    state: str,
    approve: bool,
) -> str:
    """Where to send the browser next: back to the app with a code, or with an error."""
    if not approve:
        return _redirect(redirect_uri, error="access_denied", state=state)
    if response_type != "code":
        return _redirect(redirect_uri, error="unsupported_response_type", state=state)
    if code_challenge_method != "S256" or not (43 <= len(code_challenge) <= 128):
        return _redirect(
            redirect_uri, error="invalid_request", state=state,
            error_description="PKCE with code_challenge_method=S256 is required",
        )
    code = secrets.token_urlsafe(32)
    session.add(
        OAuthCode(
            code_hash=hash_key(code), client_id=client.id, user_id=user_id, redirect_uri=redirect_uri,
            code_challenge=code_challenge, expires_at=_utcnow() + CODE_TTL,
        )
    )
    session.commit()
    return _redirect(redirect_uri, code=code, state=state)


# --- tokens ---------------------------------------------------------------------------------


def _connection(session: Session, user_id: int, client: OAuthClient) -> ApiKey:
    """The ApiKey row standing for this user's grant to this app (made on first use)."""
    key = session.exec(
        select(ApiKey).where(
            ApiKey.user_id == user_id, ApiKey.oauth_client_id == client.id, ApiKey.revoked_at == None
        )
    ).first()
    if key is None:
        key = ApiKey(
            user_id=user_id, name=client.name, prefix="oauth",
            key_hash=hash_key("oauth:" + secrets.token_urlsafe(32)),  # nothing can present this
            oauth_client_id=client.id,
        )
        session.add(key)
        session.commit()
        session.refresh(key)
    return key


def _issue(session: Session, key: ApiKey, client_id: str) -> dict:
    now = _utcnow()
    access = ACCESS_PREFIX + secrets.token_urlsafe(32)
    refresh = REFRESH_PREFIX + secrets.token_urlsafe(32)
    session.add(
        OAuthToken(
            key_id=key.id, client_id=client_id,
            access_hash=hash_key(access), access_expires_at=now + ACCESS_TTL,
            refresh_hash=hash_key(refresh), refresh_expires_at=now + REFRESH_TTL,
        )
    )
    # Housekeeping: rows nobody can use any more.
    for stale in session.exec(select(OAuthToken).where(OAuthToken.refresh_expires_at < now)).all():
        session.delete(stale)
    for stale_code in session.exec(select(OAuthCode).where(OAuthCode.expires_at < now - timedelta(days=1))).all():
        session.delete(stale_code)
    session.commit()
    return {
        "access_token": access,
        "token_type": "Bearer",
        "expires_in": int(ACCESS_TTL.total_seconds()),
        "refresh_token": refresh,
        "scope": SCOPE,
    }


def _pkce_ok(verifier: str, challenge: str) -> bool:
    if not (43 <= len(verifier) <= 128):
        return False
    digest = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return secrets.compare_digest(digest, challenge)


def exchange_code(
    session: Session, *, client_id: str, code: str, redirect_uri: str, code_verifier: str
) -> dict:
    client = get_client(session, client_id)
    if client is None:
        raise OAuthError("invalid_client", "Unknown client", 401)
    row = session.exec(select(OAuthCode).where(OAuthCode.code_hash == hash_key(code))).first() if code else None
    if row is None or row.client_id != client.id:
        raise OAuthError("invalid_grant", "Unknown or expired code")
    if row.used_at is not None:
        # A code is single use; seeing it twice means it leaked. Cut the app off.
        for key in session.exec(
            select(ApiKey).where(
                ApiKey.user_id == row.user_id, ApiKey.oauth_client_id == client.id, ApiKey.revoked_at == None
            )
        ).all():
            key.revoked_at = _utcnow()
            session.add(key)
        session.commit()
        raise OAuthError("invalid_grant", "Code already used")
    if _aware(row.expires_at) <= _utcnow() or row.redirect_uri != redirect_uri:
        raise OAuthError("invalid_grant", "Unknown or expired code")
    if not _pkce_ok(code_verifier, row.code_challenge):
        raise OAuthError("invalid_grant", "PKCE verification failed")
    row.used_at = _utcnow()
    session.add(row)
    session.commit()
    return _issue(session, _connection(session, row.user_id, client), client.id)


def refresh(session: Session, *, client_id: str, refresh_token: str) -> dict:
    token = (
        session.exec(select(OAuthToken).where(OAuthToken.refresh_hash == hash_key(refresh_token))).first()
        if refresh_token.startswith(REFRESH_PREFIX) else None
    )
    if token is None or token.client_id != client_id:
        raise OAuthError("invalid_grant", "Unknown refresh token")
    key = session.get(ApiKey, token.key_id)
    if key is None or key.revoked_at is not None or _aware(token.refresh_expires_at) <= _utcnow():
        raise OAuthError("invalid_grant", "Refresh token expired or revoked")
    if token.refresh_used_at is not None:
        # Rotation: each refresh token works once. A second use means two
        # holders; disconnect the app so the user signs in again.
        key.revoked_at = _utcnow()
        session.add(key)
        session.commit()
        raise OAuthError("invalid_grant", "Refresh token already used")
    token.refresh_used_at = _utcnow()
    session.add(token)
    session.commit()
    return _issue(session, key, client_id)
