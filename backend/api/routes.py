from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlmodel import Session, func, select

from adapters.romania_seap.adapter import RomaniaSeapAdapter
from ai.client import (
    ExtractedRequirements,
    MetaAIClient,
    build_company_summary,
    build_tender_summary,
)
from api.schemas import (
    AuthorityHistory,
    AuthorizationPatch,
    CompanyDetail,
    CompanyOptions,
    CompanyPage,
    CompanyPatch,
    CountryAuthorizationItem,
    CountryOption,
    CountryRequirements,
    EvidenceItem,
    IndustryOption,
    KeywordOption,
    OcrJobResponse,
    OnboardingStatus,
    RenewalPattern,
    TenderFeedItem,
    TenderStatePatch,
    TenderWithState,
    TenderWithStatePage,
)
from core.authorizations import (
    authorization_status_map,
    ensure_authorization_rows,
    list_authorizations,
    normalize_country_code,
    upsert_authorization,
)
from core.caiet_jobs import create_job, get_active_job, get_latest_job, run_caiet_job
from core.country_requirements import get_country_requirements
from core.eligibility import run_numeric_checks
from core.history import authority_history, renewal_pattern
from core.lookups import (
    COUNTRIES,
    INDUSTRIES,
    KEYWORDS,
    OPTIONAL_PROFILE_FIELDS,
    REQUIRED_PROFILE_FIELDS,
    apply_industry_preseed,
    profile_completeness,
    validate_company_data,
)
from core.membership import (
    get_request_user,
    link_user_company,
    require_company,
    resolve_user_company,
    user_companies,
)
from core.scoring import AI_SCORE_THRESHOLD, evaluate
from core.security import get_current_user
from db import (
    get_session,
    upsert_ai_justification,
    upsert_eligibility,
    upsert_score,
    upsert_tender_extraction,
    upsert_tender_title,
    upsert_tenders,
)
from models.company import CompanyProfile
from models.tender import SourceSystem, Tender
from models.user import User
from models.user_tender_state import UserTenderState

VALID_STATUSES = {"new", "reviewing", "applied", "rejected", "ignored"}

router = APIRouter(dependencies=[Depends(get_current_user)])


def _resolve_company(
    session: Session, user: User, company_id: int | None
) -> CompanyProfile | None:
    """Explicit company (membership-checked, 403 for strangers) or the
    user's first one. None only when the user has no company yet."""
    return resolve_user_company(session, user, company_id)


def _validated_company_data(data: dict) -> None:
    try:
        validate_company_data(data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None


def _sort_key(sort: str, item: TenderFeedItem) -> tuple:
    if sort == "deadline":
        return (item.submission_deadline is None, item.submission_deadline or "", item.external_id)
    if sort == "value":
        return (item.estimated_value is None, -(item.estimated_value or 0), item.external_id)
    return (item.state.score is None, -(item.state.score or 0), item.external_id)


@router.get("/tenders", response_model=list[TenderFeedItem], tags=["tenders"])
def list_tenders(
    company_id: int | None = None,
    county: str | None = None,
    cpv_code: str | None = None,
    min_value: float | None = None,
    min_score: int | None = None,
    procedure_type: str | None = None,
    eligible: bool | None = None,
    authorization_status: str | None = None,
    search: str | None = None,
    sort: Literal["match", "deadline", "value"] = "match",
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> list[TenderFeedItem]:
    """The frontend feed (Opportunities + Kanban source): every stored
    tender with its per-company state nested in, filterable and sortable.
    Bare array — matches lib/types.ts TenderWithState[] one to one. State
    is always the caller's own company — strangers' scores never leak.
    Country authorization rides along as pure information: the feed never
    hides tenders for it unless the caller opts in via authorization_status."""
    company = _resolve_company(session, user, company_id)

    query = select(Tender)
    if county:
        query = query.where(Tender.county == county)
    if cpv_code:
        # cpv_codes is a JSON array column; this matches it as the main CPV
        # (index 0) via a LIKE on its JSON text — a real CPV index would be
        # cleaner, but this covers the common case without one.
        query = query.where(Tender.cpv_codes.like(f'["{cpv_code}"%'))
    if min_value is not None:
        query = query.where(Tender.estimated_value >= min_value)
    if procedure_type:
        query = query.where(Tender.procedure_type == procedure_type)
    if search:
        query = query.where(Tender.title.ilike(f"%{search}%"))

    tenders = session.exec(query).all()
    states: dict[tuple, UserTenderState] = {}
    auth_map: dict[str, str] = {}
    if company is not None:
        for state in session.exec(
            select(UserTenderState).where(UserTenderState.company_id == company.id)
        ).all():
            states[(state.tender_source_system, state.tender_external_id)] = state
        auth_map = authorization_status_map(session, company.id)

    items = [
        TenderFeedItem.from_triple(
            tender,
            states.get((tender.source_system, tender.external_id)),
            company,
            auth_map.get(tender.country_code),
        )
        for tender in tenders
    ]
    if min_score is not None:
        items = [i for i in items if i.state.score is not None and i.state.score >= min_score]
    if eligible is not None:
        items = [i for i in items if i.state.eligible == eligible]
    if authorization_status is not None:
        items = [i for i in items if i.state.country_authorization_status == authorization_status]
    items.sort(key=lambda i: _sort_key(sort, i))
    return items[offset : offset + limit]


@router.get("/tenders/{external_id}", response_model=TenderFeedItem, tags=["tenders"])
def get_tender(
    external_id: str,
    company_id: int | None = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> TenderFeedItem:
    """One tender + nested state, for the Tender Analysis screen. Romania
    only for now — external_id is unique within that one source."""
    tender = session.get(Tender, (SourceSystem.ROMANIA_SEAP, external_id))
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    company = _resolve_company(session, user, company_id)
    state = None
    auth_map: dict[str, str] = {}
    if company is not None:
        state = session.exec(
            select(UserTenderState).where(
                UserTenderState.company_id == company.id,
                UserTenderState.tender_source_system == tender.source_system,
                UserTenderState.tender_external_id == tender.external_id,
            )
        ).first()
        auth_map = authorization_status_map(session, company.id)
    renewal = renewal_pattern(session, tender)
    return TenderFeedItem.from_triple(
        tender,
        state,
        company,
        auth_map.get(tender.country_code),
        RenewalPattern(**renewal) if renewal else None,
    )


@router.get(
    "/tenders/{external_id}/authority-history",
    response_model=AuthorityHistory,
    tags=["tenders"],
)
def get_authority_history(
    external_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> AuthorityHistory:
    """Incumbent lens for one tender's buyer: notice volume plus the
    award/winner breakdown in the same (authority, CPV division) pair.
    Global data (no company scoping) — auth only gates the caller."""
    tender = session.get(Tender, (SourceSystem.ROMANIA_SEAP, external_id))
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    return AuthorityHistory(**authority_history(session, tender))


@router.patch(
    "/tenders/{external_id}/status", response_model=TenderFeedItem, tags=["tenders"]
)
def update_tender_status_simple(
    external_id: str,
    patch: TenderStatePatch,
    company_id: int | None = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> TenderFeedItem:
    """Kanban write path: same semantics as the company-scoped PATCH below
    (status/note only, 404 when the tender was never scored for this
    company), without the company id in the URL."""
    if patch.status is not None and patch.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422, detail=f"status must be one of {sorted(VALID_STATUSES)}"
        )
    company = _resolve_company(session, user, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="No company yet")
    tender = session.get(Tender, (SourceSystem.ROMANIA_SEAP, external_id))
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    state = session.exec(
        select(UserTenderState).where(
            UserTenderState.company_id == company.id,
            UserTenderState.tender_source_system == tender.source_system,
            UserTenderState.tender_external_id == tender.external_id,
        )
    ).first()
    if not state:
        raise HTTPException(
            status_code=404, detail="No state for this tender/company — call /score first"
        )
    if patch.status is not None:
        state.status = patch.status
    if patch.note is not None:
        state.note = patch.note
    session.add(state)
    session.commit()
    session.refresh(state)
    auth_map = authorization_status_map(session, company.id)
    return TenderFeedItem.from_triple(
        tender, state, company, auth_map.get(tender.country_code)
    )


@router.get("/company", response_model=CompanyDetail, tags=["companies"])
def get_company_single(
    company_id: int | None = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> CompanyDetail:
    """The caller's company profile (first one, or the requested one).
    404 until the onboarding wizard creates one via POST /company."""
    company = _resolve_company(session, user, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="No company yet — complete onboarding via POST /company")
    return CompanyDetail.from_profile(company)


@router.post("/company", response_model=CompanyDetail, status_code=201, tags=["companies"])
def create_own_company(
    company: CompanyProfile,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> CompanyDetail:
    """Onboarding step 1: create the caller's company with just a name
    (everything else arrives via PATCH /company step by step) and link it
    as owner. An industry given here pre-seeds CPV codes when none are."""
    if not company.name.strip():
        raise HTTPException(status_code=422, detail="Company name must not be blank")
    _validated_company_data(company.model_dump())
    apply_industry_preseed(company)
    company.id = None
    session.add(company)
    session.commit()
    session.refresh(company)
    link_user_company(session, user.id, company.id)
    ensure_authorization_rows(session, company.id, company.target_countries or [])
    session.refresh(company)  # link commit expires attrs; reload before serializing
    return CompanyDetail.from_profile(company)


@router.patch("/company", response_model=CompanyDetail, tags=["companies"])
def patch_own_company(
    patch: CompanyPatch,
    company_id: int | None = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> CompanyDetail:
    """Onboarding steps 2..N: partial update — only provided keys are
    applied, so wizard steps never clobber each other."""
    company = _resolve_company(session, user, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="No company yet — create one via POST /company")
    data = patch.model_dump(exclude_unset=True)
    _validated_company_data(data)
    if "name" in data and not (data["name"] or "").strip():
        raise HTTPException(status_code=422, detail="Company name must not be blank")
    for key, value in data.items():
        setattr(company, key, value)
    if "industry" in data and "cpv_codes" not in data:
        apply_industry_preseed(company)
    session.add(company)
    session.commit()
    session.refresh(company)
    if "target_countries" in data:
        ensure_authorization_rows(session, company.id, data["target_countries"] or [])
    return CompanyDetail.from_profile(company)


@router.get(
    "/company/authorizations",
    response_model=list[CountryAuthorizationItem],
    tags=["companies"],
)
def list_own_authorizations(
    company_id: int | None = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> list[CountryAuthorizationItem]:
    """The caller's per-country bidding-readiness rows (self-declared —
    never system-verified). Rows exist for picked target countries plus
    any country opened proactively via the PATCH below."""
    company = _resolve_company(session, user, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="No company yet — create one via POST /company")
    return [
        CountryAuthorizationItem(
            country_code=row.country_code,
            status=row.status,
            requirement_notes=row.requirement_notes,
            updated_at=row.updated_at,
        )
        for row in list_authorizations(session, company.id)
    ]


@router.patch(
    "/company/authorizations/{country_code}",
    response_model=CountryAuthorizationItem,
    tags=["companies"],
)
def upsert_own_authorization(
    country_code: str,
    patch: AuthorizationPatch,
    company_id: int | None = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> CountryAuthorizationItem:
    """Create-or-update one country row: status and/or notes. Only
    provided fields change. Works for target and non-target countries."""
    company = _resolve_company(session, user, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="No company yet — create one via POST /company")
    try:
        row = upsert_authorization(
            session, company.id, country_code, patch.status, patch.requirement_notes
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    return CountryAuthorizationItem(
        country_code=row.country_code,
        status=row.status,
        requirement_notes=row.requirement_notes,
        updated_at=row.updated_at,
    )


@router.get(
    "/countries/{country_code}/requirements",
    response_model=CountryRequirements,
    tags=["countries"],
)
def get_country_requirements_route(country_code: str) -> CountryRequirements:
    """Static bidding-requirements reference per country. Romania carries
    a real write-up; everything else is an honest placeholder until its
    adapter extension lands. General information, never legal advice."""
    try:
        code = normalize_country_code(country_code)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    return CountryRequirements(**get_country_requirements(code))


@router.get("/company/onboarding-status", response_model=OnboardingStatus, tags=["companies"])
def get_onboarding_status(
    company_id: int | None = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> OnboardingStatus:
    """Where the wizard stands: which minimum-viable fields (name,
    industry, annual_turnover — the eligibility engine can't run without
    them) and which optional fields are still missing."""
    company = _resolve_company(session, user, company_id)
    if company is None:
        return OnboardingStatus(
            company_id=None,
            complete=False,
            required=REQUIRED_PROFILE_FIELDS,
            optional=OPTIONAL_PROFILE_FIELDS,
            missing_required=REQUIRED_PROFILE_FIELDS,
            missing_optional=OPTIONAL_PROFILE_FIELDS,
        )
    status = profile_completeness(company)
    return OnboardingStatus(
        company_id=company.id,
        complete=status["complete"],
        required=REQUIRED_PROFILE_FIELDS,
        optional=OPTIONAL_PROFILE_FIELDS,
        missing_required=status["missing_required"],
        missing_optional=status["missing_optional"],
    )


@router.get("/company/options", response_model=CompanyOptions, tags=["companies"])
def get_company_options() -> CompanyOptions:
    """Wizard dropdown contents from the backend (never hardcoded in the
    frontend): industries with CPV pre-mapping, tender keywords with their
    CPV groups, and the adapter-backed country list."""
    return CompanyOptions(
        industries=[
            IndustryOption(
                key=i.key, label=i.label, suggested_cpv_codes=i.suggested_cpv_codes
            )
            for i in INDUSTRIES.values()
        ],
        keywords=[
            KeywordOption(key=k.key, label=k.label, related_cpv_codes=k.related_cpv_codes)
            for k in KEYWORDS.values()
        ],
        countries=[
            CountryOption(code=c.code, name=c.name, source_systems=c.source_systems)
            for c in COUNTRIES
        ],
    )


@router.get("/company/evidence", response_model=list[EvidenceItem], tags=["companies"])
def get_company_evidence(
    company_id: int | None = None,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> list[EvidenceItem]:
    """Qualification evidence derived from the company profile's own
    certification list (a real document vault with expiry tracking is
    future work — see API_CHANGES.md)."""
    company = _resolve_company(session, user, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="No company yet — complete onboarding via POST /company")
    return [
        EvidenceItem(id=f"cert-{i}", name=name, type="Certification", valid_until=None)
        for i, name in enumerate(company.certifications, start=1)
    ]


@router.post("/tenders/sync/romania", response_model=list[Tender], tags=["tenders"])
async def sync_romania_tenders(
    cpv_codes: list[str] | None = Query(default=None),
    keywords: list[str] | None = Query(default=None),
    days: int = 30,
    session: Session = Depends(get_session),
) -> list[Tender]:
    adapter = RomaniaSeapAdapter()
    tenders = await adapter.fetch_tenders(cpv_codes=cpv_codes, keywords=keywords, days=days)
    upsert_tenders(session, tenders)
    return tenders


@router.post("/companies", response_model=CompanyProfile, tags=["companies"])
def create_company(
    company: CompanyProfile,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> CompanyProfile:
    _validated_company_data(company.model_dump())
    apply_industry_preseed(company)
    company.id = None
    session.add(company)
    session.commit()
    session.refresh(company)
    link_user_company(session, user.id, company.id)
    ensure_authorization_rows(session, company.id, company.target_countries or [])
    session.refresh(company)  # link commit expires attrs; reload before serializing
    return company


@router.get("/companies", response_model=CompanyPage, tags=["companies"])
def list_companies(
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> CompanyPage:
    items = user_companies(session, user.id)
    return CompanyPage(items=items, total=len(items))


@router.get("/companies/{company_id}", response_model=CompanyProfile, tags=["companies"])
def get_company(
    company_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> CompanyProfile:
    return require_company(session, user, company_id)


@router.patch("/companies/{company_id}", response_model=CompanyProfile, tags=["companies"])
def update_company(
    company_id: int,
    patch: CompanyProfile,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> CompanyProfile:
    """Full-profile update (send the complete object, like PUT) — simplest
    option for a hackathon demo's edit-profile form. id is taken from the
    URL, not the body."""
    company = require_company(session, user, company_id)
    data = patch.model_dump(exclude={"id"})
    _validated_company_data(data)
    for key, value in data.items():
        setattr(company, key, value)
    session.add(company)
    session.commit()
    session.refresh(company)
    ensure_authorization_rows(session, company.id, company.target_countries or [])
    return company


@router.get("/companies/{company_id}/tenders", response_model=TenderWithStatePage, tags=["companies"])
def list_company_tenders(
    company_id: int,
    status: str | None = None,
    eligible: bool | None = None,
    min_score: int | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> TenderWithStatePage:
    """The frontend's main feed: every tender this company has been scored
    against, with its score/AI/eligibility output and user status/note
    flattened in. Run /score (and /enrich, /extract + eligibility) first —
    a tender never scored for this company won't show up here."""
    require_company(session, user, company_id)

    query = select(UserTenderState).where(UserTenderState.company_id == company_id)
    if status:
        query = query.where(UserTenderState.status == status)
    if eligible is not None:
        query = query.where(UserTenderState.eligible == eligible)
    if min_score is not None:
        query = query.where(UserTenderState.score >= min_score)

    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    states = session.exec(
        query.order_by(UserTenderState.score.desc()).offset(offset).limit(limit)
    ).all()

    items = []
    for state in states:
        tender = session.get(Tender, (state.tender_source_system, state.tender_external_id))
        if tender:
            items.append(TenderWithState.from_pair(tender, state))

    return TenderWithStatePage(items=items, total=total, limit=limit, offset=offset)


@router.patch(
    "/companies/{company_id}/tenders/romania/{external_id}",
    response_model=TenderWithState,
    tags=["companies"],
)
def update_tender_status(
    company_id: int,
    external_id: str,
    patch: TenderStatePatch,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> TenderWithState:
    """User-driven status/note update — the only writer of these two
    fields; no automated step touches them."""
    if patch.status is not None and patch.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422, detail=f"status must be one of {sorted(VALID_STATUSES)}"
        )
    require_company(session, user, company_id)

    state = session.exec(
        select(UserTenderState).where(
            UserTenderState.company_id == company_id,
            UserTenderState.tender_source_system == SourceSystem.ROMANIA_SEAP,
            UserTenderState.tender_external_id == external_id,
        )
    ).first()
    if not state:
        raise HTTPException(
            status_code=404, detail="No state for this tender/company — call /score first"
        )

    if patch.status is not None:
        state.status = patch.status
    if patch.note is not None:
        state.note = patch.note
    session.add(state)
    session.commit()
    session.refresh(state)

    tender = session.get(Tender, (SourceSystem.ROMANIA_SEAP, external_id))
    return TenderWithState.from_pair(tender, state)


@router.post("/companies/{company_id}/score", response_model=list[UserTenderState], tags=["companies"])
def score_tenders_for_company(
    company_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> list[UserTenderState]:
    """Score every stored tender against one company profile and persist
    the result. Safe to re-run: upsert_score only ever touches score
    fields, never the AI/eligibility fields other steps will fill in."""
    company = require_company(session, user, company_id)

    tenders = session.exec(select(Tender)).all()
    for tender in tenders:
        result = evaluate(tender, company)
        upsert_score(
            session,
            tender_source_system=tender.source_system,
            tender_external_id=tender.external_id,
            company_id=company.id,
            score=result.score,
            reasons=result.reasons,
        )

    return list(
        session.exec(
            select(UserTenderState)
            .where(UserTenderState.company_id == company_id)
            .order_by(UserTenderState.score.desc())
        )
    )


@router.post(
    "/companies/{company_id}/enrich", response_model=list[UserTenderState], tags=["companies"]
)
async def enrich_tenders_for_company(
    company_id: int,
    limit: int = 20,
    language: str = "en",
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> list[UserTenderState]:
    """Call the AI layer for tenders that scored high enough to be worth it
    and don't have a summary yet (cost control, same spirit as the scoring
    threshold: don't spend an AI call on something already filtered out).
    `limit` caps how many calls this request makes."""
    company = require_company(session, user, company_id)

    candidates = session.exec(
        select(UserTenderState)
        .where(UserTenderState.company_id == company_id)
        .where(UserTenderState.score >= AI_SCORE_THRESHOLD)
        .where(UserTenderState.ai_summary.is_(None))
        .order_by(UserTenderState.score.desc())
        .limit(limit)
    ).all()

    if candidates:
        ai = MetaAIClient()
        company_summary = build_company_summary(company)
        for state in candidates:
            tender = session.get(
                Tender, (state.tender_source_system, state.tender_external_id)
            )
            if not tender:
                continue
            tender_summary = build_tender_summary(tender)
            summary = await ai.summarize_justification(
                tender_summary, company_summary, language=language
            )
            upsert_ai_justification(
                session,
                tender_source_system=tender.source_system,
                tender_external_id=tender.external_id,
                company_id=company.id,
                ai_summary=summary,
            )
            if not tender.ai_title_simplified:
                simplified_title = await ai.simplify_title(tender.title, language=language)
                upsert_tender_title(
                    session,
                    source_system=tender.source_system,
                    external_id=tender.external_id,
                    ai_title_simplified=simplified_title,
                )

    return list(
        session.exec(
            select(UserTenderState)
            .where(UserTenderState.company_id == company_id)
            .order_by(UserTenderState.score.desc())
        )
    )


@router.post("/tenders/romania/{external_id}/extract", response_model=Tender, tags=["tenders"])
async def extract_romania_tender_requirements(
    external_id: str, session: Session = Depends(get_session)
) -> Tender:
    """Fetch the real eligibility/qualification text from SEAP's detail
    endpoint and run it through the AI extraction layer. Idempotent: safe
    to re-run, it only ever touches extracted_requirements/
    extraction_confidence on this one tender."""
    tender = session.get(Tender, (SourceSystem.ROMANIA_SEAP, external_id))
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found — sync it first")
    if tender.notice_type_id is None:
        raise HTTPException(status_code=422, detail="Tender has no notice_type_id, can't fetch detail")

    adapter = RomaniaSeapAdapter()
    eligibility_text = await adapter.fetch_eligibility_text(external_id, tender.notice_type_id)
    if not eligibility_text:
        raise HTTPException(status_code=422, detail="SEAP returned no eligibility text for this tender")

    ai = MetaAIClient()
    extracted = await ai.extract_requirements(eligibility_text)
    upsert_tender_extraction(
        session,
        source_system=tender.source_system,
        external_id=tender.external_id,
        extracted_requirements=extracted.model_dump(exclude={"extraction_confidence"}),
        extraction_confidence=extracted.extraction_confidence,
    )
    return session.get(Tender, (SourceSystem.ROMANIA_SEAP, external_id))


@router.post(
    "/tenders/romania/{external_id}/extract-caiet",
    response_model=OcrJobResponse,
    status_code=202,
    tags=["tenders"],
)
async def extract_caiet_async(
    external_id: str,
    background_tasks: BackgroundTasks,
    response: Response,
    session: Session = Depends(get_session),
) -> OcrJobResponse:
    """Start async caiet extraction (download -> OCR -> requirements).
    Returns 202 with a pending job; poll the GET below. A fully-scanned
    caiet takes minutes, so this never blocks. Re-POSTing while a job is
    still active returns that job (200) instead of double-spending."""
    tender = session.get(Tender, (SourceSystem.ROMANIA_SEAP, external_id))
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found — sync it first")
    if tender.notice_type_id is None:
        raise HTTPException(status_code=422, detail="Tender has no notice_type_id, can't fetch files")

    active = get_active_job(session, tender.source_system, tender.external_id)
    if active is not None:
        response.status_code = 200
        return OcrJobResponse.from_job(active)

    job = create_job(session, tender.source_system, tender.external_id)
    background_tasks.add_task(run_caiet_job, job.id)
    return OcrJobResponse.from_job(job)


@router.get(
    "/tenders/romania/{external_id}/extract-caiet",
    response_model=OcrJobResponse,
    tags=["tenders"],
)
def get_caiet_job(
    external_id: str, session: Session = Depends(get_session)
) -> OcrJobResponse:
    """Latest caiet-extraction job for this tender: pending/running/done
    (+ result) /failed (+ error). 404 when never started."""
    job = get_latest_job(session, SourceSystem.ROMANIA_SEAP, external_id)
    if job is None:
        raise HTTPException(status_code=404, detail="No extraction job for this tender yet")
    return OcrJobResponse.from_job(job)


@router.post(
    "/companies/{company_id}/tenders/romania/{external_id}/eligibility",
    response_model=UserTenderState,
    tags=["companies"],
)
async def check_tender_eligibility(
    company_id: int,
    external_id: str,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> UserTenderState:
    """Compare one tender's extracted requirements against one company
    profile. Turnover/similar-experience-value are checked deterministically
    in core.eligibility first; the AI layer gets those results as given
    facts and only has to reason about certification matching and the
    final justification — not redo arithmetic. The company is always the
    caller's own — membership-checked, never a global singleton."""
    company = require_company(session, user, company_id)
    tender = session.get(Tender, (SourceSystem.ROMANIA_SEAP, external_id))
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")
    if not tender.extracted_requirements:
        raise HTTPException(
            status_code=422, detail="Tender has no extracted requirements yet — call /extract first"
        )

    extracted = ExtractedRequirements.model_validate(tender.extracted_requirements)
    numeric = run_numeric_checks(extracted, company)

    ai = MetaAIClient()
    verdict = await ai.compare_eligibility(extracted, numeric.as_text(), build_company_summary(company))

    upsert_eligibility(
        session,
        tender_source_system=tender.source_system,
        tender_external_id=tender.external_id,
        company_id=company.id,
        eligible=verdict.eligible,
        matched_requirements=verdict.matched_requirements,
        unmet_requirements=verdict.unmet_requirements,
        eligibility_justification=verdict.justification,
    )

    return session.exec(
        select(UserTenderState).where(
            UserTenderState.tender_source_system == tender.source_system,
            UserTenderState.tender_external_id == tender.external_id,
            UserTenderState.company_id == company.id,
        )
    ).one()
