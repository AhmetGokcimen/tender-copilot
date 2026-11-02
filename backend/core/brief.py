"""Detailed tender brief: what the job is and how it is to be done.

Built once per tender from the notice (title, description, SEAP's eligibility
sections) and, when the dossier has one, the caiet de sarcini (text layer, with
a few scanned pages read by OCR). Stored on the tender in English and Romanian
so every user shares one reading. A failure leaves the tender without a brief
and the page falls back to the short summary.
"""

import asyncio
from datetime import UTC, datetime

from sqlmodel import Session

from backend.adapters.romania_seap.adapter import RomaniaSeapAdapter
from backend.ai.client import MetaAIClient
from backend.ai.ocr import extract_pdf_text
from backend.core.translate import enabled
from backend.models.tender import Tender

MAX_SOURCE_CHARS = 45_000
OCR_PAGES = 6
DOCS_BUDGET_SECONDS = 100.0


async def _caiet_text(adapter: RomaniaSeapAdapter, tender: Tender, ai: MetaAIClient) -> str:
    try:
        caiet = await adapter.fetch_caiet_pdf(tender.external_id, tender.notice_type_id)
        if caiet is None:
            return ""
        extraction = await extract_pdf_text(caiet.pdf_bytes, ocr_page=ai.ocr_image, max_ocr_pages=OCR_PAGES)
        return extraction.full_text
    except Exception:  # noqa: BLE001 - documents are a bonus; the notice text still works
        return ""


async def _notice_text(adapter: RomaniaSeapAdapter, tender: Tender) -> str:
    parts = [f"Title: {tender.title}"]
    if tender.contracting_authority:
        parts.append(f"Contracting authority: {tender.contracting_authority}")
    if tender.estimated_value:
        parts.append(f"Estimated value: {tender.estimated_value:,.0f} {tender.currency or ''}".strip())
    if tender.county:
        parts.append(f"County: {tender.county}")
    if tender.raw_description:
        parts.append(f"Description: {tender.raw_description}")
    if tender.notice_type_id is not None:
        try:
            parts.append(await adapter.fetch_eligibility_text(tender.external_id, tender.notice_type_id))
        except Exception:  # noqa: BLE001
            pass
    return "\n".join(p for p in parts if p)


async def make_brief(
    session: Session,
    tender: Tender,
    *,
    ai: MetaAIClient | None = None,
    adapter: RomaniaSeapAdapter | None = None,
) -> bool:
    """Build and store the brief. True when one is stored."""
    if tender.brief:
        return True
    if not enabled():
        return False
    ai = ai or MetaAIClient()
    adapter = adapter or RomaniaSeapAdapter()
    notice = await _notice_text(adapter, tender)
    documents = ""
    if tender.notice_type_id is not None:
        try:
            documents = await asyncio.wait_for(_caiet_text(adapter, tender, ai), DOCS_BUDGET_SECONDS)
        except TimeoutError:
            documents = ""
    source = notice
    if documents.strip():
        source = f"{notice}\n\n--- Specification documents ---\n{documents}"
    source = source[:MAX_SOURCE_CHARS]
    try:
        en, ro = await asyncio.gather(
            ai.build_brief(source, language="English"), ai.build_brief(source, language="Romanian")
        )
    except Exception:  # noqa: BLE001 - leaves the tender without a brief for another try
        return False
    if en is None or ro is None:
        return False
    tender.brief = {
        "en": en.model_dump(),
        "ro": ro.model_dump(),
        "source": "documents" if documents.strip() else "notice",
        "generated_at": datetime.now(UTC).isoformat(),
    }
    session.add(tender)
    session.commit()
    return True
