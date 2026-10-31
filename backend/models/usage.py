"""Metered feature use and cached winner financials.

FeatureUse: one row per (user, feature, month, tender). The row is what
spends a unit of the user's monthly quota; looking the same tender up again
in the same month finds the row and costs nothing.

WinnerFinancials: balance-sheet figures ANAF published for one company and
year, kept so repeat lookups do not hit ANAF's rate-limited service again.
"""

from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class FeatureUse(SQLModel, table=True):
    __table_args__ = (
        UniqueConstraint("user_id", "feature", "period", "subject", name="uq_feature_use"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="app_user.id", index=True)
    feature: str  # e.g. "past_winners"
    period: str  # "YYYY-MM"
    subject: str  # what was looked up, e.g. a tender external_id
    created_at: datetime = Field(default_factory=_utcnow)


class WinnerFinancials(SQLModel, table=True):
    cui: int = Field(primary_key=True)
    year: int = Field(primary_key=True)
    turnover: float | None = None  # "Cifra de afaceri neta", RON
    net_profit: float | None = None  # "Profit net", RON
    employees: int | None = None  # "Numar mediu de salariati"
    fetched_at: datetime = Field(default_factory=_utcnow)
