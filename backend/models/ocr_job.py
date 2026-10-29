"""Async caiet-extraction jobs. A fully-scanned caiet costs ~90K tokens
and minutes of vision calls, so extraction runs in a background task and
the frontend polls the job row (pending -> running -> done/failed)."""

from datetime import UTC, datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from backend.models.tender import SourceSystem

ACTIVE_JOB_STATUSES = ("pending", "running")


def _utcnow() -> datetime:
    return datetime.now(UTC)


class OcrJob(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)

    tender_source_system: SourceSystem
    tender_external_id: str = Field(index=True)

    status: str = "pending"  # pending | running | done | failed
    # On done: caiet_name, extracted_requirements (+ confidence), ocr_pages,
    # scanned_pages, truncated. Stays None until done.
    result: dict | None = Field(default=None, sa_column=Column(JSON))
    error: str | None = None

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
