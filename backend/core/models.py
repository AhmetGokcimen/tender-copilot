"""Country-agnostic domain models.

Every tender record carries `country_code` and `source_system` so the core
logic (pre-filter, scoring, AI extraction, eligibility matching) never has
to know which country or adapter produced it. CPV codes are EU-wide
standard and are treated as the universal categorization key across
countries.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class SourceSystem(str, Enum):
    ROMANIA_SEAP = "romania_seap"


class Tender(BaseModel):
    id: str
    country_code: str  # ISO 3166-1 alpha-2, e.g. "RO"
    source_system: SourceSystem
    external_id: str  # the ID in the source system, for dedup/traceability
    title: str
    cpv_codes: list[str] = []
    estimated_value: float | None = None
    currency: str | None = None
    publication_date: datetime | None = None
    submission_deadline: datetime | None = None
    raw_description: str | None = None
    source_url: str | None = None


class CompanyProfile(BaseModel):
    id: str
    name: str
    cpv_codes: list[str] = []
    annual_capacity: float | None = None
    certifications: list[str] = []
    blacklist_keywords: list[str] = []


class TenderScore(BaseModel):
    tender_id: str
    score: int  # 0-100
    reasons: list[str] = []


class EligibilityVerdict(BaseModel):
    tender_id: str
    company_id: str
    eligible: bool | None  # None = uncertain, do not guess
    matched_requirements: list[str] = []
    unmet_requirements: list[str] = []
    justification: str
