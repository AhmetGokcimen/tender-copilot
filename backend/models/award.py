"""Contract-award rows (SEAP "anunturi de atribuire", CAN... notices).

Awards are global tender-adjacent data like Tender itself: system-written,
shared across companies, never company-scoped. List fields come from
GetCANoticeList; winner fields come from parsing the award print PDF
(GetCANoticePrintDocument, section V.2.3) — SEAP exposes no JSON detail
with the winner (verified 2026-10-28, see the adapter docstring).

No participation linkage is stored: the API links participation -> award
(GetNoticeGeneralInfo) but not award -> participation, and resolving it
per award would double sync traffic for a field no consumer needs yet.
"""

from datetime import UTC, datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from backend.models.tender import SourceSystem


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Award(SQLModel, table=True):
    # Composite PK, same rationale as Tender: external_id (SEAP caNoticeId)
    # is unique per source system, and this is the upsert conflict target.
    source_system: SourceSystem = Field(primary_key=True)
    external_id: str = Field(primary_key=True)

    country_code: str = Field(index=True)
    notice_no: str | None = None  # "CAN1065826"
    title: str
    contracting_authority: str | None = Field(default=None, index=True)
    cpv_codes: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    contract_value: float | None = None  # ronContractValue (final)
    estimated_initial_value: float | None = None  # V.2.4 initial estimate
    currency: str | None = None
    award_date: datetime | None = None  # noticeStateDate, PDF fallback
    contract_no: str | None = None  # V.2.1
    contract_date: datetime | None = None

    # Winner (V.2.3 block). Null when the PDF fetch/parse failed — the row
    # is still kept, since list fields alone serve volume aggregation.
    winner_name: str | None = None
    winner_cif: str | None = None  # "Cod de identificare fiscala"
    winner_raw: str | None = None  # full V.2.3 text for auditability
    offers_received: int | None = None  # V.2.2
    offers_from_sme: int | None = None

    # Award detail view route is undiscovered (only the list route
    # /pub/notices/contract-award-notices/list/0/0 is confirmed), so no
    # per-award URL until the view contract is found.
    source_url: str | None = None

    first_seen_at: datetime = Field(default_factory=_utcnow)
    last_seen_at: datetime = Field(default_factory=_utcnow)
