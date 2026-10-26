"""Adapter for Romania's e-licitatie.ro (SEAP/SICAP) public JSON API.

Undocumented public API, no auth required, but requires browser-like
headers. Implementation lands in a follow-up step, per the agreed task
order (architecture confirmation first).
"""

from app.adapters.base import TenderSourceAdapter
from app.core.models import SourceSystem, Tender


class RomaniaSeapAdapter(TenderSourceAdapter):
    country_code = "RO"
    source_system = SourceSystem.ROMANIA_SEAP

    async def fetch_tenders(self, **filters) -> list[Tender]:
        raise NotImplementedError
