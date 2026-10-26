"""Response shapes for the list/batch endpoints the frontend consumes.

TenderWithState flattens a Tender and its UserTenderState for one company
into a single object, so the frontend doesn't have to join two responses
client-side for its main feed.
"""

from datetime import datetime

from pydantic import BaseModel

from models.company import CompanyProfile
from models.tender import SourceSystem, Tender
from models.user_tender_state import UserTenderState


class TenderWithState(BaseModel):
    source_system: SourceSystem
    external_id: str
    country_code: str
    notice_no: str | None
    title: str
    contracting_authority: str | None
    cpv_codes: list[str]
    estimated_value: float | None
    currency: str | None
    publication_date: datetime | None
    submission_deadline: datetime | None
    source_url: str | None
    ai_title_simplified: str | None
    extracted_requirements: dict | None
    extraction_confidence: str | None

    score: int | None
    score_reasons: list[str]
    ai_summary: str | None
    eligible: bool | None
    matched_requirements: list[str]
    unmet_requirements: list[str]
    eligibility_justification: str | None
    status: str
    note: str | None
    updated_at: datetime

    @classmethod
    def from_pair(cls, tender: Tender, state: UserTenderState) -> "TenderWithState":
        return cls(
            source_system=tender.source_system,
            external_id=tender.external_id,
            country_code=tender.country_code,
            notice_no=tender.notice_no,
            title=tender.title,
            contracting_authority=tender.contracting_authority,
            cpv_codes=tender.cpv_codes,
            estimated_value=tender.estimated_value,
            currency=tender.currency,
            publication_date=tender.publication_date,
            submission_deadline=tender.submission_deadline,
            source_url=tender.source_url,
            ai_title_simplified=tender.ai_title_simplified,
            extracted_requirements=tender.extracted_requirements,
            extraction_confidence=tender.extraction_confidence,
            score=state.score,
            score_reasons=state.score_reasons or [],
            ai_summary=state.ai_summary,
            eligible=state.eligible,
            matched_requirements=state.matched_requirements or [],
            unmet_requirements=state.unmet_requirements or [],
            eligibility_justification=state.eligibility_justification,
            status=state.status,
            note=state.note,
            updated_at=state.updated_at,
        )


class TenderPage(BaseModel):
    items: list[Tender]
    total: int
    limit: int
    offset: int


class TenderWithStatePage(BaseModel):
    items: list[TenderWithState]
    total: int
    limit: int
    offset: int


class CompanyPage(BaseModel):
    items: list[CompanyProfile]
    total: int


class TenderStatePatch(BaseModel):
    status: str | None = None
    note: str | None = None
