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
