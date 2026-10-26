from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class CompanyProfile(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    cpv_codes: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    annual_capacity: float | None = None
    certifications: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    blacklist_keywords: list[str] = Field(default_factory=list, sa_column=Column(JSON))
