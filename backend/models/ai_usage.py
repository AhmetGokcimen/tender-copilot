"""One row per model call: what it was for and the tokens the provider billed.
Used to replace cost estimates with measured numbers."""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AiUsage(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=_utcnow, index=True)
    purpose: str = Field(index=True)  # translate | brief:English | agent:writer | ocr | ...
    model: str
    input_tokens: int = 0
    output_tokens: int = 0  # includes reasoning tokens (billed as output)
    reasoning_tokens: int = 0
    cached_tokens: int = 0
