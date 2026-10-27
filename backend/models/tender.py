"""Raw tender data as fetched from a source system, plus AI output that is
intrinsic to the tender itself (same regardless of which company is
looking at it) — a simplified title and extracted eligibility
requirements. Per-company output (score, justification, eligibility
verdict) lives in UserTenderState instead.

db.upsert_tenders (the adapter's re-fetch path) explicitly excludes the AI
columns below from its ON CONFLICT DO UPDATE, so a re-fetch can never wipe
AI output — same guarantee the Tender/UserTenderState split provides, just
applied within this table too. This is exactly the bug the previous
JSON-file-based system had: overwriting the whole record on every
re-fetch deleted fields the AI step had added after the fact.
"""

from datetime import UTC, datetime
from enum import Enum

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class SourceSystem(str, Enum):
    ROMANIA_SEAP = "romania_seap"


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Tender(SQLModel, table=True):
    # Composite PK: an external_id is only unique within its own source
    # system, and this doubles as the ON CONFLICT target for upserts.
    source_system: SourceSystem = Field(primary_key=True)
    external_id: str = Field(primary_key=True)

    country_code: str = Field(index=True)  # ISO 3166-1 alpha-2, e.g. "RO"
    notice_no: str | None = None  # the source's own public reference number, for display
    # The source's own notice-type id (e.g. SEAP's sysNoticeTypeId). Needed
    # to call that source's detail/eligibility endpoints later — adapters
    # that have no such concept can leave it None.
    notice_type_id: int | None = None
    title: str
    contracting_authority: str | None = None
    # cpv_codes[0] is the tender's main CPV; any further entries are
    # lot/secondary CPVs, used by core.scoring to detect subcontracting fits.
    cpv_codes: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    estimated_value: float | None = None
    currency: str | None = None
    publication_date: datetime | None = None
    submission_deadline: datetime | None = None
    raw_description: str | None = None
    source_url: str | None = None

    # Feed display fields (nullable: enriched at sync time, may be missing
    # for tenders synced before enrichment or when SEAP omits them).
    county: str | None = None  # from section-1 NUTS code ("RO421 Arad" -> "Arad")
    procedure_type: str | None = None  # open|restricted|negotiated|direct|framework
    clarification_deadline: datetime | None = None  # deadline minus section-1 noDays

    # AI output intrinsic to the tender (see module docstring) — never
    # overwritten by a re-fetch.
    ai_title_simplified: str | None = None
    extracted_requirements: dict | None = Field(default=None, sa_column=Column(JSON))
    extraction_confidence: str | None = None  # "high" | "medium" | "low" | "failed"

    first_seen_at: datetime = Field(default_factory=_utcnow)
    last_seen_at: datetime = Field(default_factory=_utcnow)
