"""The read-only operations behind both the /api/v1 REST endpoints and the MCP
tools, so the two can never disagree.

Every function takes the caller's company (the user's saved filters: CPV
codes, keywords, capacity, certifications...) and ranks with the same
deterministic scoring the web feed uses. Output is deliberately compact and
flat: an AI assistant reads it, so long free text is cut and every value that
came from a third party (tender titles, descriptions, authority names) sits
under keys the MCP layer flags as untrusted.
"""

from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import String, cast, or_
from sqlmodel import Session, select

from backend.api.schemas import missing_documents_for, summarize_requirements
from backend.core import score_jobs
from backend.core.lookups import profile_completeness
from backend.models.company import CompanyProfile
from backend.models.tender import Tender
from backend.models.user_tender_state import UserTenderState

MAX_LIMIT = 25
CANDIDATE_CAP = 1500  # tenders pulled from the database before ranking
DESCRIPTION_CHARS = 3000
SUMMARY_CHARS = 400
DISMISSED = {"ignored", "rejected"}

Sort = Literal["match", "deadline", "value"]


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _iso(dt: datetime | None) -> str | None:
    dt = _aware(dt)
    return dt.isoformat() if dt else None


def _cut(text: str | None, n: int) -> str | None:
    if not text:
        return None
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def _days_left(tender: Tender, now: datetime) -> int | None:
    deadline = _aware(tender.submission_deadline)
    return None if deadline is None else (deadline - now).days


def _states(session: Session, company: CompanyProfile | None) -> dict[tuple, UserTenderState]:
    if company is None:
        return {}
    return {
        (s.tender_source_system, s.tender_external_id): s
        for s in session.exec(
            select(UserTenderState).where(UserTenderState.company_id == company.id)
        ).all()
    }


def _item(tender: Tender, state: UserTenderState | None, now: datetime) -> dict:
    return {
        "id": tender.external_id,
        "title": tender.ai_title_simplified or tender.title,
        "original_title": tender.title if tender.ai_title_simplified else None,
        "authority": tender.contracting_authority,
        "county": tender.county,
        "country": tender.country_code,
        "cpv_codes": tender.cpv_codes,
        "estimated_value": tender.estimated_value,
        "currency": tender.currency,
        "published": _iso(tender.publication_date),
        "deadline": _iso(tender.submission_deadline),
        "days_left": _days_left(tender, now),
        "procedure": tender.procedure_type,
        "match_score": state.score if state else None,
        "match_reasons": (state.score_reasons if state else [])[:5],
        "eligible": state.eligible if state else None,
        "status": state.status if state else "new",
        "summary": _cut(tender.summary_en, SUMMARY_CHARS),
        "url": tender.source_url,
    }


def profile(company: CompanyProfile | None) -> dict:
    """The user's saved filters, i.e. what 'matching tenders' means for them."""
    if company is None:
        return {
            "company": None,
            "note": "No company profile yet — finish onboarding in the web app so tenders can be matched.",
        }
    completeness = profile_completeness(company)
    return {
        "company": company.name,
        "company_id": company.id,
        "industry": company.industry,
        "cpv_codes": company.cpv_codes,
        "secondary_cpv_codes": company.secondary_cpv_codes,
        "keywords": company.keywords,
        "excluded_keywords": company.blacklist_keywords,
        "target_countries": company.target_countries,
        "annual_capacity": company.annual_capacity,
        "annual_capacity_currency": company.annual_capacity_currency,
        "annual_turnover": company.annual_turnover,
        "annual_turnover_currency": company.annual_turnover_currency,
        "certifications": company.certifications,
        "profile_complete": completeness["complete"],
        "missing_fields": completeness["missing_required"],
    }


def search(
    session: Session,
    company: CompanyProfile | None,
    *,
    query: str | None = None,
    county: str | None = None,
    cpv: str | None = None,
    procedure_type: str | None = None,
    min_value: float | None = None,
    max_value: float | None = None,
    min_score: int | None = None,
    eligible: bool | None = None,
    deadline_within_days: int | None = None,
    min_days_left: int | None = None,
    include_closed: bool = False,
    include_dismissed: bool = False,
    sort: Sort = "match",
    limit: int = 10,
    offset: int = 0,
) -> dict:
    limit = max(1, min(limit, MAX_LIMIT))
    offset = max(0, offset)
    now = datetime.now(UTC)

    stmt = select(Tender)
    if not include_closed:
        stmt = stmt.where(or_(Tender.submission_deadline == None, Tender.submission_deadline >= now))
    if min_days_left:
        # Enough time left to actually prepare a bid.
        stmt = stmt.where(Tender.submission_deadline >= now + timedelta(days=min_days_left))
    if deadline_within_days is not None:
        stmt = stmt.where(
            Tender.submission_deadline >= now,
            Tender.submission_deadline <= now + timedelta(days=max(0, deadline_within_days)),
        )
    if county:
        stmt = stmt.where(Tender.county.ilike(county.strip()))
    if cpv:
        # Any CPV on the notice that starts with the given code or division ("45", "45233").
        stmt = stmt.where(cast(Tender.cpv_codes, String).like(f'%"{cpv.strip()}%'))
    if procedure_type:
        stmt = stmt.where(Tender.procedure_type == procedure_type)
    if min_value is not None:
        stmt = stmt.where(Tender.estimated_value >= min_value)
    if max_value is not None:
        stmt = stmt.where(Tender.estimated_value <= max_value)
    if query:
        for word in query.split()[:6]:
            like = f"%{word}%"
            stmt = stmt.where(
                or_(
                    Tender.title.ilike(like),
                    Tender.ai_title_simplified.ilike(like),
                    Tender.summary_en.ilike(like),
                    Tender.contracting_authority.ilike(like),
                )
            )
    stmt = stmt.order_by(Tender.submission_deadline.is_(None), Tender.submission_deadline).limit(CANDIDATE_CAP)
    tenders = session.exec(stmt).all()

    states = _states(session, company)
    if company is not None:
        score_jobs.score_unscored(session, company, tenders, states)

    rows = []
    for tender in tenders:
        state = states.get((tender.source_system, tender.external_id))
        if not include_dismissed and state is not None and state.status in DISMISSED:
            continue
        if min_score is not None and (state is None or state.score is None or state.score < min_score):
            continue
        if eligible is not None and (state is None or state.eligible != eligible):
            continue
        rows.append((tender, state))

    def key(row: tuple[Tender, UserTenderState | None]):
        tender, state = row
        if sort == "deadline":
            return (tender.submission_deadline is None, _aware(tender.submission_deadline) or now, tender.external_id)
        if sort == "value":
            return (tender.estimated_value is None, -(tender.estimated_value or 0), tender.external_id)
        score = state.score if state else None
        return (score is None, -(score or 0), tender.external_id)

    rows.sort(key=key)
    page = rows[offset : offset + limit]
    return {
        "total_matches": len(rows),
        "returned": len(page),
        "offset": offset,
        "sorted_by": sort,
        "ranked_for": company.name if company else None,
        "tenders": [_item(t, s, now) for t, s in page],
    }


def get_tender(session: Session, company: CompanyProfile | None, external_id: str) -> dict | None:
    tender = next(
        iter(session.exec(select(Tender).where(Tender.external_id == external_id)).all()), None
    )
    if tender is None:
        return None
    now = datetime.now(UTC)
    states = _states(session, company)
    if company is not None:
        score_jobs.score_unscored(session, company, [tender], states)
    state = states.get((tender.source_system, tender.external_id))
    item = _item(tender, state, now)
    item.update(
        {
            "notice_no": tender.notice_no,
            "clarification_deadline": _iso(tender.clarification_deadline),
            "description": _cut(tender.raw_description, DESCRIPTION_CHARS),
            "requirements": summarize_requirements(tender.extracted_requirements),
            "matched_requirements": state.matched_requirements if state else [],
            "unmet_requirements": state.unmet_requirements if state else [],
            "missing_documents": missing_documents_for(tender.extracted_requirements, company),
            "eligibility_note": state.eligibility_justification if state else None,
            "ai_assessment": state.ai_summary if state else None,
            "all_match_reasons": state.score_reasons if state else [],
        }
    )
    return item


def deadlines(
    session: Session,
    company: CompanyProfile | None,
    *,
    within_days: int = 14,
    followed_only: bool = True,
    limit: int = 20,
) -> dict:
    """Tenders closing soon. By default only the ones the user is working on
    (Preparing / Applied); with followed_only=False, every open tender in the
    window that matches their profile."""
    now = datetime.now(UTC)
    states = _states(session, company)
    limit = max(1, min(limit, MAX_LIMIT))
    stmt = (
        select(Tender)
        .where(
            Tender.submission_deadline >= now,
            Tender.submission_deadline <= now + timedelta(days=max(1, within_days)),
        )
        .order_by(Tender.submission_deadline)
        .limit(CANDIDATE_CAP)
    )
    tenders = session.exec(stmt).all()
    if company is not None and not followed_only:
        score_jobs.score_unscored(session, company, tenders, states)
    out = []
    for tender in tenders:
        state = states.get((tender.source_system, tender.external_id))
        if followed_only:
            if state is None or state.status not in ("reviewing", "applied"):
                continue
        elif state is None or (state.score or 0) < 40 or state.status in DISMISSED:
            continue
        out.append(_item(tender, state, now))
    return {"within_days": within_days, "followed_only": followed_only, "tenders": out[:limit]}


def pipeline(session: Session, company: CompanyProfile | None) -> dict:
    """The user's own board: tenders they marked as preparing, applied, etc."""
    if company is None:
        return {"columns": {}}
    now = datetime.now(UTC)
    states = _states(session, company)
    wanted = {k: s for k, s in states.items() if s.status != "new"}
    tenders = {
        t.external_id: t
        for t in session.exec(
            select(Tender).where(Tender.external_id.in_([k[1] for k in wanted]))
        ).all()
    }
    columns: dict[str, list[dict]] = {}
    for (_, ext_id), state in wanted.items():
        tender = tenders.get(ext_id)
        if tender is not None:
            columns.setdefault(state.status, []).append(_item(tender, state, now))
    for items in columns.values():
        items.sort(key=lambda i: (i["deadline"] is None, i["deadline"] or ""))
    return {"columns": columns}
