"""Caiet-de-sarcini PDF intake: signature unwrap, page classification, OCR.

SEAP serves caiet PDFs either plain or wrapped in a CMS/PKCS#7 signature
(`.pdf.p7s`, DER or PEM). Inside, pages are a mix of text-layered and
full-page scanned images — the classifier below routes each page to the
cheap path (direct text extraction) or the vision path (render + Meta
vision transcription), so scans cost AI calls only where needed.

Thresholds are calibrated against real SEAP samples (2026-10-27): scanned
pages carry 0-65 text chars plus a full-page image, while even the
sparsest real text page carries 300+.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Literal

import pymupdf
from asn1crypto import cms, pem

from backend.ai.client import ExtractedRequirements, MetaAIClient

PageKind = Literal["text", "scanned", "empty"]

# A page with fewer text chars than this is not usefully text-layered.
TEXT_PAGE_MIN_CHARS = 100
# Render resolution for vision OCR: verified readable at 150 DPI on real scans.
OCR_DPI = 150
# Cost guard: a fully-scanned caiet longer than this gets truncated, honestly flagged.
OCR_MAX_PAGES = 30


class OCRError(Exception):
    """The input bytes are neither a PDF nor an unwrappable CMS signature blob."""


def unwrap_p7s(data: bytes) -> bytes:
    """Return the inner PDF of a CMS/PKCS#7 signed blob, or `data` unchanged
    when it is already a PDF. Raises OCRError for anything else (detached
    signatures carry no content to recover; non-PDF innards like .rar/.docx
    are left for the caller to reject by magic bytes)."""
    if data.startswith(b"%PDF"):
        return data
    raw = data
    if pem.detect(data):
        _, _, raw = pem.unarmor(data)
    try:
        info = cms.ContentInfo.load(raw)
    except ValueError as e:
        raise OCRError(f"Not a PDF or CMS signature blob ({len(data)} bytes)") from e
    if info["content_type"].native != "signed_data":
        raise OCRError(f"Unsupported CMS type: {info['content_type'].native}")
    inner = info["content"]["encap_content_info"]["content"].native
    if not isinstance(inner, bytes):
        raise OCRError("Detached CMS signature: no embedded content to recover")
    return inner


def classify_pages(pdf_bytes: bytes) -> list[PageKind]:
    """Label every page: "text" (usable text layer), "scanned" (image-only,
    needs OCR), or "empty" (no text, no images — skipped)."""
    kinds: list[PageKind] = []
    with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page in doc:
            text_chars = len((page.get_text() or "").strip())
            if text_chars >= TEXT_PAGE_MIN_CHARS:
                kinds.append("text")
            elif page.get_images(full=True):
                kinds.append("scanned")
            else:
                kinds.append("empty")
    return kinds


def render_page_png(pdf_bytes: bytes, page_index: int, *, dpi: int = OCR_DPI) -> bytes:
    with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
        return doc[page_index].get_pixmap(dpi=dpi).tobytes("png")


@dataclass
class PdfExtraction:
    full_text: str
    page_texts: list[str]
    page_kinds: list[PageKind]
    scanned_pages: list[int]  # 1-based, including skipped/failed ones
    ocr_pages: int  # vision calls actually made
    ocr_errors: dict[int, str] = field(default_factory=dict)  # 1-based page -> error
    truncated: bool = False  # True when max_ocr_pages cut the OCR short


async def extract_pdf_text(
    pdf_bytes: bytes,
    *,
    ocr_page: Callable[[bytes], Awaitable[str]] | None = None,
    dpi: int = OCR_DPI,
    max_ocr_pages: int = OCR_MAX_PAGES,
) -> PdfExtraction:
    """Merge a PDF's text-layer pages with vision OCR of its scanned pages.

    `ocr_page` renders PNG -> transcription; the default uses the Meta
    client (same provider/key as the other AI steps). Sequential on purpose:
    predictable latency, no rate-limit bursts. Failures and page-cap skips
    are recorded on the result, never raised — the caller decides whether
    partial text is enough.
    """
    ocr = ocr_page or MetaAIClient().ocr_image
    kinds = classify_pages(pdf_bytes)
    page_texts: list[str] = []
    scanned: list[int] = []
    errors: dict[int, str] = {}
    ocr_used = 0
    truncated = False

    with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
        for index, (page, kind) in enumerate(zip(doc, kinds)):
            page_no = index + 1
            if kind == "text":
                page_texts.append((page.get_text() or "").strip())
            elif kind == "empty":
                page_texts.append("")
            else:
                scanned.append(page_no)
                if ocr_used >= max_ocr_pages:
                    truncated = True
                    page_texts.append("")
                    continue
                try:
                    png = page.get_pixmap(dpi=dpi).tobytes("png")
                    page_texts.append((await ocr(png)).strip())
                    ocr_used += 1
                except Exception as e:  # noqa: BLE001 — recorded, see docstring
                    errors[page_no] = f"{type(e).__name__}: {e}"
                    page_texts.append(f"[page {page_no}: OCR failed]")

    full_text = "\n\n".join(t for t in page_texts if t)
    if truncated:
        full_text += "\n\n[remaining scanned pages omitted: OCR page cap reached]"
    return PdfExtraction(
        full_text=full_text,
        page_texts=page_texts,
        page_kinds=kinds,
        scanned_pages=scanned,
        ocr_pages=ocr_used,
        ocr_errors=errors,
        truncated=truncated,
    )


async def extract_requirements_from_pdf(
    pdf_bytes: bytes,
    *,
    client: MetaAIClient | None = None,
    dpi: int = OCR_DPI,
    max_ocr_pages: int = OCR_MAX_PAGES,
) -> tuple[ExtractedRequirements, PdfExtraction]:
    """Full caiet path: PDF -> merged text -> the existing structured
    extraction schema, with that step's own retry/fallback semantics intact
    (up to 3 attempts, else extraction_confidence="failed")."""
    ai = client or MetaAIClient()
    extraction = await extract_pdf_text(
        pdf_bytes, ocr_page=ai.ocr_image, dpi=dpi, max_ocr_pages=max_ocr_pages
    )
    return await ai.extract_requirements(extraction.full_text), extraction
