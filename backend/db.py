"""Engine/session setup and the upsert that keeps the JSON-file bug from
ever recurring: it only ever writes Tender's own columns, never touches
UserTenderState.

Switching from SQLite to Postgres later is meant to be just changing
DATABASE_URL — the dialect-specific bit (ON CONFLICT target) is isolated
in _insert_stmt below.
"""

from collections.abc import Generator
from datetime import UTC, datetime

from sqlalchemy import func, update
from sqlmodel import Session, SQLModel, create_engine

from core.config import settings
from models.award import Award
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


def upsert_awards(session: Session, awards: list[Award]) -> None:
    """Insert new awards, update existing ones in place by (source_system,
    external_id). Same no-clobber contract as upsert_tenders: never touches
    UserTenderState, and never wipes winner fields with NULL — a re-fetch
    whose PDF parse failed must not erase a previously parsed winner."""
    if not awards:
        return

    table = Award.__table__
    now = datetime.now(UTC)
    values = []
    for a in awards:
        row = a.model_dump()
        row["last_seen_at"] = now
        values.append(row)

    stmt = _insert_stmt(table).values(values)
    update_cols = {
        c.name: getattr(stmt.excluded, c.name)
        for c in table.columns
        if c.name not in ("source_system", "external_id", "first_seen_at")
    }
    # Winner columns: only overwrite when the incoming row actually parsed
    # them (list-only re-fetches carry None and must not clobber).
    for col in ("winner_name", "winner_cif", "winner_raw", "offers_received",
                "offers_from_sme", "contract_no", "contract_date",
                "estimated_initial_value"):
        update_cols[col] = func.coalesce(
            getattr(stmt.excluded, col), getattr(table.c, col)
        )
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


# Whichever of the three upserts below runs first for a given
# (tender, company) pair INSERTs the row — so each supplies this full set
# of defaults, not just its own columns, or the other columns would come
# back as SQL NULL (not these fields' real Python/Pydantic defaults) until
# their own upsert runs. The ON CONFLICT `set_=` below stays scoped to each
# function's own columns either way — this only affects the INSERT branch.
_USER_TENDER_STATE_DEFAULTS = {
    "score": None,
    "score_reasons": [],
    "ai_summary": None,
    "eligible": None,
    "matched_requirements": [],
    "unmet_requirements": [],
    "eligibility_justification": None,
    "status": "new",
    "note": None,
}


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
        **_USER_TENDER_STATE_DEFAULTS,
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
        **_USER_TENDER_STATE_DEFAULTS,
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


def upsert_eligibility(
    session: Session,
    *,
    tender_source_system: SourceSystem,
    tender_external_id: str,
    company_id: int,
    eligible: bool | None,
    matched_requirements: list[str],
    unmet_requirements: list[str],
    eligibility_justification: str,
) -> None:
    """Write the eligibility engine's verdict into UserTenderState. Only
    ever touches the eligibility columns + updated_at — never score or
    ai_summary, same no-clobber pattern as the other upserts here."""
    table = UserTenderState.__table__
    now = datetime.now(UTC)
    values = {
        **_USER_TENDER_STATE_DEFAULTS,
        "tender_source_system": tender_source_system,
        "tender_external_id": tender_external_id,
        "company_id": company_id,
        "eligible": eligible,
        "matched_requirements": matched_requirements,
        "unmet_requirements": unmet_requirements,
        "eligibility_justification": eligibility_justification,
        "updated_at": now,
    }
    stmt = _insert_stmt(table).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["tender_source_system", "tender_external_id", "company_id"],
        set_={
            "eligible": stmt.excluded.eligible,
            "matched_requirements": stmt.excluded.matched_requirements,
            "unmet_requirements": stmt.excluded.unmet_requirements,
            "eligibility_justification": stmt.excluded.eligibility_justification,
            "updated_at": stmt.excluded.updated_at,
        },
    )
    session.execute(stmt)
    session.commit()
