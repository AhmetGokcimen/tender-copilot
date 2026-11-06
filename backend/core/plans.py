"""Which plan unlocks which gated feature.

There is no billing yet, so every user resolves to settings.default_plan
("pro" before launch: everyone sees everything). When billing lands, only
`user_plan` changes; routes already ask `allows(plan, feature)`.
"""

from backend.core.config import settings
from backend.models.user import User

FEATURES: dict[str, frozenset[str]] = {
    "start": frozenset(),
    "growth": frozenset({"renewal", "renewal_alerts"}),
    "pro": frozenset({"renewal", "renewal_alerts", "renewal_price"}),
}


# API / AI-assistant calls one user's keys may make per UTC day, and how many
# live keys they may hold. Raise per plan when billing lands.
API_DAILY_CALLS: dict[str, int] = {"start": 100, "growth": 1000, "pro": 5000}
API_MAX_KEYS = 5


def api_daily_limit(plan: str) -> int:
    return API_DAILY_CALLS.get(plan, API_DAILY_CALLS["start"])


def user_plan(user: User) -> str:  # noqa: ARG001 - per-user plans come with billing
    return settings.default_plan if settings.default_plan in FEATURES else "start"


def allows(plan: str, feature: str) -> bool:
    return feature in FEATURES.get(plan, frozenset())
