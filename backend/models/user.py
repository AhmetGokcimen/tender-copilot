"""Login identity: one row per Google account (or the fixed demo user).

A User owns nothing directly — the UserCompany link table connects users
to companies, so 1 user : N companies works without ever storing a
User.company_id foreign key.
"""

from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    # "user" is a reserved word in PostgreSQL — explicit table name keeps
    # the SQLite-now-Postgres-later story intact.
    __tablename__ = "app_user"

    id: int | None = Field(default=None, primary_key=True)
    subject: str = Field(unique=True, index=True)  # JWT sub: "google:<email>" | "demo"
    email: str
    name: str
    provider: str  # "google" | "demo"

    created_at: datetime = Field(default_factory=_utcnow)
