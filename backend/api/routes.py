from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from adapters.romania_seap.adapter import RomaniaSeapAdapter
from core.scoring import evaluate
from db import get_session, upsert_score, upsert_tenders
from models.company import CompanyProfile
from models.tender import Tender
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
