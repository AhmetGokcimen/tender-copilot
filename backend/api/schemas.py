"""Response shapes for the list/batch endpoints the frontend consumes.

TenderWithState flattens a Tender and its UserTenderState for one company
into a single object, so the frontend doesn't have to join two responses
client-side for its main feed.
"""

from datetime import datetime

from pydantic import BaseModel

from backend.models.company import CompanyProfile
from backend.models.ocr_job import OcrJob
from backend.models.score_job import ScoreJob
from backend.models.tender import SourceSystem, Tender
from backend.models.user_tender_state import UserTenderState


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
    summary_en: str | None
    extracted_requirements: list[str]
    eligible: bool | None
    # Separate dimension from `eligible`: the company's self-declared
    # bidding readiness for THIS tender's country. None = no row opened
    # yet. The two are never folded into a combined boolean.
    country_authorization_status: str | None
    matched_requirements: list[str]
    unmet_requirements: list[str]
    missing_documents: list[str]
    eligibility_justification: str | None
    status: str


class RenewalPattern(BaseModel):
    """Recurrence guess for one tender (detail only — the feed leaves it
    null to avoid N+1 sibling queries). next_expected_date is an explicitly
    labeled estimate (see `note`), never a promise."""

    detected: bool
    confidence: str | None  # "high" | "medium" | "low"
    prior_count: int
    avg_interval_days: float | None
    next_expected_date: datetime | None
    note: str


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
    renewal_pattern: RenewalPattern | None = None

    @classmethod
    def from_triple(
        cls,
        tender: Tender,
        state: UserTenderState | None,
        company: CompanyProfile | None,
        authorization_status: str | None = None,
        renewal_pattern: RenewalPattern | None = None,
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
                summary_en=tender.summary_en,
                extracted_requirements=summarize_requirements(
                    tender.extracted_requirements
                ),
                eligible=state.eligible if state else None,
                country_authorization_status=authorization_status,
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
            renewal_pattern=renewal_pattern,
        )


class CompanyDetail(BaseModel):
    """Full company profile for the onboarding wizard and profile screens.
    A superset of the frontend's CompanyProfile — extra keys are ignored
    by TS structural typing, so this stays contract-compatible."""

    id: int
    name: str
    cui: str
    industry: str | None
    founded_year: int | None
    team_size: int | None
    cpv_codes: list[str]
    secondary_cpv_codes: list[str]
    annual_capacity: float | None
    certifications: list[str]
    blacklist_keywords: list[str]
    annual_turnover: float | None
    annual_turnover_currency: str | None
    similar_experience_value: float | None
    similar_experience_currency: str | None
    similar_experience_contract_count: int | None
    target_countries: list[str]
    keywords: list[str]
    website: str | None
    subsectors: list[str]
    annual_capacity_currency: str | None
    team_eu_count: int | None
    team_non_eu_count: int | None

    @classmethod
    def from_profile(cls, profile: CompanyProfile) -> "CompanyDetail":
        return cls(
            id=profile.id,
            name=profile.name,
            cui=profile.cui or "",
            industry=profile.industry,
            founded_year=profile.founded_year,
            team_size=profile.team_size,
            cpv_codes=profile.cpv_codes,
            secondary_cpv_codes=profile.secondary_cpv_codes,
            annual_capacity=profile.annual_capacity,
            certifications=profile.certifications,
            blacklist_keywords=profile.blacklist_keywords,
            annual_turnover=profile.annual_turnover,
            annual_turnover_currency=profile.annual_turnover_currency,
            similar_experience_value=profile.similar_experience_value,
            similar_experience_currency=profile.similar_experience_currency,
            similar_experience_contract_count=profile.similar_experience_contract_count,
            target_countries=profile.target_countries,
            keywords=profile.keywords,
            website=profile.website,
            subsectors=profile.subsectors or [],
            annual_capacity_currency=profile.annual_capacity_currency,
            team_eu_count=profile.team_eu_count,
            team_non_eu_count=profile.team_non_eu_count,
        )


class CompanyPatch(BaseModel):
    """One wizard step: every field optional, only provided keys are
    applied (exclude_unset) — untouched steps never clobber each other."""

    name: str | None = None
    cui: str | None = None
    industry: str | None = None
    founded_year: int | None = None
    team_size: int | None = None
    cpv_codes: list[str] | None = None
    secondary_cpv_codes: list[str] | None = None
    annual_capacity: float | None = None
    certifications: list[str] | None = None
    blacklist_keywords: list[str] | None = None
    annual_turnover: float | None = None
    annual_turnover_currency: str | None = None
    similar_experience_value: float | None = None
    similar_experience_currency: str | None = None
    similar_experience_contract_count: int | None = None
    target_countries: list[str] | None = None
    keywords: list[str] | None = None
    website: str | None = None
    subsectors: list[str] | None = None
    annual_capacity_currency: str | None = None
    team_eu_count: int | None = None
    team_non_eu_count: int | None = None


class OnboardingStatus(BaseModel):
    company_id: int | None
    complete: bool
    required: list[str]
    optional: list[str]
    missing_required: list[str]
    missing_optional: list[str]


class IndustryOption(BaseModel):
    key: str
    label: str
    suggested_cpv_codes: list[str]


class KeywordOption(BaseModel):
    key: str
    label: str
    related_cpv_codes: list[str]


class CountryOption(BaseModel):
    code: str
    name: str
    source_systems: list[str]


class CountryAuthorizationItem(BaseModel):
    country_code: str
    status: str  # not_started | in_progress | obtained (self-declared)
    requirement_notes: str | None
    updated_at: datetime


class AuthorizationPatch(BaseModel):
    status: str | None = None
    requirement_notes: str | None = None


class CountryRequirements(BaseModel):
    country_code: str
    name: str | None
    guide_available: bool
    guidance: str


class CompanyOptions(BaseModel):
    industries: list[IndustryOption]
    keywords: list[KeywordOption]
    countries: list[CountryOption]


class EvidenceItem(BaseModel):
    id: str
    name: str
    type: str
    valid_until: str | None = None


class OcrJobResponse(BaseModel):
    job_id: int
    tender_source_system: SourceSystem
    tender_external_id: str
    status: str  # pending | running | done | failed
    result: dict | None
    error: str | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_job(cls, job: OcrJob) -> "OcrJobResponse":
        return cls(
            job_id=job.id,
            tender_source_system=job.tender_source_system,
            tender_external_id=job.tender_external_id,
            status=job.status,
            result=job.result,
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )


class ScoreJobResponse(BaseModel):
    job_id: int
    company_id: int
    status: str  # pending | running | done | failed
    total: int
    processed: int
    error: str | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_job(cls, job: ScoreJob) -> "ScoreJobResponse":
        return cls(
            job_id=job.id,
            company_id=job.company_id,
            status=job.status,
            total=job.total,
            processed=job.processed,
            error=job.error,
            created_at=job.created_at,
            updated_at=job.updated_at,
        )


class SyncReport(BaseModel):
    """Outcome of one POST /internal/sync-tenders run. capped/timed_out
    are normal (the next scheduled run continues from the checkpoint),
    not errors — the HTTP status stays 200 whenever the run itself worked."""

    window_start: datetime
    window_end: datetime
    tenders_synced: int
    tenders_capped: bool
    tenders_timed_out: bool
    tenders_checkpoint: datetime | None
    awards_synced: int
    awards_capped: bool
    awards_timed_out: bool
    awards_pdf_errors: int
    awards_checkpoint: datetime | None
    duration_seconds: float


class AuthorityNotices(BaseModel):
    count: int
    first_date: datetime | None
    last_date: datetime | None
    total_estimated_value: float | None


class AuthorityWinner(BaseModel):
    name: str
    wins: int
    total_value: float


class AuthorityAwards(BaseModel):
    count: int
    total_value: float | None
    winners: list[AuthorityWinner]


class AuthorityHistory(BaseModel):
    """(contracting_authority, cpv_group) aggregation. insufficient_data
    is true until MIN_AWARDS_FOR_PATTERN awards back the winner table —
    sample_size says how far off we are."""

    authority: str | None
    cpv_group: str | None
    notices: AuthorityNotices
    awards: AuthorityAwards
    insufficient_data: bool
    sample_size: int
