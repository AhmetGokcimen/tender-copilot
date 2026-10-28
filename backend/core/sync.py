"""Incremental sync engine: checkpointed, idempotent, bounded.

Both the one-shot backfill script and POST /internal/sync-tenders run
through here. Design rules (serverless-safe):

- Work is sliced into small date windows; the checkpoint advances only
  over fully completed slices, so a timeout/kill resumes instead of
  restarting — and every slice is an upsert, so re-running is harmless.
- Every run is bounded twice: max items AND max seconds. The caller gets
  `capped`/`timed_out` flags and just runs again later (the cron does).
- No scoring, no AI, no UserTenderState writes — raw Tender/Award rows
  only. Request-time layers consume them; sync never triggers them.
"""

import time
from datetime import UTC, datetime, timedelta

from sqlmodel import Session

from db import upsert_awards, upsert_tenders
from models.award import Award
from models.sync_state import SyncCheckpoint
from models.tender import Tender

TENDERS_KEY = "romania_seap:tenders"
AWARDS_KEY = "romania_seap:awards"

# Division-level CPV prefixes synced. Measured 75-day volumes (2026-10-28,
# cPVText prefix match): 45:1499 30:1461 33:1445 50:1161 72:350 60:473 —
# the six busiest divisions; narrower sets starve the feed, wider ones
# bloat it. Overlaps dedup by notice id inside the adapter.
DEFAULT_SYNC_DIVISIONS = ["45", "30", "33", "50", "72", "60"]

SLICE_DAYS = 7


def cpv_group(cpv: str | None) -> str | None:
    """CPV division (first 2 digits): the grouping level for incumbent
    and renewal aggregation. None when the tender has no usable CPV."""
    if not cpv or len(cpv) < 2 or not cpv[:2].isdigit():
        return None
    return cpv[:2]


def get_checkpoint(session: Session, key: str) -> SyncCheckpoint | None:
    return session.get(SyncCheckpoint, key)


def set_checkpoint(session: Session, key: str, window_end: datetime, count: int) -> None:
    cp = session.get(SyncCheckpoint, key)
    if cp is None:
        cp = SyncCheckpoint(key=key, window_end=window_end, last_count=count)
    else:
        cp.window_end = window_end
        cp.last_count = count
        cp.updated_at = datetime.now(UTC)
    session.add(cp)
    session.commit()


def _slices(start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    """Oldest-first SLICE_DAYS windows covering [start, end)."""
    out = []
    cursor = start
    while cursor < end:
        nxt = min(cursor + timedelta(days=SLICE_DAYS), end)
        out.append((cursor, nxt))
        cursor = nxt
    return out


async def sync_tender_window(
    session: Session,
    start: datetime,
    end: datetime,
    *,
    divisions: list[str] | None = None,
    adapter=None,
    max_tenders: int = 500,
    max_seconds: float = 240,
) -> dict:
    """Sync tenders published in [start, end). Advances the checkpoint per
    completed slice; stops early on max_tenders/max_seconds with the
    checkpoint left at the last completed slice."""
    from adapters.romania_seap.adapter import RomaniaSeapAdapter

    worker = adapter or RomaniaSeapAdapter()
    divs = divisions if divisions is not None else DEFAULT_SYNC_DIVISIONS
    deadline = time.monotonic() + max_seconds
    synced = 0
    capped = False
    timed_out = False
    for slice_start, slice_end in _slices(start, end):
        if time.monotonic() >= deadline:
            timed_out = True
            break
        tenders: list[Tender] = await worker.fetch_tenders(
            cpv_codes=divs, start=slice_start, end=slice_end
        )
        remaining = max_tenders - synced
        if len(tenders) > remaining:
            tenders = tenders[:remaining]
            capped = True
        upsert_tenders(session, tenders)
        synced += len(tenders)
        set_checkpoint(session, TENDERS_KEY, slice_end, len(tenders))
        if capped or synced >= max_tenders:
            capped = synced >= max_tenders
            break
    return {
        "synced": synced,
        "capped": capped,
        "timed_out": timed_out,
        "checkpoint": (get_checkpoint(session, TENDERS_KEY).window_end
                       if get_checkpoint(session, TENDERS_KEY) else None),
    }


async def sync_award_window(
    session: Session,
    start: datetime,
    end: datetime,
    *,
    divisions: list[str] | None = None,
    adapter=None,
    max_awards: int = 100,
    max_seconds: float = 240,
) -> dict:
    """Sync awards published in [start, end), winner PDFs included. Same
    checkpoint/cap/timeout contract as sync_tender_window. A failed PDF
    parse keeps the list-level row (winner null) and counts as an error —
    it never fails the slice."""
    from adapters.romania_seap.adapter import RomaniaSeapAdapter

    worker = adapter or RomaniaSeapAdapter()
    divs = divisions if divisions is not None else DEFAULT_SYNC_DIVISIONS
    deadline = time.monotonic() + max_seconds
    synced = 0
    capped = False
    timed_out = False
    pdf_errors = 0
    for slice_start, slice_end in _slices(start, end):
        if time.monotonic() >= deadline:
            timed_out = True
            break
        awards: list[Award] = await worker.fetch_awards(
            cpv_codes=divs, start=slice_start, end=slice_end
        )
        remaining = max_awards - synced
        if len(awards) > remaining:
            awards = awards[:remaining]
            capped = True
        for award in awards:
            if time.monotonic() >= deadline:
                timed_out = True
                break
            try:
                detail = await worker.fetch_award_detail(award.external_id)
            except Exception:  # noqa: BLE001 — partial row kept, see docstring
                pdf_errors += 1
                continue
            if detail is not None:
                award.winner_name = detail.winner_name
                award.winner_cif = detail.winner_cif
                award.winner_raw = detail.winner_raw
                award.offers_received = detail.offers_received
                award.offers_from_sme = detail.offers_from_sme
                award.contract_no = detail.contract_no
                award.contract_date = detail.contract_date
                award.estimated_initial_value = detail.estimated_initial_value
                if award.award_date is None:
                    award.award_date = detail.publication_date
            else:
                pdf_errors += 1
        upsert_awards(session, awards)
        synced += len(awards)
        set_checkpoint(session, AWARDS_KEY, slice_end, len(awards))
        if timed_out:
            break
        if capped or synced >= max_awards:
            capped = synced >= max_awards
            break
    return {
        "synced": synced,
        "capped": capped,
        "timed_out": timed_out,
        "pdf_errors": pdf_errors,
        "checkpoint": (get_checkpoint(session, AWARDS_KEY).window_end
                       if get_checkpoint(session, AWARDS_KEY) else None),
    }
