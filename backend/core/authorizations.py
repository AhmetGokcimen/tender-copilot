"""CountryAuthorization data access: list, upsert, onboarding ensure.

All reads/writes are company-scoped — routes must resolve the company
through core.membership first, so these helpers never see a stranger's id.
"""

import re
from datetime import UTC, datetime

from sqlmodel import Session, select

from backend.models.country_authorization import CountryAuthorization

STATUSES = ("not_started", "in_progress", "obtained")
_CODE_RE = re.compile(r"^[A-Z]{2}$")


def normalize_country_code(country_code: str) -> str:
    code = (country_code or "").strip().upper()
    if not _CODE_RE.match(code):
        raise ValueError(f"country_code must be ISO alpha-2, got {country_code!r}")
    return code


def list_authorizations(
    session: Session, company_id: int
) -> list[CountryAuthorization]:
    return list(
        session.exec(
            select(CountryAuthorization)
            .where(CountryAuthorization.company_id == company_id)
            .order_by(CountryAuthorization.country_code)
        ).all()
    )


def upsert_authorization(
    session: Session,
    company_id: int,
    country_code: str,
    status: str | None = None,
    requirement_notes: str | None = None,
) -> CountryAuthorization:
    """Create-or-update one (company, country) row. Only provided fields
    change; unknown statuses and malformed codes raise ValueError."""
    code = normalize_country_code(country_code)
    if status is not None and status not in STATUSES:
        raise ValueError(f"Unknown status: {status!r} — expected one of {STATUSES}")
    row = session.exec(
        select(CountryAuthorization).where(
            CountryAuthorization.company_id == company_id,
            CountryAuthorization.country_code == code,
        )
    ).first()
    if row is None:
        row = CountryAuthorization(
            company_id=company_id, country_code=code, status=status or "not_started"
        )
    elif status is not None:
        row.status = status
    if requirement_notes is not None:
        row.requirement_notes = requirement_notes
    row.updated_at = datetime.now(UTC)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def ensure_authorization_rows(
    session: Session, company_id: int, country_codes: list[str]
) -> None:
    """Guarantee a row per code, defaulting to not_started. Existing rows
    are never touched — picking a country twice must not reset progress.
    Removing a country from target_countries does NOT delete its row:
    history is kept even when the target list shrinks."""
    for raw in country_codes:
        code = normalize_country_code(raw)
        exists = session.exec(
            select(CountryAuthorization).where(
                CountryAuthorization.company_id == company_id,
                CountryAuthorization.country_code == code,
            )
        ).first()
        if exists is None:
            session.add(CountryAuthorization(company_id=company_id, country_code=code))
    session.commit()


def authorization_status_map(
    session: Session, company_id: int | None
) -> dict[str, str]:
    """country_code -> status for feed enrichment. Empty when there is no
    company in context — every tender then reports status null."""
    if company_id is None:
        return {}
    return {
        row.country_code: row.status for row in list_authorizations(session, company_id)
    }
