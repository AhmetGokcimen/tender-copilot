"""Plan caps on the model-backed features: Free is tight, paid plans have a ceiling."""

import json as _json

import pytest
from fastapi.testclient import TestClient

from backend.tests.test_feed import _auth, seed  # noqa: F401 - fixture and auth helper


@pytest.fixture()
def free(seed: TestClient, monkeypatch: pytest.MonkeyPatch) -> TestClient:  # noqa: F811
    """A seeded app on the Free plan with the model replaced by a stub."""
    from backend.ai.client import MetaAIClient
    from backend.core import agents as agents_core
    from backend.core.config import settings

    async def fake_chat(self, system: str, user: str, **_kw):  # noqa: ANN001
        if "Spec Analyst" in system:
            return _json.dumps({"items": [{"ref": "R1", "text": "x", "category": "qualification"}]})
        if "Eligibility Checker" in system:
            return _json.dumps({"rows": [], "summary": "ok"})
        if "assistant" in system.lower() or "pipeline-board" in system:
            return _json.dumps({"message": "hi", "navigate_to": None, "highlight_hook": None, "agent": "spec"})
        return "{}"

    async def fake_source(adapter, tender, ai):  # noqa: ANN001
        return "notice text", False, []

    monkeypatch.setattr(MetaAIClient, "_chat", fake_chat)
    monkeypatch.setattr(agents_core, "gather_source", fake_source)
    monkeypatch.setattr(settings, "meta_api_key", "test-key")
    monkeypatch.setattr(settings, "default_plan", "free")
    return seed


def _agent(client: TestClient, tender: str, agent: str):
    return client.post(f"/api/tenders/{tender}/agents/{agent}", json={}, headers=_auth())


def test_free_go_no_go_is_three_tenders_and_a_repeat_is_free(free: TestClient) -> None:
    for tender in ("1001", "1002", "1003"):
        assert _agent(free, tender, "eligibility").status_code == 200
    assert _agent(free, "1003", "eligibility").status_code == 200  # same tender again costs nothing
    assert _agent(free, "1003", "spec").status_code == 200  # the spec read is part of the same look
    free.post("/api/tenders/1001/translate", headers=_auth())
    usage = free.get("/api/usage", headers=_auth()).json()
    assert usage["plan"] == "free" and usage["limits"]["gonogo"] == {"used": 3, "limit": 3, "period": "month"}


def test_free_go_no_go_fourth_tender_is_refused(free: TestClient) -> None:
    from sqlmodel import Session

    from backend.db import engine
    from backend.models.tender import SourceSystem, Tender

    with Session(engine) as session:
        session.add(Tender(source_system=SourceSystem.ROMANIA_SEAP, external_id="1004", country_code="RO", title="Extra"))
        session.commit()
    for tender in ("1001", "1002", "1003"):
        assert _agent(free, tender, "eligibility").status_code == 200
    assert _agent(free, "1004", "eligibility").status_code == 429


def test_free_gets_one_bid_file_for_life(free: TestClient) -> None:
    for agent in ("legal", "writer", "risk"):
        assert _agent(free, "1001", agent).status_code == 200  # one file = the three agents on one tender
    assert _agent(free, "1002", "writer").status_code == 429
    assert _agent(free, "1001", "writer").status_code == 200  # the file already made can be rebuilt


def test_failed_run_does_not_spend_a_unit(free: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.core import agents as agents_core

    async def boom(*_a, **_k):  # noqa: ANN002, ANN003
        raise RuntimeError("model down")

    monkeypatch.setattr(agents_core, "run_agent", boom)
    with pytest.raises(RuntimeError):
        _agent(free, "1001", "writer")
    assert free.get("/api/usage", headers=_auth()).json()["limits"]["bid_pack"]["used"] == 0


def test_free_assistant_is_ten_messages(free: TestClient) -> None:
    body = {"question": "hi", "pathname": "/app", "tenderId": None, "dom": [], "history": []}
    for _ in range(10):
        assert free.post("/api/assistant/chat", json=body, headers=_auth()).status_code == 200
    assert free.post("/api/assistant/chat", json=body, headers=_auth()).status_code == 429
    assert free.get("/api/usage", headers=_auth()).json()["limits"]["assistant"]["used"] == 10


def test_free_has_no_api_keys(free: TestClient) -> None:
    res = free.post("/api/api-keys", json={"name": "k"}, headers=_auth())
    assert res.status_code == 403
    assert free.get("/api/api-keys", headers=_auth()).json()["daily_limit"] == 0


def test_paid_plans_have_their_own_caps(seed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    from backend.core.config import settings

    monkeypatch.setattr(settings, "default_plan", "growth")
    usage = seed.get("/api/usage", headers=_auth()).json()
    assert usage["plan"] == "growth"
    assert usage["limits"]["gonogo"] == {"used": 0, "limit": 300, "period": "month"}
    assert usage["limits"]["bid_pack"]["limit"] == 10
    assert usage["limits"]["assistant"] == {"used": 0, "limit": 40, "period": "day"}
    assert "past_winners" not in usage["limits"]  # paid plans keep the deployment setting for now


def test_paid_assistant_cap_is_per_day(free: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.core import plans

    monkeypatch.setitem(plans.PLAN_LIMITS, "growth", {"assistant": ("day", 2)})
    monkeypatch.setattr("backend.core.config.settings.default_plan", "growth")
    body = {"question": "hi", "pathname": "/app", "tenderId": None, "dom": [], "history": []}
    assert free.post("/api/assistant/chat", json=body, headers=_auth()).status_code == 200
    assert free.post("/api/assistant/chat", json=body, headers=_auth()).status_code == 200
    assert free.post("/api/assistant/chat", json=body, headers=_auth()).status_code == 429


def test_a_plan_without_a_cap_is_unlimited(free: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.core import plans

    monkeypatch.setitem(plans.PLAN_LIMITS, "growth", {})
    monkeypatch.setattr("backend.core.config.settings.default_plan", "growth")
    for tender in ("1001", "1002", "1003"):
        for _ in range(2):
            assert _agent(free, tender, "writer").status_code == 200
    assert free.get("/api/usage", headers=_auth()).json()["limits"] == {}


def test_a_users_own_plan_beats_the_default(free: TestClient) -> None:
    from sqlmodel import Session, select

    from backend.db import engine
    from backend.models.user import User

    with Session(engine) as session:
        for user in session.exec(select(User)).all():
            user.plan = "pro"
            session.add(user)
        session.commit()
    usage = free.get("/api/usage", headers=_auth()).json()
    assert usage["plan"] == "pro" and usage["limits"]["gonogo"]["limit"] == 600
