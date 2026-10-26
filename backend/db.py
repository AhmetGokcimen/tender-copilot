"""Engine/session setup and the upsert that keeps the JSON-file bug from
ever recurring: it only ever writes Tender's own columns, never touches
UserTenderState.

Switching from SQLite to Postgres later is meant to be just changing
DATABASE_URL — the dialect-specific bit (ON CONFLICT target) is isolated
in _insert_stmt below.
"""

from collections.abc import Generator
from datetime import UTC, datetime

from sqlmodel import Session, SQLModel, create_engine

from core.config import settings
from models.tender import SourceSystem, Tender
from models.user_tender_state import UserTenderState

_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=_connect_args)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def _insert_stmt(table):
    if engine.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as dialect_insert
    else:
        from sqlalchemy.dialects.sqlite import insert as dialect_insert
    return dialect_insert(table)


def upsert_tenders(session: Session, tenders: list[Tender]) -> None:
    """Insert new tenders, update existing ones in place by (source_system,
    external_id). Never writes to UserTenderState."""
    if not tenders:
        return

    table = Tender.__table__
    now = datetime.now(UTC)
    values = []
    for t in tenders:
        row = t.model_dump()
        row["last_seen_at"] = now
        values.append(row)

    stmt = _insert_stmt(table).values(values)
    update_cols = {
        c.name: getattr(stmt.excluded, c.name)
        for c in table.columns
        if c.name not in ("source_system", "external_id", "first_seen_at")
    }
    stmt = stmt.on_conflict_do_update(
        index_elements=["source_system", "external_id"],
        set_=update_cols,
    )
    session.execute(stmt)
    session.commit()


def upsert_score(
    session: Session,
    *,
    tender_source_system: SourceSystem,
    tender_external_id: str,
    company_id: int,
    score: int,
    reasons: list[str],
) -> None:
    """Write core.scoring's output into UserTenderState. Only ever touches
    score/score_reasons/updated_at — never ai_summary or the eligibility
    fields, so a re-score can't wipe AI output written separately."""
    table = UserTenderState.__table__
    now = datetime.now(UTC)
    values = {
        "tender_source_system": tender_source_system,
        "tender_external_id": tender_external_id,
        "company_id": company_id,
        "score": score,
        "score_reasons": reasons,
        "updated_at": now,
    }
    stmt = _insert_stmt(table).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["tender_source_system", "tender_external_id", "company_id"],
        set_={"score": stmt.excluded.score, "score_reasons": stmt.excluded.score_reasons,
              "updated_at": stmt.excluded.updated_at},
    )
    session.execute(stmt)
    session.commit()


def upsert_ai_enrichment(
    session: Session,
    *,
    tender_source_system: SourceSystem,
    tender_external_id: str,
    company_id: int,
    ai_summary: str,
    ai_title_simplified: str,
) -> None:
    """Write the AI layer's output into UserTenderState. Only ever touches
    the AI columns + updated_at — never score or the eligibility fields,
    same no-clobber pattern as upsert_score."""
    table = UserTenderState.__table__
    now = datetime.now(UTC)
    values = {
        "tender_source_system": tender_source_system,
        "tender_external_id": tender_external_id,
        "company_id": company_id,
        "ai_summary": ai_summary,
        "ai_title_simplified": ai_title_simplified,
        "updated_at": now,
    }
    stmt = _insert_stmt(table).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["tender_source_system", "tender_external_id", "company_id"],
        set_={"ai_summary": stmt.excluded.ai_summary,
              "ai_title_simplified": stmt.excluded.ai_title_simplified,
              "updated_at": stmt.excluded.updated_at},
    )
    session.execute(stmt)
    session.commit()
