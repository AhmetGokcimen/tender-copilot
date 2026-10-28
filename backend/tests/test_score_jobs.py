"""Async scoring jobs: 202 spawn, progress poll, dedupe, isolation."""

import asyncio
from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from core.membership import get_or_create_user, link_user_company
from models.company import CompanyProfile
from models.score_job import ScoreJob
from models.tender import SourceSystem, Tender
from models.user_tender_state import UserTenderState


def _auth(sub="u") -> dict:
    from core.auth import create_access_token

    token = create_access_token(
        sub=sub, email=f"{sub}@x.ro", name="U", provider="demo"
    )
    return {"Authorization": f"Bearer {token}"}


def _seed_company(session: Session, sub="u", name="Score Co") -> CompanyProfile:
    session.add(CompanyProfile(name=name))
    session.commit()
    user = get_or_create_user(
        session, subject=sub, email=f"{sub}@x.ro", name="U", provider="demo"
    )
    company = session.exec(select(CompanyProfile)).all()[-1]
    link_user_company(session, user.id, company.id)
    return company


def _seed_tenders(session: Session, n: int) -> None:
    for i in range(n):
        session.add(Tender(
            source_system=SourceSystem.ROMANIA_SEAP, external_id=f"s{i}",
            country_code="RO", title=f"Road works {i}",
            cpv_codes=["45233120"],
            publication_date=datetime(2026, 5, 5, tzinfo=UTC),
        ))
    session.commit()


def test_post_score_returns_202_and_scores_all(api: TestClient) -> None:
    from db import engine

    with Session(engine) as session:
        _seed_company(session)
        _seed_tenders(session, 5)
    # The 202 carries the pre-work snapshot (pending); the worker may or
    # may not have run inline depending on the TestClient version, so replay
    # it explicitly — idempotent, deterministic either way. Production
    # callers poll the GET below instead.
    from core.score_jobs import run_score_job

    res = api.post("/api/companies/1/score", headers=_auth())
    assert res.status_code == 202, res.text
    assert res.json()["status"] == "pending"
    asyncio.run(run_score_job(res.json()["job_id"]))
    with Session(engine) as session:
        states = session.exec(select(UserTenderState)).all()
        assert len(states) == 5
        assert all(s.score is not None for s in states)
    done = api.get("/api/companies/1/score", headers=_auth()).json()
    assert (done["status"], done["processed"], done["total"]) == ("done", 5, 5)
    assert done["error"] is None


def test_post_score_dedupes_active_job(api: TestClient) -> None:
    from db import engine

    with Session(engine) as session:
        _seed_company(session)
        _seed_tenders(session, 2)
        session.add(ScoreJob(company_id=1, status="running", total=2, processed=1))
        session.commit()
    res = api.post("/api/companies/1/score", headers=_auth())
    assert res.status_code == 200  # active job returned, no duplicate spawned
    assert res.json()["processed"] == 1
    with Session(engine) as session:
        assert len(session.exec(select(ScoreJob)).all()) == 1


def test_get_score_progress_and_404(api: TestClient) -> None:
    from db import engine

    with Session(engine) as session:
        _seed_company(session)
        _seed_tenders(session, 3)
    from core.score_jobs import run_score_job

    assert api.get("/api/companies/1/score", headers=_auth()).status_code == 404
    posted = api.post("/api/companies/1/score", headers=_auth())
    asyncio.run(run_score_job(posted.json()["job_id"]))  # replay: see note above
    res = api.get("/api/companies/1/score", headers=_auth())
    assert res.status_code == 200
    assert res.json()["processed"] == res.json()["total"] == 3


def test_score_isolation(api: TestClient) -> None:
    from db import engine

    with Session(engine) as session:
        _seed_company(session, sub="owner")
        outsider = get_or_create_user(
            session, subject="stranger", email="s@x.ro", name="S", provider="demo"
        )
        assert outsider is not None
    assert api.post("/api/companies/1/score", headers=_auth("stranger")).status_code == 403
    assert api.get("/api/companies/1/score", headers=_auth("stranger")).status_code == 403


def test_worker_fails_gracefully_for_missing_company(api: TestClient) -> None:
    from core.score_jobs import run_score_job
    from db import engine

    with Session(engine) as session:
        session.add(ScoreJob(company_id=4242, status="pending"))
        session.commit()
        job_id = session.exec(select(ScoreJob)).one().id
    asyncio.run(run_score_job(job_id))
    with Session(engine) as session:
        job = session.get(ScoreJob, job_id)
        assert job.status == "failed"
        assert "no longer exists" in (job.error or "")


def test_reap_stale_score_jobs(api: TestClient) -> None:
    from core.score_jobs import reap_stale_jobs
    from db import engine

    with Session(engine) as session:
        session.add(ScoreJob(company_id=1, status="running", total=9, processed=4))
        session.add(ScoreJob(company_id=1, status="done", total=9, processed=9))
        session.commit()
        assert reap_stale_jobs(session) == 1
        rows = {j.id: j.status for j in session.exec(select(ScoreJob)).all()}
        assert sorted(rows.values()) == ["done", "failed"]


def test_score_worker_preserves_ai_and_user_fields(api: TestClient) -> None:
    """The async path keeps the old sync path's no-clobber guarantee:
    scores land, everything else stays."""
    from core.score_jobs import run_score_job
    from db import engine

    with Session(engine) as session:
        company = _seed_company(session)
        _seed_tenders(session, 2)
        session.add(UserTenderState(
            tender_source_system=SourceSystem.ROMANIA_SEAP,
            tender_external_id="s0", company_id=company.id,
            score=1, score_reasons=["stale"], ai_summary="keep me",
            status="reviewing", note="mine", eligible=True,
        ))
        session.commit()
        session.add(ScoreJob(company_id=company.id, status="pending"))
        session.commit()
        job_id = session.exec(select(ScoreJob)).one().id
    asyncio.run(run_score_job(job_id))
    with Session(engine) as session:
        kept = session.exec(
            select(UserTenderState).where(UserTenderState.tender_external_id == "s0")
        ).one()
        assert kept.ai_summary == "keep me"
        assert (kept.status, kept.note, kept.eligible) == ("reviewing", "mine", True)
        assert kept.score == 0  # fresh evaluate (no CPV overlap) replaced stale 1
        job = session.get(ScoreJob, job_id)
        assert (job.status, job.processed, job.total) == ("done", 2, 2)
