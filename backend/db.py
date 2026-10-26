"""Engine/session setup and the upsert that keeps the JSON-file bug from
ever recurring: it only ever writes Tender's own columns, never touches
UserTenderState.

Switching from SQLite to Postgres later is meant to be just changing
DATABASE_URL — the dialect-specific bit (ON CONFLICT target) is isolated
in _insert_stmt below.
"""

from collections.abc import Generator
from datetime import UTC, datetime

from sqlalchemy import update
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


_TENDER_UPSERT_EXCLUDED_COLUMNS = (
    "source_system", "external_id", "first_seen_at",
    # Tender-intrinsic AI output: never clobbered by a re-fetch from the
    # adapter. See models.tender's docstring.
    "ai_title_simplified", "extracted_requirements", "extraction_confidence",
)


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
        if c.name not in _TENDER_UPSERT_EXCLUDED_COLUMNS
    }
    stmt = stmt.on_conflict_do_update(
        index_elements=["source_system", "external_id"],
        set_=update_cols,
    )
    session.execute(stmt)
    session.commit()


def upsert_tender_title(
    session: Session, *, source_system: SourceSystem, external_id: str, ai_title_simplified: str
) -> None:
    """Write the simplified title onto Tender. Only touches that one
    column — never extracted_requirements, so the two AI steps (which may
    run independently, at different times) can't clobber each other.

    A plain UPDATE, not an upsert: the caller is expected to have already
    confirmed the tender exists (an INSERT branch would fail anyway, since
    it can't supply Tender's other NOT NULL columns)."""
    session.execute(
        update(Tender)
        .where(Tender.source_system == source_system, Tender.external_id == external_id)
        .values(ai_title_simplified=ai_title_simplified)
    )
    session.commit()


def upsert_tender_extraction(
    session: Session,
    *,
    source_system: SourceSystem,
    external_id: str,
    extracted_requirements: dict,
    extraction_confidence: str,
) -> None:
    """Write extracted requirements onto Tender. Only touches those two
    columns — the simplified title is left alone, same reasoning as
    upsert_tender_title, including the plain-UPDATE rationale."""
    session.execute(
        update(Tender)
        .where(Tender.source_system == source_system, Tender.external_id == external_id)
        .values(extracted_requirements=extracted_requirements, extraction_confidence=extraction_confidence)
    )
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


def upsert_ai_justification(
    session: Session,
    *,
    tender_source_system: SourceSystem,
    tender_external_id: str,
    company_id: int,
    ai_summary: str,
) -> None:
    """Write this tender/company pair's AI justification into
    UserTenderState. Only ever touches ai_summary + updated_at — never
    score or the eligibility fields, same no-clobber pattern as
    upsert_score."""
    table = UserTenderState.__table__
    now = datetime.now(UTC)
    values = {
        "tender_source_system": tender_source_system,
        "tender_external_id": tender_external_id,
        "company_id": company_id,
        "ai_summary": ai_summary,
        "updated_at": now,
    }
    stmt = _insert_stmt(table).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["tender_source_system", "tender_external_id", "company_id"],
        set_={"ai_summary": stmt.excluded.ai_summary, "updated_at": stmt.excluded.updated_at},
    )
    session.execute(stmt)
    session.commit()
