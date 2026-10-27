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


def summarize_requirements(extracted: dict | None) -> list[str]:
    """Flatten the structured extraction dict into the human-readable
    bullet lines the frontend's TenderState.extracted_requirements holds.
    Deterministic order: turnover, experience, certifications, guarantee,
    then the model's own other_requirements verbatim."""
    if not extracted:
        return []
    lines: list[str] = []
    turnover = extracted.get("minimum_annual_turnover")
    if turnover is not None:
        ccy = (extracted.get("turnover_currency") or "").strip()
        lines.append(f"Annual turnover ≥ {turnover:,.0f} {ccy}".rstrip())
    experience = extracted.get("similar_experience_minimum_value")
    if experience is not None:
        ccy = (extracted.get("similar_experience_minimum_value_currency") or "").strip()
        line = f"Similar contracts ≥ {experience:,.0f} {ccy}".rstrip()
        qualifiers = []
        if extracted.get("similar_experience_max_contracts") is not None:
            qualifiers.append(f"≤{extracted['similar_experience_max_contracts']} contracts")
        if extracted.get("similar_experience_years") is not None:
            qualifiers.append(f"last {extracted['similar_experience_years']}y")
        if qualifiers:
            line += f" ({', '.join(qualifiers)})"
        lines.append(line)
    lines.extend(extracted.get("required_certifications") or [])
    guarantee = extracted.get("guarantee_amount")
    if guarantee is not None:
        ccy = (extracted.get("guarantee_currency") or "").strip()
        lines.append(f"Bid guarantee {guarantee:,.0f} {ccy}".rstrip())
    lines.extend(extracted.get("other_requirements") or [])
    return lines


def missing_documents_for(
    extracted: dict | None, company: CompanyProfile | None
) -> list[str]:
    """Required certifications the company does not hold (case-insensitive).
    Without a company context there is nothing to compare against, so []."""
    required = (extracted or {}).get("required_certifications") or []
    if company is None:
        return []
    held = {c.strip().lower() for c in company.certifications}
    return [c for c in required if c.strip().lower() not in held]


class TenderFeedState(BaseModel):
    """Nested `state` of the frontend's TenderWithState (lib/types.ts)."""

    score: int | None
    score_reasons: list[str]
    ai_summary: str | None
    ai_title_simplified: str | None
    extracted_requirements: list[str]
    eligible: bool | None
    matched_requirements: list[str]
    unmet_requirements: list[str]
    missing_documents: list[str]
    eligibility_justification: str | None
    status: str


class TenderFeedItem(BaseModel):
    """The frontend feed shape: tender display fields + nested per-company
    state. Unknown display values degrade to "" (county/authority) or the
    documented "open" default (procedure_type) so the contract never breaks."""

    source_system: SourceSystem
    external_id: str
    country_code: str
    title: str
    cpv_codes: list[str]
    estimated_value: float | None
    currency: str | None
    publication_date: datetime | None
    submission_deadline: datetime | None
    raw_description: str | None
    source_url: str | None
    authority: str
    county: str
    procedure_type: str
    clarification_deadline: datetime | None
    state: TenderFeedState

    @classmethod
    def from_triple(
        cls,
        tender: Tender,
        state: UserTenderState | None,
        company: CompanyProfile | None,
    ) -> "TenderFeedItem":
        return cls(
            source_system=tender.source_system,
            external_id=tender.external_id,
            country_code=tender.country_code,
            title=tender.title,
            cpv_codes=tender.cpv_codes,
            estimated_value=tender.estimated_value,
            currency=tender.currency,
            publication_date=tender.publication_date,
            submission_deadline=tender.submission_deadline,
            raw_description=tender.raw_description,
            source_url=tender.source_url,
            authority=tender.contracting_authority or "",
            county=tender.county or "",
            procedure_type=tender.procedure_type or "open",
            clarification_deadline=tender.clarification_deadline,
            state=TenderFeedState(
                score=state.score if state else None,
                score_reasons=state.score_reasons if state else [],
                ai_summary=state.ai_summary if state else None,
                ai_title_simplified=tender.ai_title_simplified,
                extracted_requirements=summarize_requirements(
                    tender.extracted_requirements
                ),
                eligible=state.eligible if state else None,
                matched_requirements=state.matched_requirements if state else [],
                unmet_requirements=state.unmet_requirements if state else [],
                missing_documents=missing_documents_for(
                    tender.extracted_requirements, company
                ),
                eligibility_justification=(
                    state.eligibility_justification if state else None
                ),
                status=state.status if state else "new",
            ),
        )


class CompanyResponse(BaseModel):
    """Single-company view matching the frontend's CompanyProfile."""

    id: int
    name: str
    cui: str
    cpv_codes: list[str]
    annual_capacity: float | None
    certifications: list[str]
    blacklist_keywords: list[str]

    @classmethod
    def from_profile(cls, profile: CompanyProfile) -> "CompanyResponse":
        return cls(
            id=profile.id,
            name=profile.name,
            cui=profile.cui or "",
            cpv_codes=profile.cpv_codes,
            annual_capacity=profile.annual_capacity,
            certifications=profile.certifications,
            blacklist_keywords=profile.blacklist_keywords,
        )


class EvidenceItem(BaseModel):
    id: str
    name: str
    type: str
    valid_until: str | None = None
