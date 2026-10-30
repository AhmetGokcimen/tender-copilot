"""Public, unauthenticated read-only endpoints for the marketing site.

Only data that is already public on SEAP and carries no personal data is
exposed here. This router MUST stay off the get_current_user dependency.
"""

import unicodedata
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.db import get_session
from backend.models.tender import Tender

router = APIRouter(tags=["public"])


class MapTender(BaseModel):
    id: str
    title: str
    county: str
    value: float | None
    currency: str | None
    published_at: datetime
    url: str


def _county_key(county: str) -> str:
    """Accent- and case-insensitive county key: SEAP spells "Bucureşti" (cedilla),
    "Bucuresti" and "Iasi" for the same places."""
    plain = unicodedata.normalize("NFD", county)
    return "".join(c for c in plain if not unicodedata.combining(c)).casefold().strip()


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


@router.get("/public/map-tenders", response_model=list[MapTender])
def map_tenders(
    response: Response,
    hours: int = Query(default=24, ge=1, le=48),
    session: Session = Depends(get_session),
) -> list[MapTender]:
    """The newest open construction notice (CPV 45) of each county, published
    in the last `hours`. Notices drop out once they are older than that."""
    response.headers["Cache-Control"] = "public, s-maxage=300, stale-while-revalidate=600"
    now = datetime.now(UTC)
    since = now - timedelta(hours=hours)
    rows = session.exec(
        select(Tender)
        .where(Tender.publication_date >= since)  # type: ignore[arg-type]
        .order_by(Tender.publication_date.desc())  # type: ignore[union-attr]
    ).all()
    newest: dict[str, MapTender] = {}
    for t in rows:
        if not (t.cpv_codes and str(t.cpv_codes[0]).startswith("45")):
            continue
        if not (t.county and t.source_url and t.publication_date):
            continue
        if t.submission_deadline and _aware(t.submission_deadline) < now:
            continue
        key = _county_key(t.county)
        if key in newest:
            continue
        newest[key] = MapTender(
            id=t.external_id,
            title=(t.ai_title_simplified or t.title).strip()[:160],
            county=t.county,
            value=t.estimated_value,
            currency=t.currency,
            published_at=t.publication_date,
            url=t.source_url,
        )
    return list(newest.values())
