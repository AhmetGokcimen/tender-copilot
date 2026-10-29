"""Postgres-compat checks that need no live server: URL normalization,
pooler-safe engine args, and PG-dialect SQL compilation of the upsert
shapes plus every JSON-touching query. Anything needing a real server
runs through TEST_DATABASE_URL (see conftest.py) instead.
"""

from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.pool import NullPool
from sqlmodel import SQLModel

from backend.db import _insert_stmt, _normalize_url, create_app_engine

PG = postgresql.dialect()
LITE = sqlite.dialect()


def _table_names() -> list[str]:
    return sorted(SQLModel.metadata.tables)


def test_normalize_postgres_url() -> None:
    assert _normalize_url("postgresql://u:p@host:6543/db") == "postgresql+psycopg://u:p@host:6543/db"
    assert _normalize_url("postgres://u:p@host:6543/db") == "postgresql+psycopg://u:p@host:6543/db"
    # Explicit schemes pass through untouched.
    assert _normalize_url("postgresql+psycopg://u:p@host/db") == "postgresql+psycopg://u:p@host/db"
    assert _normalize_url("sqlite:///./data/app.db") == "sqlite:///./data/app.db"


def test_engine_kwargs_postgres_pooler_safe() -> None:
    from backend.db import _engine_kwargs

    kwargs = _engine_kwargs("postgresql+psycopg://u:p@aws-0-eu.pooler.supabase.com:6543/postgres")
    assert kwargs["poolclass"] is NullPool
    # Supavisor/pgBouncer transaction mode rejects server-side prepared
    # statements — psycopg must never prepare (Supabase KB: prepare_threshold=None).
    assert kwargs["connect_args"] == {"prepare_threshold": None}


def test_engine_kwargs_sqlite_unchanged() -> None:
    from backend.db import _engine_kwargs

    kwargs = _engine_kwargs("sqlite:///./data/app.db")
    assert kwargs == {"connect_args": {"check_same_thread": False}}


def test_create_app_engine_wires_poolclass() -> None:
    # create_engine is lazy: no connection is opened, so no server needed.
    pg = create_app_engine("postgresql://u:p@host:6543/db")
    assert isinstance(pg.pool, NullPool)
    assert pg.url.drivername == "postgresql+psycopg"
    lite = create_app_engine("sqlite:///./data/app.db")
    assert not isinstance(lite.pool, NullPool)


def test_insert_stmt_dispatches_both_branches() -> None:
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as lite_insert

    from backend.models.tender import Tender

    table = Tender.__table__
    # Explicit binds (lazy engines, never connected) — independent of
    # whatever the module engine happens to be in this run.
    lite_engine = create_app_engine("sqlite:///:memory:")
    pg_engine = create_app_engine("postgresql://u:p@host/db")
    assert type(_insert_stmt(table, lite_engine)) is type(lite_insert(table))
    assert type(_insert_stmt(table, pg_engine)) is type(pg_insert(table))


def test_all_tables_render_on_postgres() -> None:
    from sqlalchemy import select

    for name in _table_names():
        table = SQLModel.metadata.tables[name]
        stmt = select(table).limit(1)
        compiled = str(stmt.compile(dialect=PG, compile_kwargs={"literal_binds": True}))
        assert name in compiled


def test_upsert_shapes_render_on_postgres() -> None:
    """Every table's ON CONFLICT shape must render on PG (identifiers,
    JSON/enum columns, excluded.* refs) — catches reserved-word and type
    issues without a server."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    for name in _table_names():
        table = SQLModel.metadata.tables[name]
        values = {c.name: None for c in table.columns if c.primary_key}
        stmt = pg_insert(table).values(**values).on_conflict_do_nothing()
        compiled = str(stmt.compile(dialect=PG, compile_kwargs={"literal_binds": True}))
        assert "ON CONFLICT DO NOTHING" in compiled


def test_cpv_filter_expression_compiles_both_dialects() -> None:
    from backend.api.routes import cpv_main_filter

    expr = cpv_main_filter("45310000")
    pg_sql = str(expr.compile(dialect=PG, compile_kwargs={"literal_binds": True}))
    lite_sql = str(expr.compile(dialect=LITE, compile_kwargs={"literal_binds": True}))
    assert "LIKE" in pg_sql and "45310000" in pg_sql
    assert "LIKE" in lite_sql and "45310000" in lite_sql
