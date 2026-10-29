"""Migration script tests: real sqlite->sqlite runs (mechanics +
idempotency), CLI guards, and PG-dialect static checks. No live server
needed; a real Postgres run additionally needs TEST_DATABASE_URL.
"""

from datetime import UTC, datetime

import pytest
from sqlalchemy.dialects import postgresql
from sqlmodel import Session, SQLModel, func, select

from backend.db import _insert_stmt, create_app_engine
from backend.models.award import Award
from backend.models.company import CompanyProfile
from backend.models.country_authorization import CountryAuthorization
from backend.models.ocr_job import OcrJob
from backend.models.score_job import ScoreJob
from backend.models.sync_state import SyncCheckpoint
from backend.models.tender import SourceSystem, Tender
from backend.models.user import User
from backend.models.user_company import UserCompany
from backend.models.user_tender_state import UserTenderState
from backend.scripts.migrate_to_postgres import _redact, main, migrate

PG = postgresql.dialect()
SEAP = SourceSystem.ROMANIA_SEAP


def _seed_source(path) -> None:
    """Representative row per table: JSON/enum/datetime variety included."""
    engine = create_app_engine(f"sqlite:///{path.as_posix()}")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        company = CompanyProfile(
            name="Acme",
            industry="construction",
            annual_turnover=1_000_000,
            cpv_codes=["45310000", "45200000"],
            certifications=["ISO 9001"],
        )
        user = User(subject="demo", email="demo@ofera.local", name="Demo", provider="demo")
        s.add(company)
        s.add(user)
        s.flush()
        s.add(UserCompany(user_id=user.id, company_id=company.id, role="owner"))
        s.add(
            CountryAuthorization(
                company_id=company.id, country_code="RO", status="obtained", requirement_notes="ONRC ok"
            )
        )
        s.add(
            Tender(
                source_system=SEAP,
                external_id="T1",
                country_code="RO",
                title="Road works",
                cpv_codes=["45310000"],
                estimated_value=50000,
                currency="RON",
                publication_date=datetime(2026, 1, 5, 10, 0, tzinfo=UTC),
                submission_deadline=datetime(2026, 2, 5, 10, 0, tzinfo=UTC),
                county="Arad",
                procedure_type="open",
                ai_title_simplified="Road works, Arad",
                extracted_requirements={"turnover": {"min_value": 1000}},
                extraction_confidence="high",
            )
        )
        s.add(
            Award(
                source_system=SEAP,
                external_id="A1",
                country_code="RO",
                title="Road award",
                cpv_codes=["45310000"],
                winner_name="BuildCo",
                winner_cif="RO123",
            )
        )
        s.add(
            UserTenderState(
                tender_source_system=SEAP,
                tender_external_id="T1",
                company_id=company.id,
                score=80,
                score_reasons=["cpv match"],
                eligible=True,
                matched_requirements=["turnover ok"],
                status="reviewing",
            )
        )
        s.add(SyncCheckpoint(key="romania_seap:tenders", last_count=5))
        s.add(
            OcrJob(
                tender_source_system=SEAP,
                tender_external_id="T1",
                status="done",
                result={"caiet_name": "caiet.pdf"},
            )
        )
        s.add(ScoreJob(company_id=company.id, status="done", total=10, processed=10))
        s.commit()


def _counts(url: str) -> dict[str, int]:
    engine = create_app_engine(url)
    with Session(engine) as s:
        return {
            m.__tablename__: s.exec(select(func.count()).select_from(m)).one()
            for m in (
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
            )
        }


def test_migrate_copies_everything(tmp_path) -> None:
    src = tmp_path / "src.db"
    tgt = tmp_path / "tgt.db"
    _seed_source(src)
    report = migrate(f"sqlite:///{src.as_posix()}", f"sqlite:///{tgt.as_posix()}", log=lambda *a: None)
    assert sum(report.values()) == 10
    assert _counts(f"sqlite:///{tgt.as_posix()}") == _counts(f"sqlite:///{src.as_posix()}")

    # Spot-check value fidelity (JSON/enum/datetime round-trip, FK coherence).
    engine = create_app_engine(f"sqlite:///{tgt.as_posix()}")
    with Session(engine) as s:
        tender = s.exec(select(Tender).where(Tender.external_id == "T1")).one()
        assert tender.extracted_requirements == {"turnover": {"min_value": 1000}}
        assert tender.cpv_codes == ["45310000"]
        assert tender.source_system == SEAP
        assert tender.submission_deadline == datetime(2026, 2, 5, 10, 0, tzinfo=UTC)
        state = s.exec(select(UserTenderState)).one()
        assert state.eligible is True and state.score == 80
        company = s.get(CompanyProfile, state.company_id)
        assert company is not None and company.name == "Acme"
        assert s.exec(select(UserCompany)).one().role == "owner"


def test_migrate_is_idempotent(tmp_path) -> None:
    src = tmp_path / "src.db"
    tgt = tmp_path / "tgt.db"
    _seed_source(src)
    src_url = f"sqlite:///{src.as_posix()}"
    tgt_url = f"sqlite:///{tgt.as_posix()}"
    first = migrate(src_url, tgt_url, log=lambda *a: None)
    second = migrate(src_url, tgt_url, log=lambda *a: None)
    assert first == second
    assert _counts(tgt_url) == _counts(src_url)


def test_main_dry_run_writes_nothing(tmp_path, capsys) -> None:
    src = tmp_path / "src.db"
    tgt = tmp_path / "tgt.db"
    _seed_source(src)
    rc = main(["--source", f"sqlite:///{src.as_posix()}", "--target", f"sqlite:///{tgt.as_posix()}"])
    assert rc == 0
    assert not tgt.exists()
    assert "Dry run" in capsys.readouterr().out


def test_main_refuses_same_file(tmp_path) -> None:
    src = tmp_path / "src.db"
    _seed_source(src)
    url = f"sqlite:///{src.as_posix()}"
    assert main(["--source", url, "--target", url, "--apply"]) == 2


def test_main_needs_target(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    src = tmp_path / "src.db"
    _seed_source(src)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert main(["--source", f"sqlite:///{src.as_posix()}"]) == 2


def test_insert_stmt_uses_explicit_bind() -> None:
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.dialects.sqlite import insert as lite_insert

    table = Tender.__table__
    pg = create_app_engine("postgresql://u:p@host/db")  # lazy, never connected
    lite = create_app_engine("sqlite:///:memory:")
    assert type(_insert_stmt(table, pg)) is type(pg_insert(table))
    assert type(_insert_stmt(table, lite)) is type(lite_insert(table))


def test_setval_statement_compiles_postgres() -> None:
    from sqlalchemy import func as sa_func
    from sqlalchemy import select as sa_select

    stmt = sa_select(sa_func.setval(sa_func.pg_get_serial_sequence("usertenderstate", "id"), 5))
    compiled = str(stmt.compile(dialect=PG, compile_kwargs={"literal_binds": True}))
    assert "setval" in compiled and "pg_get_serial_sequence" in compiled


def test_redact_hides_password() -> None:
    url = "postgresql://postgres.abc:hunter2@aws-0.pooler.supabase.com:6543/postgres"
    assert _redact(url) == "postgresql://postgres.abc:***@aws-0.pooler.supabase.com:6543/postgres"
    assert _redact("sqlite:///./data/app.db") == "sqlite:///./data/app.db"
