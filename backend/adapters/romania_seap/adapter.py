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

Detail/eligibility endpoint (confirmed live, not guessed):
  GET /api-pub/NoticeCommon/GetSection3View/?initNoticeId={cNoticeId}&sysNoticeTypeId={sysNoticeTypeId}
This is SEAP's equivalent of an EU notice's Section III (legal/economic/
financial/technical conditions) — personalSituation (exclusion/
registration criteria), efCriteria(Min) (economic/financial standing,
e.g. turnover requirement), tpCriteriaQAStandard(Min) (technical/
professional ability, e.g. similar-experience value threshold). This is
the real specification/eligibility text extract_requirements needs — the
list endpoint above only returns summary fields.

Tender-dossier files (confirmed live 2026-10-27):
  GET /api-pub/NoticeCommon/GetDfNoticeSectionFiles/?initNoticeId={id}&sysNoticeTypeId={type}
returns dfNoticeDocs [{noticeDocumentName, noticeDocumentUrl}]; each URL
downloads from GET /{noticeDocumentUrl}. The download GUID is
session-bound — listing and download MUST share one httpx client (this
adapter's self._client does), or the download 500s. Caiet de sarcini
files come either as plain .pdf or CMS-signed .pdf.p7s (see ai.ocr).
"""

import asyncio
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from adapters.base import TenderSourceAdapter
from ai.ocr import unwrap_p7s
from models.tender import SourceSystem, Tender

BASE_URL = "https://e-licitatie.ro"
LIST_PATH = "/api-pub/NoticeCommon/GetCNoticeList/"
SECTION3_PATH = "/api-pub/NoticeCommon/GetSection3View/"
SECTION_FILES_PATH = "/api-pub/NoticeCommon/GetDfNoticeSectionFiles/"

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


@dataclass
class NoticeDocument:
    name: str
    url: str  # relative "api-pub/files/noticedoc/<session-bound-guid>"


@dataclass
class CaietDocument:
    name: str
    pdf_bytes: bytes


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
            notice_type_id=notice.get("sysNoticeTypeId"),
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

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
    async def fetch_eligibility_text(self, external_id: str, notice_type_id: int) -> str:
        """The closest thing SEAP has to full specification text: Section
        III's exclusion/registration criteria, economic/financial standing,
        and technical/professional ability fields, concatenated with
        labels. Empty/null fields (common — not every tender sets every
        criterion) are skipped."""
        response = await self._client.get(
            SECTION3_PATH,
            params={"initNoticeId": external_id, "sysNoticeTypeId": notice_type_id},
        )
        response.raise_for_status()
        data = response.json()

        sections = [
            ("Exclusion / registration criteria", data.get("personalSituation")),
            ("Economic and financial standing", _join(data.get("efCriteria"), data.get("efCriteriaMin"))),
            (
                "Technical and professional ability",
                _join(data.get("tpCriteriaQAStandard"), data.get("tpCriteriaQAStandardMin")),
            ),
            ("Professional criteria", data.get("prCriteria")),
            ("Deposits and guarantees", data.get("depositsAndWarranties")),
        ]
        return "\n\n".join(f"{label}:\n{text}" for label, text in sections if text)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
    async def fetch_notice_documents(
        self, external_id: str, notice_type_id: int
    ) -> list[NoticeDocument]:
        """List a tender's dossier files (caiet de sarcini, fisa de date,
        contracts, forms). Uses self._client so a later download_document
        reuses the same session — required, the GUIDs are session-bound."""
        response = await self._client.get(
            SECTION_FILES_PATH,
            params={"initNoticeId": external_id, "sysNoticeTypeId": notice_type_id},
        )
        response.raise_for_status()
        docs = response.json().get("dfNoticeDocs") or []
        return [
            NoticeDocument(name=d.get("noticeDocumentName") or "", url=d.get("noticeDocumentUrl") or "")
            for d in docs
            if d.get("noticeDocumentUrl")
        ]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
    async def download_document(self, doc: NoticeDocument) -> bytes:
        """Download one dossier file. MUST run on the same adapter instance
        (same session) as the fetch_notice_documents call that listed it."""
        response = await self._client.get("/" + doc.url.lstrip("/"))
        response.raise_for_status()
        return response.content

    async def fetch_caiet_pdf(
        self, external_id: str, notice_type_id: int
    ) -> CaietDocument | None:
        """Find, download, and (if CMS-signed) unwrap the tender's caiet de
        sarcini PDF. Prefers a plain .pdf over a .pdf.p7s when both are
        listed. Returns None when the dossier has no caiet file."""
        docs = await self.fetch_notice_documents(external_id, notice_type_id)
        caiets = [d for d in docs if "caiet" in d.name.lower()]
        if not caiets:
            return None
        caiets.sort(key=lambda d: 0 if d.name.lower().endswith(".pdf") else 1)
        chosen = caiets[0]
        pdf_bytes = unwrap_p7s(await self.download_document(chosen))
        if not pdf_bytes.startswith(b"%PDF"):
            raise ValueError(f"{chosen.name}: expected a PDF inside, got {pdf_bytes[:8]!r}")
        return CaietDocument(name=chosen.name, pdf_bytes=pdf_bytes)


def _join(*parts: str | None) -> str:
    return "\n".join(p for p in parts if p)


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
