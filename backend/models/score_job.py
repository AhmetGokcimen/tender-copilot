"""Async per-company scoring jobs. Scoring every stored tender takes
minutes at real volumes, so POST /companies/{id}/score returns 202 with a
pending job and the frontend polls the GET below (processed/total) —
the same pending -> running -> done/failed contract as OcrJob."""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel

from models.ocr_job import ACTIVE_JOB_STATUSES  # noqa: F401 — shared vocabulary


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ScoreJob(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)

    company_id: int = Field(index=True)

    status: str = "pending"  # pending | running | done | failed
    total: int = 0
    processed: int = 0
    error: str | None = None

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
