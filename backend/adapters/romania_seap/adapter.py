"""Adapter for Romania's e-licitatie.ro (SEAP/SICAP) public JSON API.

No auth required, but the API is undocumented and only responds to
browser-like requests (User-Agent + Referer/Origin headers; a plain
`requests`/`httpx` call with no headers gets rejected). The HTTP plumbing
below (headers, pagination, retry) is wired up and ready, but the exact
endpoint path and request payload are marked TODO: they need to be
confirmed by capturing one real search request from e-licitatie.ro in
browser devtools (Network tab -> search for a CPV code -> copy the
request as cURL), since nothing here should be shipped on a guessed
contract. `_map_notice` similarly needs its key names checked against a
real response payload.
"""

from datetime import datetime

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from adapters.base import TenderSourceAdapter
from models.tender import SourceSystem, Tender

# TODO: confirm against a real captured request — this is a best-guess
# placeholder, not a verified endpoint.
BASE_URL = "https://e-licitatie.ro/api-pub"
SEARCH_PATH = "/NoticesContract/Search"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://e-licitatie.ro/",
    "Origin": "https://e-licitatie.ro",
}

PAGE_SIZE = 50


class RomaniaSeapAdapter(TenderSourceAdapter):
    country_code = "RO"
    source_system = SourceSystem.ROMANIA_SEAP

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client or httpx.AsyncClient(
            base_url=BASE_URL, headers=BROWSER_HEADERS, timeout=30.0
        )

    async def fetch_tenders(self, cpv_codes: list[str] | None = None, **filters) -> list[Tender]:
        tenders: list[Tender] = []
        page = 1
        while True:
            batch = await self._fetch_page(page, cpv_codes)
            if not batch:
                break
            tenders.extend(self._map_notice(n) for n in batch)
            if len(batch) < PAGE_SIZE:
                break
            page += 1
        return tenders

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
    async def _fetch_page(self, page: int, cpv_codes: list[str] | None) -> list[dict]:
        # TODO: real payload shape (pagination keys, CPV filter key) unverified.
        payload = {
            "pageIndex": page,
            "pageSize": PAGE_SIZE,
            "cpvCodes": cpv_codes or [],
        }
        response = await self._client.post(SEARCH_PATH, json=payload)
        response.raise_for_status()
        data = response.json()
        # TODO: confirm the actual results key (e.g. "items", "results", "data").
        return data.get("items", [])

    def _map_notice(self, notice: dict) -> Tender:
        # TODO: confirm real field names from a captured response.
        return Tender(
            source_system=self.source_system,
            external_id=str(notice.get("id") or notice.get("noticeId")),
            country_code=self.country_code,
            title=notice.get("title") or notice.get("directAcquisitionName") or "",
            cpv_codes=notice.get("cpvCodes") or [],
            estimated_value=notice.get("estimatedValue"),
            currency=notice.get("currency"),
            publication_date=_parse_date(notice.get("publicationDate")),
            submission_deadline=_parse_date(notice.get("submissionDeadline")),
            raw_description=notice.get("description"),
            source_url=notice.get("url"),
        )


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
