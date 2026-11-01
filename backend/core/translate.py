"""English titles and summaries for tenders, generated once and kept on the tender.

Romanian users read the original notice; the English UI shows these. Calls
only happen when META_API_KEY is set, and a tender is translated at most
once (a failure leaves it untranslated for the next attempt).
"""

import time

import httpx
from sqlmodel import Session, select

from backend.ai.client import MetaAIClient
from backend.core.config import settings
from backend.models.tender import Tender


def enabled() -> bool:
    return bool(settings.meta_api_key)


async def translate_one(session: Session, tender: Tender, ai: MetaAIClient | None = None) -> bool:
    """Fill ai_title_simplified (English title) and summary_en. True when stored."""
    if tender.ai_title_simplified and tender.summary_en:
        return True
    if not enabled():
        return False
    ai = ai or MetaAIClient()
    try:
        result = await ai.translate_tender(tender.title, tender.raw_description)
    except (httpx.HTTPError, ValueError):
        return False
    if result is None:
        return False
    tender.ai_title_simplified, tender.summary_en = result
    session.add(tender)
    session.commit()
    return True


async def translate_pending(session: Session, *, limit: int, max_seconds: float) -> dict:
    """Translate the untranslated tenders closest to their deadline first."""
    if not enabled():
        return {"translated": 0, "failed": 0, "enabled": False}
    started = time.monotonic()
    rows = session.exec(
        select(Tender)
        .where(Tender.summary_en.is_(None))
        .order_by(Tender.submission_deadline.is_(None), Tender.submission_deadline.desc())
        .limit(limit)
    ).all()
    ai = MetaAIClient()
    done = failed = 0
    for tender in rows:
        if time.monotonic() - started > max_seconds:
            break
        if await translate_one(session, tender, ai):
            done += 1
        else:
            failed += 1
    return {"translated": done, "failed": failed, "enabled": True}
