"""Metered use of the features that cost real money (model calls).

One FeatureUse row per (user, feature, period, subject). A repeat on the same
subject (the same tender, say) finds the row and costs nothing. Plans that do
not cap a feature skip all of it, so paid behaviour is unchanged.

Use `check` before the expensive work and `record` after it succeeded, so a
failed model call never spends a unit.
"""

from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from backend.core.plans import AGENT_FEATURE, limit_for, user_plan
from backend.models.usage import FeatureUse
from backend.models.user import User

LIFETIME = "lifetime"


def period(kind: str, now: datetime | None = None) -> str:
    return LIFETIME if kind == LIFETIME else (now or datetime.now(UTC)).strftime("%Y-%m")


def used(session: Session, user_id: int, feature: str, kind: str) -> int:
    return int(
        session.exec(
            select(func.count(FeatureUse.id)).where(
                FeatureUse.user_id == user_id,
                FeatureUse.feature == feature,
                FeatureUse.period == period(kind),
            )
        ).one()
    )


def _seen(session: Session, user_id: int, feature: str, kind: str, subject: str) -> bool:
    return (
        session.exec(
            select(FeatureUse.id).where(
                FeatureUse.user_id == user_id,
                FeatureUse.feature == feature,
                FeatureUse.period == period(kind),
                FeatureUse.subject == subject,
            )
        ).first()
        is not None
    )


def check(session: Session, user: User, feature: str, subject: str) -> None:
    """429 when this plan has used up the feature (a subject already spent is free)."""
    cap = limit_for(user_plan(user), feature)
    if cap is None:
        return
    kind, limit = cap
    if _seen(session, user.id, feature, kind, subject):  # type: ignore[arg-type]
        return
    if used(session, user.id, feature, kind) >= limit:  # type: ignore[arg-type]
        raise HTTPException(status_code=429, detail=f"Free plan limit reached for {feature}")


def record(session: Session, user: User, feature: str, subject: str) -> None:
    """Spend one unit. A repeat, or a double click racing the first, is not charged twice."""
    cap = limit_for(user_plan(user), feature)
    if cap is None:
        return
    session.add(FeatureUse(user_id=user.id, feature=feature, period=period(cap[0]), subject=subject))  # type: ignore[arg-type]
    try:
        session.commit()
    except IntegrityError:
        session.rollback()


def agent_feature(agent: str) -> str | None:
    return AGENT_FEATURE.get(agent)


def snapshot(session: Session, user: User) -> dict:
    """The user's plan and where they stand on every capped feature."""
    plan = user_plan(user)
    limits = {}
    for feature in ("gonogo", "bid_pack", "past_winners", "assistant"):
        cap = limit_for(plan, feature)
        if cap:
            limits[feature] = {"used": used(session, user.id, feature, cap[0]), "limit": cap[1], "period": cap[0]}  # type: ignore[arg-type]
    return {"plan": plan, "limits": limits}
