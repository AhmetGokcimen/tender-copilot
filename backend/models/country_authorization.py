"""Self-declared per-country bidding readiness, one row per company.

This is a tracking/reminder mechanism, NOT a legal verification system:
`status` is whatever the user says it is, never system-verified. Rows are
created for target countries during onboarding (see
core.authorizations.ensure_authorization_rows) and can also be opened
proactively for any other country.
"""

from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class CountryAuthorization(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint(
            "company_id", "country_code", name="uq_company_country_auth"
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="companyprofile.id", index=True)
    country_code: str = Field(index=True)  # ISO 3166-1 alpha-2, uppercase

    # not_started | in_progress | obtained — user's own declaration.
    status: str = "not_started"
    requirement_notes: str | None = None  # free text, user's own notes

    updated_at: datetime = Field(default_factory=_utcnow)
