"""API keys for programmatic and AI-assistant (MCP) access.

Only the SHA-256 of a key is stored: the key itself is random and long, so a
fast hash is enough, and it is shown to the user exactly once at creation.
`prefix` (the first characters) is stored in the clear so the list screen can
tell keys apart.

ApiKeyUsage counts calls per key and day, the unit the plan quota is
measured in.
"""

from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ApiKey(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="app_user.id", index=True)
    name: str
    prefix: str  # e.g. "ofk_a1b2c3d4", safe to display
    key_hash: str = Field(unique=True, index=True)
    # The company whose profile (the user's filters) the key searches with.
    # None = the user's first company, same default as the web app.
    company_id: int | None = Field(default=None, foreign_key="companyprofile.id")
    created_at: datetime = Field(default_factory=_utcnow)
    last_used_at: datetime | None = None
    expires_at: datetime | None = None
    revoked_at: datetime | None = None
    # Set on the row that represents an app connected through OAuth (the key
    # string is never shown or usable); None for keys the user created.
    oauth_client_id: str | None = None


class ApiKeyUsage(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("key_id", "day", name="uq_api_key_usage_day"),)

    id: int | None = Field(default=None, primary_key=True)
    key_id: int = Field(foreign_key="apikey.id", index=True)
    day: str  # "YYYY-MM-DD" (UTC)
    calls: int = 0
