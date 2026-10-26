"""Per-company state for a tender: scoring and eligibility output that
depends on which company is looking. AI output that doesn't depend on the
company (simplified title, extracted requirements) lives on Tender itself
instead — see models.tender's docstring.

Deliberately a separate table from Tender: re-fetching/upserting a tender
(see db.upsert_tenders) only ever touches Tender's own raw columns, so it
is structurally impossible for a re-fetch to wipe the score or eligibility
verdict computed here.
"""

from datetime import UTC, datetime

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel

from models.tender import SourceSystem


def _utcnow() -> datetime:
    return datetime.now(UTC)


class UserTenderState(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint(
            "tender_source_system", "tender_external_id", "company_id",
            name="uq_user_tender_state_tender_company",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)

    tender_source_system: SourceSystem
    tender_external_id: str
    company_id: int = Field(foreign_key="companyprofile.id")

    # Pre-filter/scoring output
    score: int | None = None
    score_reasons: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    # AI layer output: this one tender/company pair's justification. (A
    # simplified title and extracted requirements are tender-intrinsic —
    # they live on Tender instead, see that model's docstring.)
    ai_summary: str | None = None

    # Eligibility comparison output
    eligible: bool | None = None  # None = uncertain, never guessed
    matched_requirements: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    unmet_requirements: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    eligibility_justification: str | None = None

    status: str = "new"  # new -> reviewing -> applied / rejected / ignored
    updated_at: datetime = Field(default_factory=_utcnow)
