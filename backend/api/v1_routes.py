"""Public, read-only REST API (/api/v1), authenticated with an API key.

Same data the web app shows, ranked for the key owner's saved filters.
Nothing here writes: a leaked key can read tenders but never change an
account. The MCP endpoint (mcp_routes) exposes the same operations as tools.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from backend.core import tender_api
from backend.core.api_keys import ApiPrincipal, authenticate
from backend.db import get_session

router = APIRouter(prefix="/v1", tags=["public-api"])


@router.get("/me")
def me(principal: ApiPrincipal = Depends(authenticate), session: Session = Depends(get_session)) -> dict:
    """Who the key belongs to and how much of today's quota is used."""
    company = principal.company(session)
    return {
        "email": principal.user.email,
        "company": company.name if company else None,
        "key": {"name": principal.key.name, "prefix": principal.key.prefix},
        "daily_limit": principal.limit,
        "used_today": principal.used,
    }


@router.get("/profile")
def profile(principal: ApiPrincipal = Depends(authenticate), session: Session = Depends(get_session)) -> dict:
    """The saved filters (CPV codes, keywords, exclusions, capacity...) that rank tenders."""
    return tender_api.profile(principal.company(session))


@router.get("/tenders")
def search_tenders(
    q: str | None = Query(default=None, description="Words to find in title, summary or authority"),
    county: str | None = None,
    cpv: str | None = Query(default=None, description="CPV code or division prefix, e.g. 45 or 45233"),
    procedure_type: str | None = None,
    min_value: float | None = None,
    max_value: float | None = None,
    min_score: int | None = Query(default=None, ge=0, le=100),
    eligible: bool | None = None,
    deadline_within_days: int | None = Query(default=None, ge=0, le=365),
    min_days_left: int | None = Query(default=None, ge=0, le=365, description="Skip tenders closing sooner than this"),
    include_closed: bool = False,
    include_dismissed: bool = False,
    sort: Literal["match", "deadline", "value"] = "match",
    limit: int = Query(default=10, ge=1, le=tender_api.MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    principal: ApiPrincipal = Depends(authenticate),
    session: Session = Depends(get_session),
) -> dict:
    """Search tenders, best match for the key owner's profile first."""
    return tender_api.search(
        session, principal.company(session), query=q, county=county, cpv=cpv,
        procedure_type=procedure_type, min_value=min_value, max_value=max_value,
        min_score=min_score, eligible=eligible, deadline_within_days=deadline_within_days,
        min_days_left=min_days_left, include_closed=include_closed, include_dismissed=include_dismissed,
        sort=sort, limit=limit, offset=offset,
    )


@router.get("/tenders/{tender_id}")
def get_tender(
    tender_id: str,
    principal: ApiPrincipal = Depends(authenticate),
    session: Session = Depends(get_session),
) -> dict:
    found = tender_api.get_tender(session, principal.company(session), tender_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Tender not found")
    return found


@router.get("/deadlines")
def deadlines(
    within_days: int = Query(default=14, ge=1, le=365),
    followed_only: bool = True,
    limit: int = Query(default=20, ge=1, le=tender_api.MAX_LIMIT),
    principal: ApiPrincipal = Depends(authenticate),
    session: Session = Depends(get_session),
) -> dict:
    return tender_api.deadlines(
        session, principal.company(session), within_days=within_days,
        followed_only=followed_only, limit=limit,
    )


@router.get("/pipeline")
def pipeline(principal: ApiPrincipal = Depends(authenticate), session: Session = Depends(get_session)) -> dict:
    """The owner's own board: tenders marked preparing, applied, rejected..."""
    return tender_api.pipeline(session, principal.company(session))
