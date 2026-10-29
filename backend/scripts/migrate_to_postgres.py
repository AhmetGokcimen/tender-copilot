"""One-shot SQLite -> Postgres data migration.

Reads every table from the SQLite file, writes to the target DATABASE_URL.
Order respects foreign keys (parents first). Safe to re-run: the two big
tables go through the idempotent ON CONFLICT upserts, every other table
through session.merge() keyed on its PK — a second run changes nothing.
Each table commits separately, so an interrupted run resumes where it
stopped (completed tables are a no-op on re-run).

Target connection: use the DIRECT connection (port 5432), NOT the
transaction pooler — migrations are single sessions and Supabase
recommends direct for them; the pooler (6543) is for the app.

Usage (from repo root; DRY RUN unless --apply is passed):
    python -m backend.scripts.migrate_to_postgres --target "$DIRECT_URL"
    python -m backend.scripts.migrate_to_postgres --target "$DIRECT_URL" --apply
"""

import argparse
import os
import re
import sys
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from sqlmodel import Session, SQLModel, func, select

from backend.db import create_app_engine, upsert_awards, upsert_tenders
from backend.models.award import Award
from backend.models.company import CompanyProfile
from backend.models.country_authorization import CountryAuthorization
from backend.models.ocr_job import OcrJob
from backend.models.score_job import ScoreJob
from backend.models.sync_state import SyncCheckpoint
from backend.models.tender import Tender
from backend.models.user import User
from backend.models.user_company import UserCompany
from backend.models.user_tender_state import UserTenderState

# Parents before children (FK order): Tender/Award/Company/User and the
# standalone tables first, then UserCompany, CountryAuthorization (need a
# company), then UserTenderState (needs a company; tender refs are logical).
TABLE_ORDER = [
    Tender,
    Award,
    CompanyProfile,
    User,
    SyncCheckpoint,
    OcrJob,
    ScoreJob,
    UserCompany,
    CountryAuthorization,
    UserTenderState,
]

# Integer-PK tables whose Postgres sequence must be advanced past the
# migrated max(id) (merge() writes explicit ids, leaving the sequence
# behind — the next plain INSERT would collide without this).
INT_PK_TABLES = [
    CompanyProfile,
    User,
    OcrJob,
    ScoreJob,
    UserCompany,
    CountryAuthorization,
    UserTenderState,
]

LogFn = Callable[..., None]


def _copy_upsert(src: Session, tgt: Session, model, upsert_fn, batch_size: int, log: LogFn) -> int:
    rows = src.exec(select(model)).all()
    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        upsert_fn(tgt, batch)  # commits; ON CONFLICT makes re-runs a no-op
        log(f"  {model.__tablename__}: {min(start + batch_size, len(rows))}/{len(rows)}")
    return len(rows)


def _copy_merge(src: Session, tgt: Session, model, batch_size: int, log: LogFn) -> int:
    rows = src.exec(select(model)).all()
    src.expunge_all()  # merge() wants detached instances, not src-bound ones
    for start in range(0, len(rows), batch_size):
        for row in rows[start : start + batch_size]:
            tgt.merge(row)  # PK-keyed: insert when missing, update when present
        tgt.commit()
        log(f"  {model.__tablename__}: {min(start + batch_size, len(rows))}/{len(rows)}")
    return len(rows)


def _fix_sequences(tgt: Session, log: LogFn) -> None:
    """Advance PG id sequences past migrated max(id). No-op on SQLite."""
    if tgt.get_bind().dialect.name != "postgresql":
        return
    for model in INT_PK_TABLES:
        max_id = tgt.exec(select(func.max(model.id))).one()
        if max_id is None:
            continue
        seq = func.pg_get_serial_sequence(model.__tablename__, "id")
        tgt.exec(select(func.setval(seq, int(max_id))))
        log(f"  sequence {model.__tablename__}.id -> {int(max_id)}")
    tgt.commit()


def migrate(
    source_url: str,
    target_url: str,
    batch_size: int = 500,
    log: LogFn = print,
) -> dict[str, int]:
    """Copy every table from source_url to target_url. Returns per-table
    row counts. Idempotent: re-running changes nothing."""
    src_engine = create_app_engine(source_url)
    tgt_engine = create_app_engine(target_url)
    SQLModel.metadata.create_all(tgt_engine)  # ensure schema on empty targets
    report: dict[str, int] = {}
    with Session(src_engine) as src, Session(tgt_engine) as tgt:
        report[Tender.__tablename__] = _copy_upsert(src, tgt, Tender, upsert_tenders, batch_size, log)
        report[Award.__tablename__] = _copy_upsert(src, tgt, Award, upsert_awards, batch_size, log)
        for model in (
            CompanyProfile,
            User,
            SyncCheckpoint,
            OcrJob,
            ScoreJob,
            UserCompany,
            CountryAuthorization,
            UserTenderState,
        ):
            report[model.__tablename__] = _copy_merge(src, tgt, model, batch_size, log)
        _fix_sequences(tgt, log)
    return report


def _default_source() -> str:
    root = Path(__file__).resolve().parent.parent  # backend/
    return f"sqlite:///{(root / 'data' / 'app.db').as_posix()}"


def _is_same_sqlite_file(source_url: str, target_url: str) -> bool:
    if not (source_url.startswith("sqlite:///") and target_url.startswith("sqlite:///")):
        return False
    src = source_url[len("sqlite:///") :].split("?")[0]
    tgt = target_url[len("sqlite:///") :].split("?")[0]
    try:
        return Path(src).resolve() == Path(tgt).resolve()
    except OSError:
        return src == tgt


def _redact(url: str) -> str:
    return re.sub(r"(://[^/:]+:)[^@]+(@)", r"\1***\2", url)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Copy SQLite data to Postgres (dry run unless --apply).")
    parser.add_argument("--source", default=_default_source())
    parser.add_argument("--target", default=os.environ.get("DATABASE_URL", ""))
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--apply", action="store_true", help="actually write; without it, dry run")
    args = parser.parse_args(argv)

    if not args.target:
        print("No target: pass --target or set DATABASE_URL.", file=sys.stderr)
        return 2
    if _is_same_sqlite_file(args.source, args.target):
        print("Source and target are the same SQLite file — refusing.", file=sys.stderr)
        return 2

    src_engine = create_app_engine(args.source)
    with Session(src_engine) as src:
        plan = {m.__tablename__: src.exec(select(func.count()).select_from(m)).one() for m in TABLE_ORDER}
    print(f"Source: {args.source}")
    print(f"Target: {_redact(args.target)}")
    for name, count in plan.items():
        print(f"  {name}: {count} rows")
    print(f"Total: {sum(plan.values())} rows")
    if not args.apply:
        print("Dry run — nothing written. Pass --apply to migrate.")
        return 0

    started = datetime.now()
    report = migrate(args.source, args.target, batch_size=args.batch_size)
    elapsed = (datetime.now() - started).total_seconds()
    print(f"Migrated {sum(report.values())} rows in {elapsed:.1f}s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
