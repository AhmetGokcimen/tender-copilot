"""Common interface every country/source adapter must implement.

Adding a new country means writing one adapter module that implements
TenderSourceAdapter and returns models.tender.Tender objects — nothing in
core/ or api/ changes. Source-specific auth, request format, and pagination
are isolated inside the adapter.
"""

from abc import ABC, abstractmethod

from models.tender import Tender


class TenderSourceAdapter(ABC):
    country_code: str
    source_system: str

    @abstractmethod
    async def fetch_tenders(self, **filters) -> list[Tender]:
        """Fetch and normalize tenders from the source into Tender objects."""
        raise NotImplementedError
