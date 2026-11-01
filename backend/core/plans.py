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


def user_plan(user: User) -> str:  # noqa: ARG001 - per-user plans come with billing
    return settings.default_plan if settings.default_plan in FEATURES else "start"


def allows(plan: str, feature: str) -> bool:
    return feature in FEATURES.get(plan, frozenset())
