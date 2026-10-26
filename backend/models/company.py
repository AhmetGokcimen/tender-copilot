from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class CompanyProfile(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str

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
