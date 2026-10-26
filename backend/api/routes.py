from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from adapters.romania_seap.adapter import RomaniaSeapAdapter
from ai.client import (
    ExtractedRequirements,
    MetaAIClient,
    build_company_summary,
    build_tender_summary,
)
from core.eligibility import run_numeric_checks
from core.scoring import AI_SCORE_THRESHOLD, evaluate
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
from models.user_tender_state import UserTenderState

router = APIRouter()


@router.get("/tenders", response_model=list[Tender])
def list_tenders(session: Session = Depends(get_session)) -> list[Tender]:
    return list(session.exec(select(Tender)))


@router.post("/tenders/sync/romania", response_model=list[Tender])
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


@router.post("/companies", response_model=CompanyProfile)
def create_company(company: CompanyProfile, session: Session = Depends(get_session)) -> CompanyProfile:
    company.id = None
    session.add(company)
    session.commit()
    session.refresh(company)
    return company


@router.get("/companies", response_model=list[CompanyProfile])
def list_companies(session: Session = Depends(get_session)) -> list[CompanyProfile]:
    return list(session.exec(select(CompanyProfile)))


@router.post("/companies/{company_id}/score", response_model=list[UserTenderState])
def score_tenders_for_company(
    company_id: int, session: Session = Depends(get_session)
) -> list[UserTenderState]:
    """Score every stored tender against one company profile and persist
    the result. Safe to re-run: upsert_score only ever touches score
    fields, never the AI/eligibility fields other steps will fill in."""
    company = session.get(CompanyProfile, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

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


@router.post("/companies/{company_id}/enrich", response_model=list[UserTenderState])
async def enrich_tenders_for_company(
    company_id: int,
    limit: int = 20,
    language: str = "en",
    session: Session = Depends(get_session),
) -> list[UserTenderState]:
    """Call the AI layer for tenders that scored high enough to be worth it
    and don't have a summary yet (cost control, same spirit as the scoring
    threshold: don't spend an AI call on something already filtered out).
    `limit` caps how many calls this request makes."""
    company = session.get(CompanyProfile, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

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


@router.post("/tenders/romania/{external_id}/extract", response_model=Tender)
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
    "/companies/{company_id}/tenders/romania/{external_id}/eligibility",
    response_model=UserTenderState,
)
async def check_tender_eligibility(
    company_id: int, external_id: str, session: Session = Depends(get_session)
) -> UserTenderState:
    """Compare one tender's extracted requirements against one company
    profile. Turnover/similar-experience-value are checked deterministically
    in core.eligibility first; the AI layer gets those results as given
    facts and only has to reason about certification matching and the
    final justification — not redo arithmetic."""
    company = session.get(CompanyProfile, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
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
