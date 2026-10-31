"""Past winners of a tender's buyer, with each winner's latest ANAF figures.

The last few contracts the same authority awarded in the same CPV division,
each with the company that won it. Who will bid on the open tender is not
public, so past winners are the honest stand-in for likely competitors.

ANAF's balance-sheet service is free and keyless but rate limited (about one
request a second), so calls are spaced out and results cached in
WinnerFinancials.
"""

import time
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from backend.core.config import settings
from backend.core.sync import cpv_group
from backend.models.award import Award
from backend.models.tender import Tender
from backend.models.usage import FeatureUse, WinnerFinancials

FEATURE = "past_winners"
MAX_AWARDS = 5
ANAF_BASE = "https://webservicesp.anaf.ro"
CACHE_DAYS = 30
ANAF_GAP_SECONDS = 1.1
_last_anaf_call = 0.0


def _period(now: datetime | None = None) -> str:
    return (now or datetime.now(UTC)).strftime("%Y-%m")


def quota(session: Session, user_id: int) -> dict:
    used = len(
        session.exec(
            select(FeatureUse.id).where(
                FeatureUse.user_id == user_id, FeatureUse.feature == FEATURE, FeatureUse.period == _period()
            )
        ).all()
    )
    return {"used": used, "limit": settings.past_winners_monthly_limit}


def already_used(session: Session, user_id: int, subject: str) -> bool:
    return (
        session.exec(
            select(FeatureUse.id).where(
                FeatureUse.user_id == user_id,
                FeatureUse.feature == FEATURE,
                FeatureUse.period == _period(),
                FeatureUse.subject == subject,
            )
        ).first()
        is not None
    )


def charge(session: Session, user_id: int, subject: str) -> None:
    """Spend one unit for this tender. A repeat (or a double click racing
    the first) hits the unique constraint and is simply not charged twice."""
    session.add(FeatureUse(user_id=user_id, feature=FEATURE, period=_period(), subject=subject))
    try:
        session.commit()
    except IntegrityError:
        session.rollback()


def past_awards(session: Session, tender: Tender) -> list[Award]:
    authority = tender.contracting_authority
    if not authority:
        return []
    group = cpv_group(tender.cpv_codes[0] if tender.cpv_codes else None)
    rows = session.exec(select(Award).where(Award.contracting_authority == authority)).all()
    same = [
        a for a in rows
        if cpv_group(a.cpv_codes[0] if a.cpv_codes else None) == group and (a.winner_name or a.winner_cif)
    ]

    def when(a: Award) -> datetime:
        d = a.contract_date or a.award_date or datetime.min.replace(tzinfo=UTC)
        return d if d.tzinfo else d.replace(tzinfo=UTC)

    return sorted(same, key=when, reverse=True)[:MAX_AWARDS]


def cui_digits(raw: str | None) -> int | None:
    digits = "".join(ch for ch in (raw or "") if ch.isdigit())
    return int(digits) if 2 <= len(digits) <= 10 else None


def anaf_balance(cui: int, year: int) -> dict | None:
    """The three figures from one filed balance sheet, or None when ANAF has
    none for that year (or does not answer). Calls are spaced to stay under
    ANAF's rate limit."""
    global _last_anaf_call
    wait = _last_anaf_call + ANAF_GAP_SECONDS - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    _last_anaf_call = time.monotonic()
    try:
        res = httpx.get(f"{ANAF_BASE}/bilant", params={"an": year, "cui": cui}, timeout=8.0)
        if res.status_code != 200:
            return None
        rows = res.json().get("i") or []
    except (httpx.HTTPError, ValueError):
        return None

    def pick(label: str) -> float | None:
        for r in rows:
            if label in str(r.get("val_den_indicator", "")).lower() and isinstance(r.get("val_indicator"), (int, float)):
                return float(r["val_indicator"])
        return None

    turnover = pick("cifra de afaceri net")
    if turnover is None:
        return None
    employees = pick("numar mediu de salariati")
    return {"turnover": turnover, "net_profit": pick("profit net"), "employees": int(employees) if employees is not None else None}


def financials(session: Session, cui: int) -> dict | None:
    """Latest filed year (last year, else the one before), from cache when fresh."""
    fresh = datetime.now(UTC) - timedelta(days=CACHE_DAYS)
    cached = session.exec(
        select(WinnerFinancials).where(WinnerFinancials.cui == cui).order_by(WinnerFinancials.year.desc())  # type: ignore[attr-defined]
    ).first()
    if cached:
        at = cached.fetched_at if cached.fetched_at.tzinfo else cached.fetched_at.replace(tzinfo=UTC)
        if at >= fresh:
            return {"year": cached.year, "turnover": cached.turnover, "net_profit": cached.net_profit, "employees": cached.employees}
    this_year = datetime.now(UTC).year
    for year in (this_year - 1, this_year - 2):
        found = anaf_balance(cui, year)
        if found:
            session.merge(WinnerFinancials(cui=cui, year=year, **found))
            session.commit()
            return {"year": year, **found}
    return None
