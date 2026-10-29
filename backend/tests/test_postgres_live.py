"""Live-Postgres-only checks: sequence continuity after explicit-id merge
(the migration script's setval path — a no-op on SQLite, so it needs a
real PG to prove anything). Skipped unless TEST_DATABASE_URL points at
Postgres; the rest of the suite runs on both dialects.
"""

import os

import pytest
from sqlmodel import Session, SQLModel, func, select

from backend.db import create_app_engine
from backend.models.company import CompanyProfile
from backend.models.user_tender_state import UserTenderState
from backend.scripts.migrate_to_postgres import _fix_sequences

PG_URL = os.environ.get("TEST_DATABASE_URL", "")
needs_pg = pytest.mark.skipif(
    not PG_URL.startswith(("postgresql://", "postgres://", "postgresql+psycopg://")),
    reason="needs TEST_DATABASE_URL=postgresql://...",
)


@needs_pg
def test_sequences_continue_after_merge() -> None:
    from backend.models.tender import SourceSystem

    engine = create_app_engine(PG_URL)
    SQLModel.metadata.create_all(engine)
    try:
        with Session(engine) as s:
            # Simulate migrated rows: explicit ids, like merge() writes.
            s.add(CompanyProfile(id=7, name="Migrated Co"))
            s.commit()
            s.add(
                UserTenderState(
                    id=99,
                    tender_source_system=SourceSystem.ROMANIA_SEAP,
                    tender_external_id="T9",
                    company_id=7,
                )
            )
            s.commit()
            _fix_sequences(s, log=lambda *a: None)
            fresh_company = CompanyProfile(name="Fresh Co")
            s.add(fresh_company)
            s.commit()
            assert fresh_company.id == 8
            fresh_state = UserTenderState(
                tender_source_system=SourceSystem.ROMANIA_SEAP,
                tender_external_id="T10",  # distinct: (tender, company) is unique
                company_id=7,
            )
            s.add(fresh_state)
            s.commit()
            assert fresh_state.id == 100
            assert s.exec(select(func.max(CompanyProfile.id))).one() == 8
    finally:
        SQLModel.metadata.drop_all(engine)
