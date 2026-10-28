"""One-shot initial backfill: bounded history for tenders + awards.

Fills the database with ENOUGH history to make the feed look alive and to
feed incumbent/renewal analysis — not an archive. Defaults: 75 days of
tenders (cap 5000, effectively the whole window) + the most recent 7
days of awards (cap 600), oldest slices first, checkpointed per slice:
kill it halfway and rerun, it resumes where it stopped.

Why these shapes: tender volume (~400/week across the six divisions)
fits the full window; awards (~60/day with a PDF parse each) are
deliberately a recent sample — depth comes from tenders, winners from
recent awards. Measured 2026-10-28; see backend/API_CHANGES.md.

Politeness: same 0.3s inter-request delay as the adapter's normal sync,
sequential slices, no extra parallelism. Watch the progress lines for
the live request rhythm.

Usage (from backend/):
    python -m scripts.backfill_initial [--days 75] [--max-tenders 5000]
        [--awards-days 7] [--max-awards 600] [--no-awards]
        [--divisions 45,30,33,50,72,60]
"""

import argparse
import asyncio
import sys
import time
from datetime import UTC, datetime, timedelta

from sqlmodel import Session

from core.sync import (
    AWARDS_KEY,
    DEFAULT_SYNC_DIVISIONS,
    TENDERS_KEY,
    get_checkpoint,
    sync_award_window,
    sync_tender_window,
)
from db import engine, init_db


def _window_start(session: Session, key: str, days: int, label: str) -> datetime:
    """Resume from the checkpoint when one exists, else the requested
    lookback. The checkpoint always marks genuinely completed slices, so
    it wins even when older than the requested window."""
    now = datetime.now(UTC)
    cp = get_checkpoint(session, key)
    if cp is not None and cp.window_end is not None:
        start = min(cp.window_end, now)
        print(f"[{label}] resuming from checkpoint {start.isoformat()}", flush=True)
        return start
    start = now - timedelta(days=days)
    print(f"[{label}] no checkpoint, starting at {start.isoformat()}", flush=True)
    return start


async def run(args: argparse.Namespace) -> dict:
    init_db()
    started = time.monotonic()
    now = datetime.now(UTC)
    divisions = [d.strip() for d in args.divisions.split(",") if d.strip()]
    summary: dict = {"divisions": divisions}

    with Session(engine) as session:
        window_start = _window_start(session, TENDERS_KEY, args.days, "tenders")
        if window_start >= now:
            print("[tenders] checkpoint already at now — nothing to do.")
            summary["tenders"] = {"synced": 0, "capped": False, "timed_out": False}
        else:
            print(
                f"[tenders] window {window_start.date()} -> {now.date()}, "
                f"cap {args.max_tenders}",
                flush=True,
            )
            summary["tenders"] = await sync_tender_window(
                session,
                window_start,
                now,
                divisions=divisions,
                max_tenders=args.max_tenders,
                max_seconds=args.max_seconds,
            )
            print(f"[tenders] done: {summary['tenders']}", flush=True)

        if args.no_awards:
            summary["awards"] = {"synced": 0, "skipped": True}
        else:
            award_start = _window_start(session, AWARDS_KEY, args.awards_days, "awards")
            if award_start >= now:
                print("[awards] checkpoint already at now — nothing to do.")
                summary["awards"] = {"synced": 0, "capped": False, "timed_out": False}
            else:
                print(
                    f"[awards] window {award_start.date()} -> {now.date()}, "
                    f"cap {args.max_awards}",
                    flush=True,
                )
                summary["awards"] = await sync_award_window(
                    session,
                    award_start,
                    now,
                    divisions=divisions,
                    max_awards=args.max_awards,
                    max_seconds=args.max_seconds,
                )
                print(f"[awards] done: {summary['awards']}", flush=True)

    summary["duration_seconds"] = round(time.monotonic() - started, 1)
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--days", type=int, default=75)
    parser.add_argument("--divisions", default=",".join(DEFAULT_SYNC_DIVISIONS))
    parser.add_argument("--max-tenders", type=int, default=5000)
    parser.add_argument("--awards-days", type=int, default=7)
    parser.add_argument("--max-awards", type=int, default=600)
    parser.add_argument("--no-awards", action="store_true")
    parser.add_argument("--max-seconds", type=float, default=3600)
    args = parser.parse_args(argv)

    summary = asyncio.run(run(args))
    print(f"BACKFILL SUMMARY: {summary}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
