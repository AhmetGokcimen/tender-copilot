"""Raw tender data as fetched from a source system.

Only columns an adapter writes live here. AI-derived and user-specific
fields live in UserTenderState instead, in a separate table — so that
re-ingesting a tender (upsert on re-fetch) can never wipe AI output. That
is exactly the bug the previous JSON-file-based system had: overwriting
the whole record on every re-fetch deleted fields the AI step had added
after the fact.
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

    first_seen_at: datetime = Field(default_factory=_utcnow)
    last_seen_at: datetime = Field(default_factory=_utcnow)
