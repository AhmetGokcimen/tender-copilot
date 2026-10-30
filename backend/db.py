"""Engine/session setup and the upsert that keeps the JSON-file bug from
ever recurring: it only ever writes Tender's own columns, never touches
UserTenderState.

Switching from SQLite to Postgres later is meant to be just changing
DATABASE_URL — the dialect-specific bit (ON CONFLICT target) is isolated
in _insert_stmt below.
"""

from collections.abc import Generator
from datetime import UTC, datetime

from urllib.parse import quote, unquote

from sqlalchemy import Engine, func, inspect, text, update
from sqlalchemy.exc import ArgumentError
from sqlmodel import Session, SQLModel, create_engine

from backend.core.config import settings
from backend.models.award import Award
from backend.models.tender import SourceSystem, Tender
from backend.models.user_tender_state import UserTenderState

# Postgres = Supabase. Its "public" schema is published through the REST
# API, so this backend keeps every table in its own "backend" schema
# (schema_translate_map applies it to all queries and DDL). psycopg's
# prepared statements are off because Supabase's transaction pooler does
# not support them.
BACKEND_SCHEMA = "backend"


class DatabaseConfigError(RuntimeError):
    """DATABASE_URL is set but unusable. The message never includes the password."""


def _engine_url(raw: str) -> str:
    """Normalizes a Postgres URL as pasted from Supabase: trims whitespace and
    quotes, picks the psycopg driver, and percent-encodes the password so
    characters like @ # / ? in it do not break parsing."""
    url = raw.strip().strip('"').strip("'").strip()
    if url.upper().startswith("DATABASE_URL="):
        url = url.split("=", 1)[1].strip().strip('"').strip("'")
    for prefix in ("postgres://", "postgresql://", "postgresql+psycopg://"):
        if url.startswith(prefix):
            rest = url[len(prefix):]
            break
    else:
        return url
    if "[YOUR-PASSWORD]" in rest or "[YOUR_PASSWORD]" in rest:
        raise DatabaseConfigError("DATABASE_URL still contains the [YOUR-PASSWORD] placeholder")
    if "@" not in rest:
        raise DatabaseConfigError("DATABASE_URL has no user@host part")
    # The host part never contains "@", so the last one ends the credentials.
    creds, host = rest.rsplit("@", 1)
    if ":" in creds:
        user, password = creds.split(":", 1)
        creds = f"{user}:{quote(unquote(password), safe='')}"
    return f"postgresql+psycopg://{creds}@{host}"


def _make_engine(raw: str) -> Engine:
    url = _engine_url(raw)
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    try:
        return create_engine(
            url,
            connect_args={"prepare_threshold": None},
            pool_pre_ping=True,
            pool_size=2,
            max_overflow=3,
        ).execution_options(schema_translate_map={None: BACKEND_SCHEMA})
    except ArgumentError:
        raise DatabaseConfigError(
            "DATABASE_URL could not be parsed; expected postgresql://user:password@host:port/database"
        ) from None


# A bad DATABASE_URL must not stop the module from importing (that takes the
# whole function down, health checks included). Keep the error and raise it
# from init_db instead, so diagnostics can report it.
config_error: DatabaseConfigError | None = None
try:
    engine = _make_engine(settings.database_url)
except DatabaseConfigError as e:
    config_error = e
    engine = create_engine("sqlite://")
_schema = BACKEND_SCHEMA if engine.dialect.name == "postgresql" else None


def init_db() -> None:
    if config_error:
        raise config_error
    if _schema:
        with engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{_schema}"'))
    SQLModel.metadata.create_all(engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """create_all never alters existing tables, so columns added to a
    model later are appended here (nullable, no default). Enough for this
    project's additive changes; a real migration tool can replace it."""
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in SQLModel.metadata.sorted_tables:
            if not insp.has_table(table.name, schema=_schema):
                continue
            existing = {c["name"] for c in insp.get_columns(table.name, schema=_schema)}
            for column in table.columns:
                if column.name in existing:
                    continue
                ddl = column.type.compile(dialect=engine.dialect)
                qualified = f'"{_schema}"."{table.name}"' if _schema else f'"{table.name}"'
                conn.execute(text(f'ALTER TABLE {qualified} ADD COLUMN "{column.name}" {ddl}'))


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
