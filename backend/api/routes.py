from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from adapters.romania_seap.adapter import RomaniaSeapAdapter
from db import get_session, upsert_tenders
from models.tender import Tender

router = APIRouter()


@router.get("/tenders", response_model=list[Tender])
def list_tenders(session: Session = Depends(get_session)) -> list[Tender]:
    return list(session.exec(select(Tender)))


@router.post("/tenders/sync/romania", response_model=list[Tender])
async def sync_romania_tenders(
    cpv_codes: list[str] | None = None,
    session: Session = Depends(get_session),
) -> list[Tender]:
    adapter = RomaniaSeapAdapter()
    tenders = await adapter.fetch_tenders(cpv_codes=cpv_codes)
    upsert_tenders(session, tenders)
    return tenders
