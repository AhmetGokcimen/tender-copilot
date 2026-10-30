from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class CompanyProfile(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    cui: str | None = None  # Romanian fiscal ID, e.g. "RO18402933"

    # Onboarding profile fields (all nullable: the wizard fills them in
    # steps — see core/lookups.py for the required/optional split and the
    # enums backing industry/keywords/target_countries).
    industry: str | None = None  # key into core.lookups.INDUSTRIES
    founded_year: int | None = None
    team_size: int | None = None
    target_countries: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    keywords: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    # CPV codes the company bids as main/sole contractor on.
    cpv_codes: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    # Related CPV codes the company only wants as a subcontracting lead
    # (e.g. a general-construction umbrella code where the company's own
    # trade is one of the lots) — scored lower than a direct cpv_codes match.
    secondary_cpv_codes: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    # Reference ceiling for "a tender this size is realistic for us to be
    # sole contractor on" — used as the denominator in scoring's value-ratio
    # bands, not a hard cutoff.
    annual_capacity: float | None = None
    certifications: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    blacklist_keywords: list[str] = Field(default_factory=list, sa_column=Column(JSON))

    # The company's actual financials/track record, for core.eligibility's
    # deterministic checks against a tender's extracted requirements —
    # distinct from annual_capacity above, which is a scoring heuristic,
    # not a real figure.
    annual_turnover: float | None = None
    annual_turnover_currency: str | None = None
    similar_experience_value: float | None = None  # cumulative value of past similar contracts
    similar_experience_currency: str | None = None
    similar_experience_contract_count: int | None = None

    # Onboarding additions: the company's site (for a later agent to read),
    # the construction trades it works in (keys into the frontend catalogue
    # in lib/construction.ts), the capacity's currency, and the team split
    # that tenders ask about (EU citizens vs. others).
    website: str | None = None
    subsectors: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    annual_capacity_currency: str | None = None
    team_eu_count: int | None = None
    team_non_eu_count: int | None = None
