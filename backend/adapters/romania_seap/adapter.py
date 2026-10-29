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

Contract awards (confirmed live 2026-10-28 via the SPA's own traffic):
  POST /api-pub/NoticeCommon/GetCANoticeList/ — same family as the
  participation list (sysNoticeTypeIds [3], pageSize/pageIndex, and a
  MANDATORY start/endPublicationDate window: unwindowed caps at 3000).
  cPVText prefix-filters. Items carry caNoticeId, noticeNo (CAN...),
  ronContractValue, currencyCode, cpvCodeAndName — but NO winner.
  The winner lives only in the award print PDF:
  POST /api-pub/NoticeCommon/GetCANoticePrintDocument/?canoticeId={id}&sysNoticeTypeId=3
  (POST with query params; GET 405s). The PDF is text-layered with
  stable section marks — V.2.1 contract no/date, V.2.2 offer counts,
  V.2.3 winner name + CIF, V.2.4 values — parsed deterministically
  (parse_award_text, no AI). Section1/Section3/GeneralInfo carry no
  winner fields for awards (verified); the award detail view route is
  undiscovered, so Award.source_url stays None.
"""

import asyncio
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx
import pymupdf
from tenacity import RetryError, retry, stop_after_attempt, wait_exponential

from backend.adapters.base import TenderSourceAdapter
from backend.ai.ocr import unwrap_p7s
from backend.models.award import Award
from backend.models.tender import SourceSystem, Tender

BASE_URL = "https://e-licitatie.ro"
LIST_PATH = "/api-pub/NoticeCommon/GetCNoticeList/"
SECTION1_PATH = "/api-pub/NoticeCommon/GetSection1View/"
SECTION3_PATH = "/api-pub/NoticeCommon/GetSection3View/"
SECTION_FILES_PATH = "/api-pub/NoticeCommon/GetDfNoticeSectionFiles/"
CA_LIST_PATH = "/api-pub/NoticeCommon/GetCANoticeList/"
CA_PRINT_PATH = "/api-pub/NoticeCommon/GetCANoticePrintDocument/"

AWARD_NOTICE_TYPE_ID = 3

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


@dataclass
class AwardDetail:
    """Winner-level fields parsed from one award print PDF (section V.2).
    Multi-lot awards carry one V.2 block per lot — v1 keeps the FIRST
    block only (documented limitation, not silent behavior)."""

    winner_name: str | None = None
    winner_cif: str | None = None
    winner_raw: str | None = None
    offers_received: int | None = None
    offers_from_sme: int | None = None
    contract_no: str | None = None
    contract_date: datetime | None = None
    estimated_initial_value: float | None = None
    publication_date: datetime | None = None  # "Anunt publicat" fallback


# SEAP procedure vocabulary (sysProcedureType.text + sysContractAssigmentType.text,
# confirmed against live list responses) -> frontend ProcedureType union.
# "Procedura simplificata" is a below-threshold open competition (no shortlist),
# so it maps to "open". Anything unrecognized also defaults to "open" — the
# frontend union has no "unknown" member (see backend/API_CHANGES.md).
def map_procedure_type(
    sys_procedure: dict | None, sys_assignment: dict | None
) -> str:
    assignment = ((sys_assignment or {}).get("text") or "").lower()
    if "acord-cadru" in assignment or "acord cadru" in assignment:
        return "framework"
    text = ((sys_procedure or {}).get("text") or "").lower()
    if "restransa" in text:
        return "restricted"
    if "negociere" in text or "dialog competitiv" in text:
        return "negotiated"
    if "directa" in text:
        return "direct"
    return "open"


def _parse_county(section1: dict) -> str | None:
    """County from the buyer address NUTS code ("RO421 Arad" -> "Arad").
    The dedicated `county` field is null in practice; NUTS-3 is the county."""
    nuts = ((section1.get("noticeEntityAddress") or {}).get("nutsCode") or {}).get("text")
    if not nuts or " " not in nuts:
        return None
    return nuts.split(" ", 1)[1].strip() or None


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
        start: datetime | None = None,
        end: datetime | None = None,
        enrich: bool = True,
        **filters,
    ) -> list[Tender]:
        """Fetch tenders published in the last `days` days matching any of
        the given CPV codes or free-text keywords (contract name search).
        De-duplicates by cNoticeId across all queries. An explicit
        [start, end) window (checkpoint slices) overrides `days`;
        enrich=False skips the per-tender Section I pass."""
        if start is not None and end is not None:
            # Exact bounds (NOT midnight-truncated): slice N ends where
            # slice N+1 starts, and truncation would refetch ~11h of
            # overlap at every boundary on every resume.
            start_s = start.strftime("%Y-%m-%dT%H:%M:%S")
            end_s = (end - timedelta(seconds=1)).strftime("%Y-%m-%dT%H:%M:%S")
        else:
            end_dt = datetime.now()
            start_dt = end_dt - timedelta(days=days)
            start_s = start_dt.strftime("%Y-%m-%dT00:00:00")
            end_s = end_dt.strftime("%Y-%m-%dT23:59:59")

        by_id: dict[str, dict] = {}
        for code in cpv_codes or []:
            items = await self._search(start_s, end_s, cpv_text=code, open_only=open_only)
            for item in items:
                by_id.setdefault(str(item["cNoticeId"]), item)
            await asyncio.sleep(REQUEST_DELAY_SECONDS)

        for kw in keywords or []:
            items = await self._search(start_s, end_s, contract_name=kw, open_only=open_only)
            for item in items:
                by_id.setdefault(str(item["cNoticeId"]), item)
            await asyncio.sleep(REQUEST_DELAY_SECONDS)

        tenders = [self._map_notice(item) for item in by_id.values()]
        if enrich:
            await self._enrich_display_fields(tenders)
        return tenders

    async def fetch_awards(
        self,
        cpv_codes: list[str] | None = None,
        days: int = 30,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[Award]:
        """Fetch contract awards (CAN... notices) in the window, optionally
        prefix-filtered by CPV. List-level fields only — winners come from
        fetch_award_detail per award. De-duplicates by caNoticeId."""
        if start is not None and end is not None:
            # Exact bounds — see fetch_tenders for why midnight truncation
            # is wrong for checkpoint slices.
            start_s = start.strftime("%Y-%m-%dT%H:%M:%S")
            end_s = (end - timedelta(seconds=1)).strftime("%Y-%m-%dT%H:%M:%S")
        else:
            end_dt = datetime.now()
            start_dt = end_dt - timedelta(days=days)
            start_s = start_dt.strftime("%Y-%m-%dT00:00:00")
            end_s = end_dt.strftime("%Y-%m-%dT23:59:59")

        by_id: dict[str, dict] = {}
        queries = cpv_codes or [None]
        for code in queries:
            items = await self._search_awards(start_s, end_s, cpv_text=code)
            for item in items:
                by_id.setdefault(str(item["caNoticeId"]), item)
            await asyncio.sleep(REQUEST_DELAY_SECONDS)
        return [self._map_award(item) for item in by_id.values()]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
    async def _search_awards(
        self, start: str, end: str, *, cpv_text: str | None = None
    ) -> list[dict]:
        payload: dict = {
            "sysNoticeTypeIds": [AWARD_NOTICE_TYPE_ID],
            "sortProperties": [],
            "startPublicationDate": start,
            "endPublicationDate": end,
            "pageSize": PAGE_SIZE,
        }
        if cpv_text:
            payload["cPVText"] = cpv_text

        items: list[dict] = []
        page = 0
        while page < MAX_PAGES:
            payload["pageIndex"] = page
            response = await self._client.post(CA_LIST_PATH, json=payload)
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

    def _map_award(self, item: dict) -> Award:
        cpv_match = _CPV_RE.match(item.get("cpvCodeAndName") or "")
        main_cpv = cpv_match.group(1) if cpv_match else None
        return Award(
            source_system=self.source_system,
            external_id=str(item["caNoticeId"]),
            country_code=self.country_code,
            notice_no=item.get("noticeNo"),
            title=item.get("contractTitle") or "",
            contracting_authority=item.get("contractingAuthorityNameAndFN"),
            cpv_codes=[main_cpv] if main_cpv else [],
            contract_value=item.get("ronContractValue"),
            currency=item.get("currencyCode"),
            award_date=_parse_date(item.get("noticeStateDate")),
        )

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
    async def fetch_award_detail(self, ca_notice_id: str) -> AwardDetail | None:
        """Download one award's print PDF and parse section V.2 (winner,
        offers, contract, values). Returns None when the PDF has no
        parseable V.2 block (e.g. cancelled awards). Polite delay
        included — callers loop over many awards."""
        response = await self._client.post(
            CA_PRINT_PATH,
            params={"canoticeId": ca_notice_id, "sysNoticeTypeId": AWARD_NOTICE_TYPE_ID},
        )
        await asyncio.sleep(REQUEST_DELAY_SECONDS)
        response.raise_for_status()
        if not response.content.startswith(b"%PDF"):
            return None
        with pymupdf.open(stream=response.content, filetype="pdf") as doc:
            text = "\n".join(page.get_text() or "" for page in doc)
        return parse_award_text(text)

    async def _enrich_display_fields(self, tenders: list[Tender]) -> None:
        """Fill county + clarification_deadline from each tender's Section I
        view (buyer NUTS code, clarification noDays). Bounded-concurrency so
        a large sync stays fast; a tender whose Section I fails keeps nulls
        rather than failing the whole sync."""
        semaphore = asyncio.Semaphore(6)

        async def enrich_one(tender: Tender) -> None:
            if tender.notice_type_id is None:
                return
            async with semaphore:
                try:
                    section1 = await self.fetch_section1(
                        tender.external_id, tender.notice_type_id
                    )
                except (httpx.HTTPError, RetryError, ValueError, KeyError):
                    return
            tender.county = _parse_county(section1)
            no_days = section1.get("noDays")
            if isinstance(no_days, int) and tender.submission_deadline is not None:
                tender.clarification_deadline = tender.submission_deadline - timedelta(
                    days=no_days
                )

        await asyncio.gather(*(enrich_one(t) for t in tenders))

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, max=10))
    async def fetch_section1(self, external_id: str, notice_type_id: int) -> dict:
        """Section I (buyer identity/address + procedure parameters)."""
        response = await self._client.get(
            SECTION1_PATH,
            params={"initNoticeId": external_id, "sysNoticeTypeId": notice_type_id},
        )
        response.raise_for_status()
        return response.json()

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
            procedure_type=map_procedure_type(
                notice.get("sysProcedureType"), notice.get("sysContractAssigmentType")
            ),
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


def _parse_ro_date(value: str | None) -> datetime | None:
    """Romanian print format dd.mm.yyyy -> UTC datetime. None on garbage."""
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%d.%m.%Y").replace(tzinfo=UTC)
    except ValueError:
        return None


def _parse_ro_number(value: str | None) -> float | None:
    """Print-format number ("891423", "1 234,50") -> float. None on garbage."""
    if not value:
        return None
    cleaned = value.strip().replace(" ", "")
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _slice_between(text: str, start_mark: str, end_mark: str) -> str:
    """Text between the FIRST start_mark and the next end_mark. Capture
    starts at the newline after the start mark's own line (marks are
    section headings; values live on following lines). Empty string when
    the marks are absent/misordered."""
    start = text.find(start_mark)
    if start < 0:
        return ""
    line_end = text.find("\n", start)
    if line_end < 0:
        return ""
    end = text.find(end_mark, line_end)
    if end < 0:
        return ""
    return text[line_end + 1:end]


def parse_award_text(text: str) -> AwardDetail:
    """Deterministic parse of an award print PDF's section V.2 (verified
    against CAN1065826, 2026-10-28). Header/footer boilerplate
    ("Sistemul Electronic…", "Anunt publicat…", "Pagina N") is tolerated
    inside slices. Missing blocks yield None fields, never exceptions."""
    detail = AwardDetail()

    v21 = _slice_between(text, "V.2.1)", "V.2.2)")
    for line in v21.splitlines():
        if "Anunt publicat" in line or not line.strip():
            continue
        match = re.match(r"\s*(.+?)\s*/\s*(\d{2}\.\d{2}\.\d{4})\s*$", line)
        if match:
            detail.contract_no = match.group(1).strip()
            detail.contract_date = _parse_ro_date(match.group(2))
            break

    v22 = _slice_between(text, "V.2.2)", "V.2.3)")
    match = re.search(r"Numarul de oferte primite:\s*(\d+)", v22)
    detail.offers_received = int(match.group(1)) if match else None
    match = re.search(r"de la IMM-uri:\s*(\d+)", v22)
    detail.offers_from_sme = int(match.group(1)) if match else None

    v23 = _slice_between(text, "V.2.3)", "V.2.4)").strip()
    if v23:
        detail.winner_raw = v23
        for line in v23.splitlines():
            if line.strip():
                detail.winner_name = line.strip()
                break
        match = re.search(r"Cod de identificare fiscala:\s*([^;\n]+)", v23)
        detail.winner_cif = match.group(1).strip() if match else None

    v24 = _slice_between(text, "V.2.4)", "V.2.5)")
    match = re.search(
        r"Valoarea totala estimata initiala a contractului/lotului:\s*([\d\s.,]+)", v24
    )
    detail.estimated_initial_value = _parse_ro_number(match.group(1)) if match else None

    match = re.search(r"Anunt publicat:\s*\[[A-Z0-9]+/(\d{2}\.\d{2}\.\d{4})\]", text)
    detail.publication_date = _parse_ro_date(match.group(1)) if match else None

    return detail


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
