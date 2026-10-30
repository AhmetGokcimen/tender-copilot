"""Internal/admin endpoints: cron-triggered sync, no user session.

Auth here is deliberately separate from the JWT user system: a shared
secret (SYNC_SECRET env) sent as X-Sync-Token by the scheduled GitHub
Actions workflow. This router MUST stay off the get_current_user
dependency — and user JWTs are not accepted here either.
"""

import hmac
import os
import time
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlmodel import Session

from backend.api.schemas import SyncReport
from backend.core.config import settings
from backend.core.sync import (
    AWARDS_KEY,
    TENDERS_KEY,
    get_checkpoint,
    sync_award_window,
    sync_tender_window,
)
from backend.db import get_session

router = APIRouter()


def _window_start(session: Session, key: str, fallback: datetime) -> datetime:
    cp = get_checkpoint(session, key)
    if cp is not None and cp.window_end is not None:
        return cp.window_end
    return fallback


@router.post("/internal/sync-tenders", response_model=SyncReport, tags=["internal"])
async def sync_tenders(
    lookback_hours: int = Query(default=48, le=168),
    max_tenders: int = Query(default=500, le=2000),
    include_awards: bool = True,
    max_awards: int = Query(default=100, le=500),
    max_seconds: float = Query(default=240, le=900),
    x_sync_token: str | None = Header(default=None),
    session: Session = Depends(get_session),
) -> SyncReport:
    """Pull tenders (+ optionally awards) published since the last run.
    Short-lived and idempotent by design: the checkpoint advances per
    completed slice, caps/timeouts just defer the rest to the next run."""
    if not settings.sync_secret:
        raise HTTPException(status_code=503, detail="Sync not configured")
    if not x_sync_token or not hmac.compare_digest(x_sync_token, settings.sync_secret):
        raise HTTPException(status_code=403, detail="Forbidden")

    started = time.monotonic()
    now = datetime.now(UTC)
    fallback = now - timedelta(hours=lookback_hours)
    tender_start = _window_start(session, TENDERS_KEY, fallback)
    award_start = _window_start(session, AWARDS_KEY, fallback)

    tender_res = await sync_tender_window(
        session, tender_start, now, max_tenders=max_tenders, max_seconds=max_seconds
    )
    awards_synced = 0
    awards_capped = False
    awards_timed_out = False
    awards_pdf_errors = 0
    awards_checkpoint = None
    if include_awards:
        remaining = max_seconds - (time.monotonic() - started)
        if remaining > 0:
            award_res = await sync_award_window(
                session, award_start, now, max_awards=max_awards, max_seconds=remaining
            )
            awards_synced = award_res["synced"]
            awards_capped = award_res["capped"]
            awards_timed_out = award_res["timed_out"]
            awards_pdf_errors = award_res["pdf_errors"]
            awards_checkpoint = award_res["checkpoint"]
        else:
            awards_timed_out = True

    return SyncReport(
        window_start=min(tender_start, award_start),
        window_end=now,
        tenders_synced=tender_res["synced"],
        tenders_capped=tender_res["capped"],
        tenders_timed_out=tender_res["timed_out"],
        tenders_checkpoint=tender_res["checkpoint"],
        awards_synced=awards_synced,
        awards_capped=awards_capped,
        awards_timed_out=awards_timed_out,
        awards_pdf_errors=awards_pdf_errors,
        awards_checkpoint=awards_checkpoint,
        duration_seconds=time.monotonic() - started,
    )


@router.get("/internal/diagnostics", tags=["internal"])
def diagnostics(x_sync_token: str | None = Header(default=None)) -> dict:
    """Deployment check for the sync job (same X-Sync-Token): which database
    the backend uses and whether it answers. Never returns the URL itself."""
    if not settings.sync_secret:
        raise HTTPException(status_code=503, detail="SYNC_SECRET is not configured")
    if not x_sync_token or not hmac.compare_digest(x_sync_token, settings.sync_secret):
        raise HTTPException(status_code=401, detail="Bad sync token")
    from sqlalchemy import text

    from backend.db import config_error, engine

    out: dict = {"dialect": engine.dialect.name, "database_url_set": bool(os.environ.get("DATABASE_URL"))}
    if config_error:
        out["database"] = f"config error: {config_error}"
        return out
    from backend import main

    out["setup_error"] = main.setup_error
    try:
        with engine.connect() as conn:
            conn.execute(text("select 1"))
        out["database"] = "ok"
    except Exception as e:  # noqa: BLE001 — reported, not raised
        out["database"] = f"{type(e).__name__}: {str(e).splitlines()[0][:200]}"
    return out
