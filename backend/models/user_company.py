"""User <-> Company membership. The row is the isolation boundary: every
company-scoped read/write must pass through a membership check (see
core/membership.py). `role` is informational for now ("owner" everywhere),
reserved for future sharper permissions."""

from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class UserCompany(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("user_id", "company_id", name="uq_user_company_pair"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="app_user.id", index=True)
    company_id: int = Field(foreign_key="companyprofile.id", index=True)
    role: str = "owner"

    created_at: datetime = Field(default_factory=_utcnow)
