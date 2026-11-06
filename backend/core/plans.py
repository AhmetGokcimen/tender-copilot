"""Which plan unlocks which gated feature.

There is no billing yet. A user resolves to their own `User.plan` when one is
set, otherwise to settings.default_plan ("pro" before launch: everyone sees
everything). Setting DEFAULT_PLAN=free puts every user without an explicit
plan on the Free plan and turns on the Free limits below. When billing lands,
only `user_plan` changes; routes already ask `allows(plan, feature)`.
"""

from backend.core.config import settings
from backend.models.user import User

FEATURES: dict[str, frozenset[str]] = {
    "free": frozenset(),
    "start": frozenset(),
    "growth": frozenset({"renewal", "renewal_alerts"}),
    "pro": frozenset({"renewal", "renewal_alerts", "renewal_price"}),
}


# API / AI-assistant calls one user's keys may make per UTC day, and how many
# live keys they may hold. Raise per plan when billing lands. Free has no API
# access: its reads would cost nothing, but keys are a paid feature.
API_DAILY_CALLS: dict[str, int] = {"free": 0, "start": 100, "growth": 1000, "pro": 5000}
API_MAX_KEYS = 5

# Metered features and what each costs us per use (measured, USD): a Go/No-Go
# look at a tender ~0.05 (spec shared, eligibility agent), a bid file ~0.32
# (legal, writer, risk), an assistant message ~0.02. The Free plan is capped so
# a signup costs cents, not dollars. Paid plans are not capped here yet.
# value = (period, limit): "month" resets each calendar month, "lifetime" never.
FREE_LIMITS: dict[str, tuple[str, int]] = {
    "gonogo": ("month", 3),  # distinct tenders given a Go/No-Go verdict
    "bid_pack": ("lifetime", 1),  # one free bid file, to see the result once
    "past_winners": ("month", 3),  # distinct tenders opened in the rival report
    "assistant": ("month", 10),  # assistant messages
}

# Which metered feature each bid agent belongs to. `spec` and `eligibility`
# together are the Go/No-Go look; legal, writer and risk make the bid file.
AGENT_FEATURE: dict[str, str] = {
    "spec": "gonogo",
    "eligibility": "gonogo",
    "legal": "bid_pack",
    "writer": "bid_pack",
    "risk": "bid_pack",
}


def api_daily_limit(plan: str) -> int:
    return API_DAILY_CALLS.get(plan, API_DAILY_CALLS["start"])


def user_plan(user: User) -> str:
    own = getattr(user, "plan", None)
    if own in FEATURES:
        return own
    return settings.default_plan if settings.default_plan in FEATURES else "start"


def allows(plan: str, feature: str) -> bool:
    return feature in FEATURES.get(plan, frozenset())


def limit_for(plan: str, feature: str) -> tuple[str, int] | None:
    """(period kind, limit) when this plan caps the feature, else None."""
    return FREE_LIMITS.get(feature) if plan == "free" else None
