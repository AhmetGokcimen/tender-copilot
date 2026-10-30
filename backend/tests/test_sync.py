"""Incremental sync: auth, idempotency, checkpoints, award upserts."""

import asyncio
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.models.award import Award
from backend.models.sync_state import SyncCheckpoint
from backend.models.tender import SourceSystem, Tender
from backend.models.company import CompanyProfile
from backend.models.user_tender_state import UserTenderState

SECRET = "test-sync-secret"


def _mk_tender(external_id: str, pub: datetime) -> Tender:
    return Tender(
        source_system=SourceSystem.ROMANIA_SEAP, external_id=external_id,
        country_code="RO", title=f"Tender {external_id}",
        contracting_authority="Primaria Cluj", cpv_codes=["45233120"],
        publication_date=pub,
    )


def _mk_award(external_id: str, pub: datetime) -> Award:
    return Award(
        source_system=SourceSystem.ROMANIA_SEAP, external_id=external_id,
        country_code="RO", title=f"Award {external_id}",
        contracting_authority="Primaria Cluj", cpv_codes=["45233120"],
        contract_value=1000.0, currency="RON", award_date=pub,
    )


class StubAdapter:
    """Window-aware fake: returns only rows inside [start, end)."""

    source_system = SourceSystem.ROMANIA_SEAP

    def __init__(self, tenders=None, awards=None, detail=None):
        self.tenders = tenders or []
        self.awards = awards or []
        self.detail = detail

    async def fetch_tenders(self, cpv_codes=None, keywords=None, days=30,
                            open_only=False, start=None, end=None, enrich=True):
        return [t for t in self.tenders
                if (start is None or t.publication_date >= start)
                and (end is None or t.publication_date < end)]

    async def fetch_awards(self, cpv_codes=None, days=30, start=None, end=None):
        return [a for a in self.awards
                if (start is None or a.award_date >= start)
                and (end is None or a.award_date < end)]

    async def fetch_award_detail(self, ca_notice_id):
        return self.detail


def test_sync_needs_token(api: TestClient, monkeypatch) -> None:
    monkeypatch.setattr("backend.core.config.settings.sync_secret", SECRET)
    assert api.post("/internal/sync-tenders").status_code == 403
    assert api.post("/internal/sync-tenders",
                    headers={"X-Sync-Token": "wrong"}).status_code == 403
    # A user JWT is not a sync credential either.
    from backend.core.auth import create_access_token

    token = create_access_token(sub="u", email="u@x.ro", name="U", provider="demo")
    assert api.post("/internal/sync-tenders",
                    headers={"Authorization": f"Bearer {token}"}).status_code == 403


def test_sync_refuses_when_unconfigured(api: TestClient, monkeypatch) -> None:
    monkeypatch.setattr("backend.core.config.settings.sync_secret", "")
    res = api.post("/internal/sync-tenders", headers={"X-Sync-Token": "anything"})
    assert res.status_code == 503


def test_sync_is_idempotent(api: TestClient, monkeypatch) -> None:
    from backend.db import engine

    monkeypatch.setattr("backend.core.config.settings.sync_secret", SECRET)
    now = datetime.now(UTC)
    stub = StubAdapter(
        tenders=[_mk_tender("t1", now - timedelta(hours=10)),
                 _mk_tender("t2", now - timedelta(hours=5))],
        awards=[_mk_award("a1", now - timedelta(hours=8))],
    )
    monkeypatch.setattr("backend.core.sync.RomaniaSeapAdapter",
                        lambda *a, **k: stub)
    headers = {"X-Sync-Token": SECRET}

    first = api.post("/internal/sync-tenders?lookback_hours=48&include_awards=true",
                     headers=headers)
    assert first.status_code == 200, first.text
    assert first.json()["tenders_synced"] == 2
    assert first.json()["awards_synced"] == 1

    second = api.post("/internal/sync-tenders?lookback_hours=48&include_awards=true",
                      headers=headers)
    assert second.status_code == 200
    # Checkpoint now covers the window: nothing new to do.
    assert second.json()["tenders_synced"] == 0
    assert second.json()["awards_synced"] == 0

    with Session(engine) as session:
        assert len(session.exec(select(Tender)).all()) == 2
        assert len(session.exec(select(Award)).all()) == 1


def test_sync_caps_between_slices_and_resumes(api: TestClient) -> None:
    """Core-level (a >7d window needs two slices; the endpoint caps
    lookback at 168h by design). First run stops between slices with
    capped=True; second run continues — nothing skipped, nothing duped."""
    from backend.core.sync import sync_tender_window
    from backend.db import engine

    now = datetime.now(UTC)
    stub = StubAdapter(tenders=[
        _mk_tender("old", now - timedelta(days=10)),
        _mk_tender("new", now - timedelta(hours=5)),
    ])
    with Session(engine) as session:
        first = asyncio.run(sync_tender_window(
            session, now - timedelta(days=14), now, adapter=stub, max_tenders=1))
        assert first["synced"] == 1
        assert first["capped"] is True
        mid = first["checkpoint"]

        second = asyncio.run(sync_tender_window(
            session, mid, now, adapter=stub, max_tenders=10))
        assert second["synced"] == 1  # only the later slice's row
        assert second["capped"] is False

        assert len(session.exec(select(Tender)).all()) == 2
        assert session.get(SyncCheckpoint, "romania_seap:tenders") is not None


def test_sync_timeout_leaves_checkpoint_behind(api: TestClient) -> None:
    from backend.core.sync import sync_tender_window
    from backend.db import engine

    now = datetime.now(UTC)
    stub = StubAdapter(tenders=[_mk_tender("t1", now - timedelta(hours=5))])
    with Session(engine) as session:
        res = asyncio.run(sync_tender_window(
            session, now - timedelta(days=14), now, adapter=stub, max_seconds=-1))
        assert res["synced"] == 0
        assert res["timed_out"] is True
        assert res["checkpoint"] is None  # nothing completed, nothing claimed


def test_sync_empty_slice_still_advances(api: TestClient) -> None:
    from backend.core.sync import sync_tender_window
    from backend.db import engine

    now = datetime.now(UTC)
    with Session(engine) as session:
        res = asyncio.run(sync_tender_window(
            session, now - timedelta(days=14), now,
            adapter=StubAdapter(), max_tenders=500))
        assert res["synced"] == 0
        assert res["capped"] is False
        assert res["checkpoint"] is not None  # empty weeks don't pin us


def test_award_resume_skips_finished_pdfs(api: TestClient) -> None:
    from backend.core.sync import sync_award_window
    from backend.db import engine, upsert_awards

    now = datetime.now(UTC)
    calls: list[str] = []

    class CountingStub(StubAdapter):
        async def fetch_award_detail(self, ca_notice_id):
            calls.append(ca_notice_id)

    done = _mk_award("done", now - timedelta(hours=5))
    done.winner_name = "ACME SRL"
    stub = CountingStub(awards=[done, _mk_award("todo", now - timedelta(hours=4))])
    with Session(engine) as session:
        upsert_awards(session, [done])  # previous run parsed this one
        res = asyncio.run(sync_award_window(
            session, now - timedelta(days=1), now, adapter=stub))
        assert res["synced"] == 2
        assert calls == ["todo"]  # finished PDF never re-downloaded


def test_sync_never_touches_company_state(api: TestClient, monkeypatch) -> None:
    from backend.db import engine

    monkeypatch.setattr("backend.core.config.settings.sync_secret", SECRET)
    now = datetime.now(UTC)
    seeded = _mk_tender("t1", now - timedelta(hours=10))
    seeded.ai_title_simplified = "Human title"
    seeded.extracted_requirements = {"minimum_annual_turnover": 5}
    seeded.extraction_confidence = "high"
    with Session(engine) as session:
        session.add(seeded)
        # Postgres enforces the company foreign key (SQLite does not).
        session.add(CompanyProfile(id=7, name="State owner"))
        session.flush()
        session.add(UserTenderState(
            tender_source_system=SourceSystem.ROMANIA_SEAP,
            tender_external_id="t1", company_id=7, score=88,
            score_reasons=["r"], status="reviewing", note="mine",
        ))
        session.commit()

    incoming = _mk_tender("t1", now - timedelta(hours=10))  # fresh re-fetch
    stub = StubAdapter(tenders=[incoming])
    monkeypatch.setattr("backend.core.sync.RomaniaSeapAdapter",
                        lambda *a, **k: stub)
    res = api.post("/internal/sync-tenders?lookback_hours=48&include_awards=false",
                   headers={"X-Sync-Token": SECRET})
    assert res.status_code == 200

    with Session(engine) as session:
        kept = session.get(Tender, (SourceSystem.ROMANIA_SEAP, "t1"))
        assert kept.ai_title_simplified == "Human title"
        assert kept.extracted_requirements == {"minimum_annual_turnover": 5}
        state = session.exec(select(UserTenderState)).one()
        assert (state.score, state.status, state.note) == (88, "reviewing", "mine")


def test_backfill_resumes_from_checkpoint(api: TestClient, monkeypatch) -> None:
    """backend.scripts.backfill_initial.run passes the checkpoint (not the flag
    window) as the next start — kill mid-run, rerun, no rework."""
    import backend.scripts.backfill_initial as backfill
    from backend.core.sync import set_checkpoint

    calls: list = []

    async def fake_tenders(session, start, end, **kwargs):
        calls.append((start, end))
        set_checkpoint(session, "romania_seap:tenders", end, 0)
        return {"synced": 0, "capped": False, "timed_out": False, "checkpoint": end}

    async def fake_awards(session, start, end, **kwargs):
        return {"synced": 0, "capped": False, "timed_out": False,
                "pdf_errors": 0, "checkpoint": end}

    monkeypatch.setattr(backfill, "sync_tender_window", fake_tenders)
    monkeypatch.setattr(backfill, "sync_award_window", fake_awards)

    class Args:
        days = 75
        divisions = "45"
        max_tenders = 5000
        awards_days = 7
        max_awards = 600
        no_awards = True
        max_seconds = 3600

    asyncio.run(backfill.run(Args()))
    first_start = calls[0][0]
    assert (datetime.now(UTC) - first_start).days >= 74  # full flag window

    asyncio.run(backfill.run(Args()))
    assert calls[1][0] >= calls[0][1]  # second run starts where first ended


def test_explicit_window_uses_exact_bounds() -> None:
    """Checkpoint slices are [exact, exact): midnight truncation would
    refetch ~11h of overlap at every boundary on every resume."""
    import json as jsonlib

    import httpx

    from backend.adapters.romania_seap.adapter import RomaniaSeapAdapter

    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if "GetCNoticeList" in str(request.url) or "GetCANoticeList" in str(request.url):
            seen.append(jsonlib.loads(request.content))
            return httpx.Response(200, json={"items": [], "total": 0})
        raise AssertionError(f"unexpected {request.url}")

    adapter = RomaniaSeapAdapter(
        httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="https://e-licitatie.ro"
        )
    )
    start = datetime(2026, 9, 4, 11, 11, 32, tzinfo=UTC)
    end = datetime(2026, 9, 11, 11, 11, 32, tzinfo=UTC)
    asyncio.run(adapter.fetch_tenders(cpv_codes=["45"], start=start, end=end, enrich=False))
    asyncio.run(adapter.fetch_awards(cpv_codes=["45"], start=start, end=end))
    assert len(seen) == 2
    for payload in seen:
        assert payload["startPublicationDate"] == "2026-09-04T11:11:32"
        assert payload["endPublicationDate"] == "2026-09-11T11:11:31"


def test_award_upsert_keeps_winner_on_empty_refetch(api: TestClient) -> None:
    from backend.db import engine, upsert_awards

    now = datetime.now(UTC)
    full = _mk_award("a1", now)
    full.winner_name = "ACME SRL"
    full.winner_cif = "RO123"
    with Session(engine) as session:
        upsert_awards(session, [full])
        # A later list-only re-fetch (PDF failed) carries winner Nones.
        upsert_awards(session, [_mk_award("a1", now)])
        kept = session.get(Award, (SourceSystem.ROMANIA_SEAP, "a1"))
        assert kept.winner_name == "ACME SRL"
        assert kept.winner_cif == "RO123"
        assert len(session.exec(select(Award)).all()) == 1

