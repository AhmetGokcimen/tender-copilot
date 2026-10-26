"""Adapter for Romania's e-licitatie.ro (SEAP/SICAP) public JSON API.

Endpoint, headers and response shape below are a verified-working public
contract (no auth), confirmed against a previously-running single-user
Romanian tender tracker of the project owner's — this is a from-scratch
reimplementation against that confirmed contract, not a copy of that code.

Quirks that matter (confirmed, not guessed):
  - sortProperties is accepted but ignored by the API. Without a
    publication-date window the result set is oldest-first and caps out
    around 3000 total, so a date window is mandatory, not optional.
  - cPVText matches lot/secondary CPVs too, not just the tender's main
    CPV — a search for one CPV code can return tenders whose *main* CPV is
    something else entirely. That's why fetch_tenders takes CPV codes to
    search by, but Tender.cpv_codes[0] always holds the tender's own main
    CPV (parsed from cpvCodeAndName), independent of which code found it.
"""

import asyncio
import re
from datetime import UTC, datetime, timedelta

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from adapters.base import TenderSourceAdapter
from models.tender import SourceSystem, Tender

BASE_URL = "https://e-licitatie.ro"
LIST_PATH = "/api-pub/NoticeCommon/GetCNoticeList/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Origin": BASE_URL,
    "Referer": f"{BASE_URL}/pub/notices/contract-notices/list/0/0",
}

PAGE_SIZE = 200
MAX_PAGES = 25
REQUEST_DELAY_SECONDS = 0.3

_CPV_RE = re.compile(r"\s*(\d{8})")


class RomaniaSeapAdapter(TenderSourceAdapter):
    country_code = "RO"
    source_system = SourceSystem.ROMANIA_SEAP

    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client or httpx.AsyncClient(
            base_url=BASE_URL, headers=HEADERS, timeout=120.0
        )

    async def fetch_tenders(
        self,
        cpv_codes: list[str] | None = None,
        keywords: list[str] | None = None,
        days: int = 30,
        open_only: bool = False,
        **filters,
    ) -> list[Tender]:
        """Fetch tenders published in the last `days` days matching any of
        the given CPV codes or free-text keywords (contract name search).
        De-duplicates by cNoticeId across all queries."""
        end_dt = datetime.now()
        start_dt = end_dt - timedelta(days=days)
        start = start_dt.strftime("%Y-%m-%dT00:00:00")
        end = end_dt.strftime("%Y-%m-%dT23:59:59")

        by_id: dict[str, dict] = {}
        for code in cpv_codes or []:
            items = await self._search(start, end, cpv_text=code, open_only=open_only)
            for item in items:
                by_id.setdefault(str(item["cNoticeId"]), item)
            await asyncio.sleep(REQUEST_DELAY_SECONDS)

        for kw in keywords or []:
            items = await self._search(start, end, contract_name=kw, open_only=open_only)
            for item in items:
                by_id.setdefault(str(item["cNoticeId"]), item)
            await asyncio.sleep(REQUEST_DELAY_SECONDS)

        return [self._map_notice(item) for item in by_id.values()]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
    async def _search(
        self,
        start: str,
        end: str,
        *,
        cpv_text: str | None = None,
        contract_name: str | None = None,
        open_only: bool = False,
    ) -> list[dict]:
        payload = {
            "sysNoticeTypeIds": [],
            "sortProperties": [],
            "startPublicationDate": start,
            "endPublicationDate": end,
            "pageSize": PAGE_SIZE,
        }
        if cpv_text:
            payload["cPVText"] = cpv_text
        if contract_name:
            payload["contractName"] = contract_name
        if open_only:
            payload["startTenderReceiptDeadline"] = datetime.now().strftime("%Y-%m-%dT00:00:00")

        items: list[dict] = []
        page = 0
        while page < MAX_PAGES:
            payload["pageIndex"] = page
            response = await self._client.post(LIST_PATH, json=payload)
            response.raise_for_status()
            data = response.json()
            batch = data.get("items") or []
            items.extend(batch)
            total = data.get("total", 0)
            if len(items) >= total or not batch:
                break
            page += 1
            await asyncio.sleep(REQUEST_DELAY_SECONDS)
        return items

    def _map_notice(self, notice: dict) -> Tender:
        cpv_match = _CPV_RE.match(notice.get("cpvCodeAndName") or "")
        main_cpv = cpv_match.group(1) if cpv_match else None

        return Tender(
            source_system=self.source_system,
            external_id=str(notice["cNoticeId"]),
            country_code=self.country_code,
            notice_no=notice.get("noticeNo"),
            title=notice.get("contractTitle") or "",
            contracting_authority=notice.get("contractingAuthorityNameAndFN"),
            cpv_codes=[main_cpv] if main_cpv else [],
            estimated_value=notice.get("estimatedValueRon"),
            currency="RON" if notice.get("estimatedValueRon") is not None else None,
            publication_date=_parse_date(notice.get("noticeStateDate")),
            submission_deadline=_parse_date(
                notice.get("maxTenderReceiptDeadline") or notice.get("minTenderReceiptDeadline")
            ),
            source_url=_notice_url(notice),
        )


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


# sysNoticeTypeId -> public SPA view route, confirmed against the source
# system this adapter's contract is based on.
_VIEW_ROUTES = {
    2: "/pub/notices/c-notice/{v}/view/{id}",
    5: "/pub/notices/c-notice/{v}/view/{id}",
    6: "/pub/notices/dc-notice/{v}/view/{id}",
    7: "/pub/notices/pc-notice/{v}/view/{id}",
    12: "/pub/notices/rfq-invitation/{v}/view/{id}",
    17: "/pub/notices/simplified-notice/{v}/view/{id}",
}


def _notice_url(notice: dict) -> str | None:
    route = _VIEW_ROUTES.get(notice.get("sysNoticeTypeId"))
    if not route:
        return None
    v = "v2" if (notice.get("sysNoticeVersionId") or 2) >= 2 else "v1"
    return BASE_URL + route.format(v=v, id=notice["cNoticeId"])
