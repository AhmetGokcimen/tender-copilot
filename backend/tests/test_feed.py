"""Frontend-contract feed: nested shape, filters, sort, company, evidence."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.models.company import CompanyProfile
from backend.models.tender import SourceSystem, Tender
from backend.models.user_tender_state import UserTenderState

TENDER_KEYS = {
    "source_system", "external_id", "country_code", "title", "cpv_codes",
    "estimated_value", "currency", "publication_date", "submission_deadline",
    "raw_description", "source_url", "authority", "county", "procedure_type",
    "clarification_deadline", "state", "renewal_pattern", "brief",
}
STATE_KEYS = {
    "score", "score_reasons", "ai_summary", "ai_title_simplified", "summary_en",
    "extracted_requirements", "eligible", "country_authorization_status",
    "matched_requirements", "unmet_requirements", "missing_documents",
    "eligibility_justification", "status",
}
COMPANY_KEYS = {
    "id", "name", "cui", "industry", "founded_year", "team_size",
    "cpv_codes", "secondary_cpv_codes", "annual_capacity", "certifications",
    "blacklist_keywords", "annual_turnover", "annual_turnover_currency",
    "similar_experience_value", "similar_experience_currency",
    "similar_experience_contract_count", "target_countries", "keywords",
    "website", "subsectors", "annual_capacity_currency", "team_eu_count",
    "team_non_eu_count",
}

EXTRACTION = {
    "minimum_annual_turnover": 1000000.0,
    "turnover_currency": "RON",
    "similar_experience_years": None,
    "similar_experience_minimum_value": None,
    "similar_experience_minimum_value_currency": None,
    "similar_experience_max_contracts": None,
    "required_certifications": ["ISO 9001:2015", "ISO 27001"],
    "guarantee_amount": 50000.0,
    "guarantee_currency": "RON",
    "other_requirements": ["Warranty 24 months"],
    "uncertain_points": ["Deadline extension unclear"],
    "extraction_confidence": "high",
    "raw_model_output": None,
}


@pytest.fixture()
def seed(api: TestClient):
    from backend.db import engine

    with Session(engine) as session:
        session.add(
            CompanyProfile(
                name="SC Transilvania Soft SRL", cui="RO18402933",
                cpv_codes=["30200000"], annual_capacity=15000000.0,
                certifications=["ISO 9001:2015"], blacklist_keywords=[],
            )
        )
        session.add(
            Tender(
                source_system=SourceSystem.ROMANIA_SEAP, external_id="1001",
                country_code="RO", title="Laptops for schools",
                contracting_authority="Ministerul Educatiei", cpv_codes=["30200000"],
                estimated_value=4200000.0, currency="RON",
                publication_date=datetime(2026, 10, 18, tzinfo=UTC),
                submission_deadline=datetime(2026, 11, 20, tzinfo=UTC),
                source_url="https://e-licitatie.ro/1001",
                county="Cluj", procedure_type="open",
                clarification_deadline=datetime(2026, 11, 10, tzinfo=UTC),
                ai_title_simplified="School laptops",
                extracted_requirements=EXTRACTION, extraction_confidence="high",
            )
        )
        session.add(
            Tender(
                source_system=SourceSystem.ROMANIA_SEAP, external_id="1002",
                country_code="RO", title="City hall helpdesk",
                contracting_authority="Primaria Cluj", cpv_codes=["50300000"],
                estimated_value=860000.0, currency="RON",
                publication_date=datetime(2026, 10, 10, tzinfo=UTC),
                submission_deadline=datetime(2026, 10, 30, tzinfo=UTC),
                county="Brasov", procedure_type="restricted",
            )
        )
        session.add(
            Tender(
                source_system=SourceSystem.ROMANIA_SEAP, external_id="1003",
                country_code="RO", title="Catering framework",
                cpv_codes=["55500000"],
                publication_date=datetime(2026, 10, 24, tzinfo=UTC),
            )
        )
        session.commit()
        company = session.get(CompanyProfile, 1)
        assert company is not None
        from backend.core.membership import get_or_create_user, link_user_company

        user = get_or_create_user(
            session, subject="u", email="u@x.ro", name="U", provider="demo"
        )
        link_user_company(session, user.id, company.id)
        session.add(
            UserTenderState(
                tender_source_system=SourceSystem.ROMANIA_SEAP,
                tender_external_id="1001", company_id=company.id, score=92,
                score_reasons=["CPV match"], ai_summary="Buy laptops.",
                eligible=True, matched_requirements=["ISO 9001:2015"],
                unmet_requirements=["ISO 27001"],
                eligibility_justification="Mostly eligible.", status="new",
            )
        )
        session.add(
            UserTenderState(
                tender_source_system=SourceSystem.ROMANIA_SEAP,
                tender_external_id="1002", company_id=company.id, score=55,
                score_reasons=["Partial overlap"], status="reviewing",
            )
        )
        session.commit()
    return api


def _auth() -> dict:
    from backend.core.auth import create_access_token

    token = create_access_token(sub="u", email="u@x.ro", name="U", provider="demo")
    return {"Authorization": f"Bearer {token}"}


def test_feed_matches_frontend_shape_exactly(seed: TestClient) -> None:
    items = seed.get("/api/tenders", headers=_auth()).json()
    assert [t["external_id"] for t in items] == ["1001", "1002", "1003"]  # match sort
    for item in items:
        assert set(item) == TENDER_KEYS, set(item) ^ TENDER_KEYS
        assert set(item["state"]) == STATE_KEYS, set(item["state"]) ^ STATE_KEYS

    first, _, last = items
    assert first["authority"] == "Ministerul Educatiei"
    assert first["county"] == "Cluj"
    assert first["state"]["extracted_requirements"] == [
        "Annual turnover ≥ 1,000,000 RON",
        "ISO 9001:2015",
        "ISO 27001",
        "Bid guarantee 50,000 RON",
        "Warranty 24 months",
    ]
    assert first["state"]["missing_documents"] == ["ISO 27001"]
    assert first["state"]["ai_title_simplified"] == "School laptops"

    assert last["authority"] == ""
    assert last["county"] == ""
    assert last["procedure_type"] == "open"
    assert last["state"]["status"] == "new"
    # No scoring job ran for this tender, so the feed scored it on the spot.
    assert last["state"]["score"] == 0
    assert last["state"]["score_reasons"]
    assert last["state"]["extracted_requirements"] == []


def test_feed_filters_and_sort(seed: TestClient) -> None:
    get = lambda q: [t["external_id"] for t in seed.get(f"/api/tenders{q}", headers=_auth()).json()]
    assert get("?county=Cluj") == ["1001"]
    assert get("?cpv_code=50300000") == ["1002"]
    assert get("?min_value=1000000") == ["1001"]
    assert get("?min_score=90") == ["1001"]
    assert get("?procedure_type=restricted") == ["1002"]
    assert get("?eligible=true") == ["1001"]
    assert get("?search=laptop") == ["1001"]
    assert get("?sort=deadline") == ["1002", "1001", "1003"]
    assert get("?sort=value") == ["1001", "1002", "1003"]
    assert get("?limit=1&offset=1") == ["1002"]
    assert get("?county=Nowhere") == []


def test_feed_detail_and_company_scope(seed: TestClient) -> None:
    item = seed.get("/api/tenders/1002", headers=_auth()).json()
    assert item["external_id"] == "1002"
    assert item["state"]["status"] == "reviewing"
    assert seed.get("/api/tenders/nope", headers=_auth()).status_code == 404

    from backend.core.membership import link_user_company
    from backend.db import engine
    from backend.models.user import User

    with Session(engine) as session:
        session.add(CompanyProfile(name="Second Co"))
        session.commit()
        me = session.exec(select(User).where(User.subject == "u")).one()
        link_user_company(session, me.id, 2)
    scoped = seed.get("/api/tenders/1001?company_id=2", headers=_auth()).json()
    assert scoped["state"]["score"] == 0  # scored on the spot for the second company, not the first one's 92


def test_company_and_evidence(seed: TestClient) -> None:
    company = seed.get("/api/company", headers=_auth()).json()
    assert set(company) == COMPANY_KEYS
    assert (company["name"], company["cui"]) == ("SC Transilvania Soft SRL", "RO18402933")
    evidence = seed.get("/api/company/evidence", headers=_auth()).json()
    assert evidence == [
        {"id": "cert-1", "name": "ISO 9001:2015", "type": "Certification",
         "valid_until": None}
    ]


def test_company_missing_returns_404(api: TestClient) -> None:
    assert api.get("/api/company", headers=_auth()).status_code == 404
    assert api.get("/api/tenders", headers=_auth()).json() == []


def test_status_patch_updates_state(seed: TestClient) -> None:
    res = seed.patch(
        "/api/tenders/1002/status", json={"status": "applied"}, headers=_auth()
    )
    assert res.status_code == 200
    assert res.json()["state"]["status"] == "applied"
    assert seed.get("/api/tenders/1002", headers=_auth()).json()["state"]["status"] == "applied"
    bad = seed.patch("/api/tenders/1002/status", json={"status": "bogus"}, headers=_auth())
    assert bad.status_code == 422
    missing = seed.patch("/api/tenders/1003/status", json={"status": "applied"}, headers=_auth())
    assert missing.status_code == 404  # no state row yet — score first, like the company PATCH


def test_feed_needs_auth(seed: TestClient) -> None:
    assert seed.get("/api/tenders").status_code == 401


def test_translate_makes_english_title_and_summary_once(seed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.ai.client import MetaAIClient
    from backend.core.config import settings

    calls: list[str] = []

    async def fake(self, title: str, description: str | None):  # noqa: ANN001
        calls.append(title)
        return "Catering framework (EN)", "Food service for public institutions."

    monkeypatch.setattr(MetaAIClient, "translate_tender", fake)
    monkeypatch.setattr(settings, "meta_api_key", "test-key")

    first = seed.post("/api/tenders/1003/translate", headers=_auth()).json()
    assert first["state"]["ai_title_simplified"] == "Catering framework (EN)"
    assert first["state"]["summary_en"] == "Food service for public institutions."
    seed.post("/api/tenders/1003/translate", headers=_auth())
    assert calls == ["Catering framework"]  # kept, not asked again


def test_translate_without_key_leaves_fields_empty(seed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.core.config import settings

    monkeypatch.setattr(settings, "meta_api_key", "")
    out = seed.post("/api/tenders/1003/translate", headers=_auth()).json()
    assert out["state"]["summary_en"] is None


def test_brief_is_built_once_and_kept(seed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.adapters.romania_seap.adapter import RomaniaSeapAdapter
    from backend.ai.client import MetaAIClient, TenderBrief
    from backend.core.config import settings

    calls: list[str] = []

    async def fake_brief(self, text: str, *, language: str = "English"):  # noqa: ANN001
        calls.append(language)
        return TenderBrief(overview=f"Overview in {language}", scope=["Install 120 kWp PV"])

    async def no_caiet(self, external_id, notice_type_id):  # noqa: ANN001
        return None

    async def no_text(self, external_id, notice_type_id):  # noqa: ANN001
        return "Technical ability:\nSimilar works"

    monkeypatch.setattr(MetaAIClient, "build_brief", fake_brief)
    monkeypatch.setattr(RomaniaSeapAdapter, "fetch_caiet_pdf", no_caiet)
    monkeypatch.setattr(RomaniaSeapAdapter, "fetch_eligibility_text", no_text)
    monkeypatch.setattr(settings, "meta_api_key", "test-key")

    before = seed.get("/api/tenders/1003", headers=_auth()).json()
    assert before["brief"] is None
    out = seed.post("/api/tenders/1003/brief", headers=_auth()).json()
    assert out["brief"]["en"]["overview"] == "Overview in English"
    assert out["brief"]["ro"]["scope"] == ["Install 120 kWp PV"]
    assert out["brief"]["source"] == "notice"
    seed.post("/api/tenders/1003/brief", headers=_auth())
    assert sorted(calls) == ["English", "Romanian"]  # kept, not rebuilt
    feed = seed.get("/api/tenders", headers=_auth()).json()
    assert all(item["brief"] is None for item in feed)  # detail only


def test_bid_agents_run_in_order_and_spec_is_kept(seed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import json as _json

    from backend.ai.client import MetaAIClient
    from backend.core import agents as agents_core
    from backend.core.config import settings

    seen: list[str] = []

    async def fake_chat(self, system: str, user: str, **_kw):  # noqa: ANN001
        if "Spec Analyst" in system:
            seen.append("spec")
            return _json.dumps({"items": [{"ref": "R1", "text": "Experienta similara 2 lucrari", "category": "qualification"}]})
        if "Eligibility Checker" in system:
            seen.append("eligibility")
            assert "R1" in user  # reads the kept spec
            return _json.dumps({"rows": [{"ref": "R1", "requirement": "x", "status": "unclear"}], "summary": "ok"})
        seen.append("other")
        return "{}"

    async def fake_source(adapter, tender, ai):  # noqa: ANN001
        return "notice text", False

    monkeypatch.setattr(MetaAIClient, "_chat", fake_chat)
    monkeypatch.setattr(agents_core, "gather_source", fake_source)
    monkeypatch.setattr(settings, "meta_api_key", "test-key")

    spec = seed.post("/api/tenders/1003/agents/spec", json={}, headers=_auth()).json()
    assert spec["output"]["items"][0]["ref"] == "R1"
    seed.post("/api/tenders/1003/agents/spec", json={}, headers=_auth())
    assert seen.count("spec") == 1  # tender-wide, read once
    elig = seed.post("/api/tenders/1003/agents/eligibility", json={"evidence": ["ISO 9001"]}, headers=_auth()).json()
    assert elig["output"]["rows"][0]["status"] == "unclear"
    assert seed.post("/api/tenders/1003/agents/nope", json={}, headers=_auth()).status_code == 404


def test_vat_follows_the_dated_table(seed: TestClient) -> None:
    from datetime import date

    from backend.core.tax import vat_rate_on

    assert vat_rate_on(date(2025, 7, 31))[0] == 0.19
    assert vat_rate_on(date(2025, 8, 1))[0] == 0.21
    body = seed.get("/api/public/vat").json()  # public, no auth
    assert body["rate"] == vat_rate_on()[0]


def test_price_hint_is_locked_or_descriptive(seed: TestClient) -> None:
    out = seed.get("/api/tenders/1003/price-hint", headers=_auth())
    assert out.status_code == 200
    body = out.json()
    assert set(body) == {"buyer", "market", "locked"}


def test_brief_pending_only_briefs_open_construction(seed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import asyncio

    from sqlmodel import Session

    from backend.core import brief as brief_core
    from backend.core.config import settings
    from backend.db import engine

    made: list[str] = []

    async def fake_make(session, tender, **_kw):  # noqa: ANN001
        made.append(tender.external_id)
        return True

    monkeypatch.setattr(brief_core, "make_brief", fake_make)
    monkeypatch.setattr(settings, "meta_api_key", "test-key")
    with Session(engine) as session:
        out = asyncio.run(brief_core.brief_pending(session, limit=5, max_seconds=30))
    assert out["enabled"] is True
    assert out["briefed"] == len(made)


def test_ai_usage_is_recorded_and_reported(seed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import asyncio

    import httpx

    from backend.ai.client import MetaAIClient
    from backend.core.config import settings

    body = {
        "output": [{"type": "message", "content": [{"type": "output_text", "text": "hi"}]}],
        "usage": {"input_tokens": 1000, "output_tokens": 500, "output_tokens_details": {"reasoning_tokens": 300}, "input_tokens_details": {"cached_tokens": 200}},
    }
    transport = httpx.MockTransport(lambda req: httpx.Response(200, json=body))
    client = MetaAIClient(httpx.AsyncClient(transport=transport, base_url="http://x"))
    assert asyncio.run(client._chat("s", "u", purpose="translate")) == "hi"  # noqa: SLF001

    monkeypatch.setattr(settings, "sync_secret", "s3cret")
    out = seed.get("/api/internal/ai-usage", headers={"X-Sync-Token": "s3cret"}).json()
    row = out["purposes"]["translate"]
    assert (row["calls"], row["input"], row["output"], row["reasoning"], row["cached"]) == (1, 1000, 500, 300, 200)
    assert row["usd_per_call"] == round((800 * 4 + 200 * 0.2 + 500 * 20) / 1e6, 5)


def test_assistant_opens_a_page_and_points_at_a_known_element(seed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import json as _json

    from backend.ai.client import MetaAIClient
    from backend.core.config import settings

    plans = iter([
        {"message": "Here is your pipeline.", "navigate_to": "/app/pipeline", "highlight_hook": "pipeline-board", "agent": "spec"},
        {"message": "Nope", "navigate_to": "/etc/passwd", "highlight_hook": "x\"]; alert(1)//", "agent": "bogus"},
        {"message": "Settings", "navigate_to": "/app/profile", "highlight_hook": "profile-preferences", "agent": "writer"},
    ])

    async def fake_chat(self, system: str, user: str, **_kw):  # noqa: ANN001
        assert "pipeline-board" in system  # the site map is in the prompt
        return _json.dumps(next(plans))

    monkeypatch.setattr(MetaAIClient, "_chat", fake_chat)
    monkeypatch.setattr(settings, "meta_api_key", "test-key")
    body = {"question": "show me the pipeline", "pathname": "/app", "tenderId": None, "dom": [], "history": []}
    ok = seed.post("/api/assistant/chat", json=body, headers=_auth()).json()
    assert ok["navigate_to"] == "/app/pipeline"
    assert ok["highlight_selector"] == '[data-assistant="pipeline-board"]'
    bad = seed.post("/api/assistant/chat", json=body, headers=_auth()).json()
    assert bad["navigate_to"] is None and bad["highlight_selector"] is None and bad["agent"] == "spec"
    prof = seed.post("/api/assistant/chat", json=body, headers=_auth()).json()
    assert prof["highlight_selector"] == '[data-assistant="profile-preferences"]' and prof["agent"] == "writer"


def test_assistant_without_a_model_still_opens_pages(seed: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.core.config import settings

    monkeypatch.setattr(settings, "meta_api_key", "")
    body = {"question": "pipeline sayfasını aç", "pathname": "/app", "tenderId": None, "dom": [], "history": []}
    out = seed.post("/api/assistant/chat", json=body, headers=_auth()).json()
    assert out["navigate_to"] == "/app/pipeline"
