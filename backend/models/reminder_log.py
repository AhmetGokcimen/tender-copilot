"""Which deadline reminders were already e-mailed, so each user hears about a
tender once."""

from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ReminderLog(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "tender_external_id", name="uq_reminder_user_tender"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    tender_external_id: str = Field(index=True)
    lead_days: int = 0  # the user's setting when it was sent
    sent_at: datetime = Field(default_factory=_utcnow)
