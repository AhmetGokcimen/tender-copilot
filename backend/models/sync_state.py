"""Sync checkpoints: where each incremental feed last stopped.

One row per feed key ("romania_seap:tenders", "romania_seap:awards").
The backfill script and POST /internal/sync-tenders both advance these,
so an interrupted run (or a serverless timeout) resumes instead of
restarting — and a re-run over an already-synced window is a no-op
beyond re-upserting identical rows.
"""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class SyncCheckpoint(SQLModel, table=True):
    key: str = Field(primary_key=True)
    # End of the last fully completed slice (exclusive upper bound of the
    # next window). None = this feed never completed a slice.
    window_end: datetime | None = None
    # Rows upserted by the run that set window_end (observability only).
    last_count: int = 0
    updated_at: datetime = Field(default_factory=_utcnow)
