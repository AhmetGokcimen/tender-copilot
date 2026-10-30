"""Onboarding vocabularies served to the frontend wizard (none of these
lists are hardcoded client-side): industries with CPV pre-mapping,
tender keywords tied to CPV groups, and the adapter-backed country list.

Validation here is the single gate for company writes: both POST/PATCH
/company and POST/PATCH /companies/{id} go through validate_company_data,
so free-text industry/keyword/country values can never reach the DB.
"""

from dataclasses import dataclass

from backend.models.company import CompanyProfile


@dataclass(frozen=True)
class Industry:
    key: str
    label: str
    # Division-level CPV codes pre-seeded onto a company that picks this
    # industry without choosing CPVs explicitly.
    suggested_cpv_codes: list[str]


@dataclass(frozen=True)
class Keyword:
    key: str
    label: str
    related_cpv_codes: list[str]


@dataclass(frozen=True)
class Country:
    code: str  # ISO 3166-1 alpha-2, matches Tender.country_code
    name: str
    source_systems: list[str]  # adapters serving this country


INDUSTRIES: dict[str, Industry] = {
    key: Industry(key=key, label=label, suggested_cpv_codes=cpvs)
    for key, label, cpvs in [
        ("construction", "Construction & civil works", ["45000000"]),
        ("it-hardware", "IT hardware & equipment", ["30200000"]),
        ("software", "Software & IT services", ["48000000", "72200000"]),
        ("consulting", "Consulting & business services", ["79400000"]),
        ("medical", "Medical devices & pharma", ["33000000"]),
        ("furniture", "Furniture & office supplies", ["39100000"]),
        ("catering", "Catering & food services", ["55500000"]),
        ("transport", "Transport & logistics", ["60000000"]),
        ("energy", "Energy & fuels", ["09000000"]),
        ("security", "Security & surveillance", ["79700000"]),
    ]
}

KEYWORDS: dict[str, Keyword] = {
    key: Keyword(key=key, label=label, related_cpv_codes=cpvs)
    for key, label, cpvs in [
        ("road-works", "Road works", ["45233120"]),
        ("it-equipment", "IT equipment supply", ["30200000"]),
        ("software-licenses", "Software licenses", ["48000000"]),
        ("maintenance", "Maintenance & helpdesk", ["50300000"]),
        ("consulting", "Consulting services", ["79400000"]),
        ("medical-devices", "Medical devices", ["33000000"]),
        ("furniture", "Furniture supply", ["39100000"]),
        ("catering", "Catering services", ["55500000"]),
        ("transport", "Transport services", ["60000000"]),
        ("energy", "Energy supply", ["09000000"]),
    ]
}

COUNTRIES: list[Country] = [
    Country(code="RO", name="Romania", source_systems=["romania_seap"]),
]

# Without these the eligibility engine has nothing to compare — the wizard
# must collect them before the profile counts as complete.
REQUIRED_PROFILE_FIELDS = ["name", "industry", "annual_turnover"]
OPTIONAL_PROFILE_FIELDS = [
    "founded_year",
    "team_size",
    "certifications",
    "target_countries",
    "keywords",
    "cui",
]


def validate_company_data(data: dict) -> None:
    """Raises ValueError naming the offending field. Accepts partial dicts
    (one wizard step at a time) — only present keys are checked."""
    industry = data.get("industry")
    if industry is not None and industry not in INDUSTRIES:
        raise ValueError(f"Unknown industry: {industry!r}")
    for keyword in data.get("keywords") or []:
        if keyword not in KEYWORDS:
            raise ValueError(f"Unknown keyword: {keyword!r}")
    known_countries = {c.code for c in COUNTRIES}
    for country in data.get("target_countries") or []:
        if country not in known_countries:
            raise ValueError(f"Unknown country: {country!r}")
    founded = data.get("founded_year")
    if founded is not None and not 1800 <= founded <= 2100:
        raise ValueError(f"founded_year out of range: {founded!r}")
    team = data.get("team_size")
    if team is not None and team < 0:
        raise ValueError(f"team_size must be >= 0: {team!r}")
    for field in ("team_eu_count", "team_non_eu_count"):
        count = data.get(field)
        if count is not None and count < 0:
            raise ValueError(f"{field} must be >= 0: {count!r}")
    turnover = data.get("annual_turnover")
    if turnover is not None and turnover < 0:
        raise ValueError(f"annual_turnover must be >= 0: {turnover!r}")


def apply_industry_preseed(company: CompanyProfile) -> None:
    """Fill empty cpv_codes from the industry's suggestions — an explicit
    CPV choice always wins, this only covers 'picked an industry and moved
    on' wizard users."""
    if company.industry in INDUSTRIES and not company.cpv_codes:
        company.cpv_codes = list(INDUSTRIES[company.industry].suggested_cpv_codes)


def profile_completeness(company: CompanyProfile) -> dict:
    """Onboarding status: which minimum-viable and nice-to-have fields are
    still empty. An empty list/str/None all count as missing."""

    def filled(field: str) -> bool:
        value = getattr(company, field, None)
        if value is None:
            return False
        return not (isinstance(value, (str, list)) and not value)

    missing_required = [f for f in REQUIRED_PROFILE_FIELDS if not filled(f)]
    missing_optional = [f for f in OPTIONAL_PROFILE_FIELDS if not filled(f)]
    return {
        "complete": not missing_required,
        "missing_required": missing_required,
        "missing_optional": missing_optional,
    }
