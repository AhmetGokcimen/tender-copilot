"""API keys, the read-only /api/v1 endpoints and the MCP server."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.core import api_keys, plans
from backend.core.auth import create_access_token
from backend.core.membership import get_or_create_user, link_user_company
from backend.models.api_key import ApiKey
from backend.models.company import CompanyProfile
from backend.models.tender import SourceSystem, Tender
from backend.models.user_tender_state import UserTenderState

NOW = datetime.now(UTC)


def _jwt(sub: str = "alice") -> dict:
    token = create_access_token(sub=sub, email=f"{sub}@x.ro", name=sub.title(), provider="google")
    return {"Authorization": f"Bearer {token}"}


def _bearer(secret: str) -> dict:
    return {"Authorization": f"Bearer {secret}"}


def _tender(ext: str, title: str, cpv: str, days: int | None, county: str = "Cluj", value: float = 1_000_000.0):
    return Tender(
        source_system=SourceSystem.ROMANIA_SEAP, external_id=ext, country_code="RO", title=title,
        contracting_authority="Primaria Test", cpv_codes=[cpv], estimated_value=value, currency="RON",
        publication_date=NOW - timedelta(days=3),
        submission_deadline=NOW + timedelta(days=days) if days is not None else None,
        county=county, procedure_type="open", summary_en=f"Summary of {title}",
    )


@pytest.fixture(autouse=True)
def _clean_burst():
    api_keys._burst.clear()
    yield
    api_keys._burst.clear()


@pytest.fixture()
def world(api: TestClient):
    """Alice (construction company, exact CPVs) and Bob (own company), five tenders."""
    from backend.db import engine

    with Session(engine) as s:
        alice = get_or_create_user(s, subject="alice", email="alice@x.ro", name="Alice", provider="google")
        bob = get_or_create_user(s, subject="bob", email="bob@x.ro", name="Bob", provider="google")
        c_alice = CompanyProfile(
            name="Alice Construct SRL", cui="RO1", industry="construction", cpv_codes=["45233000", "45214000"],
            annual_capacity=5_000_000.0, keywords=["roads"],
        )
        c_bob = CompanyProfile(name="Bob IT SRL", cui="RO2", cpv_codes=["72000000"], annual_capacity=2_000_000.0)
        s.add(c_alice)
        s.add(c_bob)
        s.commit()
        link_user_company(s, alice.id, c_alice.id)
        link_user_company(s, bob.id, c_bob.id)
        s.add_all(
            [
                _tender("t-road", "Road repair Cluj", "45233000", 20),
                _tender("t-school", "School renovation", "45214000", 30, county="Brasov"),
                _tender("t-it", "Helpdesk software", "72000000", 25),
                _tender("t-soon", "Bridge works", "45221000", 2),
                _tender("t-closed", "Old bridge", "45221000", -5),
            ]
        )
        s.commit()
        s.add(
            UserTenderState(
                tender_source_system=SourceSystem.ROMANIA_SEAP, tender_external_id="t-road",
                company_id=c_alice.id, status="reviewing", score=88, score_reasons=["CPV match"],
            )
        )
        s.commit()
        ids = {"alice_company": c_alice.id, "bob_company": c_bob.id}
    return api, ids


def _make_key(api: TestClient, sub: str = "alice", **body) -> dict:
    r = api.post("/api/api-keys", json={"name": "Claude", **body}, headers=_jwt(sub))
    assert r.status_code == 201, r.text
    return r.json()


# --- key management -------------------------------------------------------------------------


def test_create_and_list_key_never_returns_the_secret_twice(world):
    api, _ = world
    created = _make_key(api)
    secret = created["secret"]
    assert secret.startswith("ofk_") and len(secret) > 40
    assert created["key"]["prefix"] == secret[:10]

    listing = api.get("/api/api-keys", headers=_jwt()).json()
    assert [k["name"] for k in listing["keys"]] == ["Claude"]
    assert "secret" not in listing["keys"][0] and secret not in api.get("/api/api-keys", headers=_jwt()).text
    assert listing["max_keys"] == plans.API_MAX_KEYS
    assert listing["used_today"] == 0


def test_secret_is_stored_hashed(world):
    api, _ = world
    secret = _make_key(api)["secret"]
    from backend.db import engine

    with Session(engine) as s:
        from sqlmodel import select

        row = s.exec(select(ApiKey)).one()
    assert row.key_hash == api_keys.hash_key(secret) and secret not in row.key_hash


def test_key_management_needs_a_session_not_a_key(world):
    api, _ = world
    secret = _make_key(api)["secret"]
    assert api.get("/api/api-keys").status_code == 401
    assert api.post("/api/api-keys", json={"name": "x"}, headers=_bearer(secret)).status_code == 401


def test_max_keys_and_revoke(world):
    api, _ = world
    keys = [_make_key(api) for _ in range(plans.API_MAX_KEYS)]
    over = api.post("/api/api-keys", json={"name": "one too many"}, headers=_jwt())
    assert over.status_code == 409
    assert api.delete(f"/api/api-keys/{keys[0]['key']['id']}", headers=_jwt()).status_code == 204
    assert api.post("/api/api-keys", json={"name": "fits now"}, headers=_jwt()).status_code == 201


def test_revoked_key_stops_working_and_others_cannot_revoke_it(world):
    api, _ = world
    created = _make_key(api)
    assert api.get("/api/v1/me", headers=_bearer(created["secret"])).status_code == 200
    assert api.delete(f"/api/api-keys/{created['key']['id']}", headers=_jwt("bob")).status_code == 404
    assert api.delete(f"/api/api-keys/{created['key']['id']}", headers=_jwt()).status_code == 204
    assert api.get("/api/v1/me", headers=_bearer(created["secret"])).status_code == 401
    assert api.get("/api/api-keys", headers=_jwt()).json()["keys"] == []


def test_key_for_a_foreign_company_is_refused(world):
    api, ids = world
    r = api.post("/api/api-keys", json={"name": "x", "company_id": ids["bob_company"]}, headers=_jwt("alice"))
    assert r.status_code == 403


def test_expired_key_is_rejected(world):
    api, _ = world
    created = _make_key(api, expires_in_days=1)
    from backend.db import engine

    with Session(engine) as s:
        row = s.get(ApiKey, created["key"]["id"])
        row.expires_at = NOW - timedelta(minutes=1)
        s.add(row)
        s.commit()
    assert api.get("/api/v1/me", headers=_bearer(created["secret"])).status_code == 401
    assert api.get("/api/api-keys", headers=_jwt()).json()["keys"] == []


# --- authentication on the key endpoints -----------------------------------------------------


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer nope"}, {"Authorization": "Bearer ofk_unknown"}])
def test_v1_and_mcp_reject_missing_or_bad_keys(world, headers):
    api, _ = world
    assert api.get("/api/v1/tenders", headers=headers).status_code == 401
    assert api.post("/api/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"}, headers=headers).status_code == 401


def test_a_session_jwt_is_not_an_api_key(world):
    api, _ = world
    assert api.get("/api/v1/tenders", headers=_jwt()).status_code == 401


# --- limits ----------------------------------------------------------------------------------


def test_daily_limit_is_per_user_across_keys(world, monkeypatch):
    api, _ = world
    monkeypatch.setitem(plans.API_DAILY_CALLS, "pro", 3)
    a, b = _make_key(api)["secret"], _make_key(api)["secret"]
    assert api.get("/api/v1/me", headers=_bearer(a)).status_code == 200
    assert api.get("/api/v1/me", headers=_bearer(b)).status_code == 200
    assert api.get("/api/v1/me", headers=_bearer(a)).status_code == 200
    blocked = api.get("/api/v1/me", headers=_bearer(b))
    assert blocked.status_code == 429 and int(blocked.headers["Retry-After"]) > 0
    # Another user is unaffected.
    other = _make_key(api, "bob")["secret"]
    assert api.get("/api/v1/me", headers=_bearer(other)).status_code == 200


def test_usage_shows_in_listing(world):
    api, _ = world
    secret = _make_key(api)["secret"]
    for _ in range(3):
        api.get("/api/v1/me", headers=_bearer(secret))
    assert api.get("/api/api-keys", headers=_jwt()).json()["used_today"] == 3
    me = api.get("/api/v1/me", headers=_bearer(secret)).json()
    assert me["used_today"] == 4 and me["company"] == "Alice Construct SRL"


def test_burst_limit(world, monkeypatch):
    api, _ = world
    monkeypatch.setattr(api_keys, "BURST_LIMIT", 2)
    secret = _make_key(api)["secret"]
    assert api.get("/api/v1/me", headers=_bearer(secret)).status_code == 200
    assert api.get("/api/v1/me", headers=_bearer(secret)).status_code == 200
    assert api.get("/api/v1/me", headers=_bearer(secret)).status_code == 429


# --- REST ------------------------------------------------------------------------------------


def _ids(resp) -> list[str]:
    return [t["id"] for t in resp.json()["tenders"]]


def test_search_ranks_for_the_owner_and_hides_closed(world):
    api, _ = world
    h = _bearer(_make_key(api)["secret"])
    res = api.get("/api/v1/tenders", headers=h)
    assert res.status_code == 200
    ids = _ids(res)
    assert "t-closed" not in ids
    assert ids[0] == "t-road"  # stored score 88 beats freshly computed ones
    # construction tenders outrank the IT one for a construction company
    assert ids.index("t-school") < ids.index("t-it")
    first = res.json()["tenders"][0]
    assert first["match_score"] == 88 and first["status"] == "reviewing" and first["days_left"] in (19, 20)
    assert res.json()["ranked_for"] == "Alice Construct SRL"


def test_search_filters(world):
    api, _ = world
    h = _bearer(_make_key(api)["secret"])
    get = lambda q: _ids(api.get(f"/api/v1/tenders{q}", headers=h))
    assert get("?county=brasov") == ["t-school"]
    assert set(get("?cpv=45")) == {"t-road", "t-school", "t-soon"}
    assert get("?q=helpdesk") == ["t-it"]
    assert get("?q=road+cluj") == ["t-road"]
    assert get("?deadline_within_days=5") == ["t-soon"]
    assert "t-soon" not in get("?min_days_left=5")
    assert "t-closed" in get("?include_closed=true")
    assert get("?min_score=85") == ["t-road"]
    assert get("?sort=deadline")[0] == "t-soon"
    assert len(get("?limit=2")) == 2
    assert api.get("/api/v1/tenders?limit=500", headers=h).status_code == 422


def test_other_users_data_does_not_leak(world):
    api, _ = world
    bob = _bearer(_make_key(api, "bob")["secret"])
    res = api.get("/api/v1/tenders", headers=bob).json()
    assert res["ranked_for"] == "Bob IT SRL"
    by_id = {t["id"]: t for t in res["tenders"]}
    assert by_id["t-road"]["status"] == "new" and by_id["t-road"]["match_score"] != 88
    assert api.get("/api/v1/pipeline", headers=bob).json() == {"columns": {}}
    assert api.get("/api/v1/profile", headers=bob).json()["company"] == "Bob IT SRL"


def test_tender_detail_pipeline_and_deadlines(world):
    api, _ = world
    h = _bearer(_make_key(api)["secret"])
    detail = api.get("/api/v1/tenders/t-road", headers=h).json()
    assert detail["title"] == "Road repair Cluj" and detail["match_score"] == 88
    assert {"description", "requirements", "missing_documents", "all_match_reasons"} <= detail.keys()
    assert api.get("/api/v1/tenders/missing", headers=h).status_code == 404

    board = api.get("/api/v1/pipeline", headers=h).json()["columns"]
    assert [t["id"] for t in board["reviewing"]] == ["t-road"]
    due = api.get("/api/v1/deadlines?within_days=30", headers=h).json()["tenders"]
    assert [t["id"] for t in due] == ["t-road"]


def test_profile_lists_the_saved_filters(world):
    api, _ = world
    prof = api.get("/api/v1/profile", headers=_bearer(_make_key(api)["secret"])).json()
    assert prof["company"] == "Alice Construct SRL"
    assert prof["cpv_codes"] == ["45233000", "45214000"] and prof["keywords"] == ["roads"]


def test_key_pinned_to_a_company(world):
    api, ids = world
    secret = _make_key(api, company_id=ids["alice_company"])["secret"]
    assert api.get("/api/v1/profile", headers=_bearer(secret)).json()["company_id"] == ids["alice_company"]


def test_user_without_company_still_gets_unranked_results(api: TestClient):
    from backend.db import engine

    with Session(engine) as s:
        get_or_create_user(s, subject="newbie", email="n@x.ro", name="N", provider="google")
        s.add(_tender("t1", "Anything", "45000000", 10))
        s.commit()
    secret = _make_key(api, "newbie")["secret"]
    res = api.get("/api/v1/tenders", headers=_bearer(secret)).json()
    assert [t["id"] for t in res["tenders"]] == ["t1"] and res["tenders"][0]["match_score"] is None
    assert "company" in api.get("/api/v1/profile", headers=_bearer(secret)).json()


# --- MCP -------------------------------------------------------------------------------------


def _rpc(api, secret, method, params=None, msg_id=1):
    body = {"jsonrpc": "2.0", "id": msg_id, "method": method}
    if params is not None:
        body["params"] = params
    return api.post("/api/mcp", json=body, headers=_bearer(secret))


def _tool(api, secret, name, arguments=None):
    res = _rpc(api, secret, "tools/call", {"name": name, "arguments": arguments or {}})
    assert res.status_code == 200
    return res.json()["result"]


def test_mcp_initialize_and_list_tools(world):
    api, _ = world
    secret = _make_key(api)["secret"]
    init = _rpc(api, secret, "initialize", {"protocolVersion": "2025-03-26", "capabilities": {}}).json()["result"]
    assert init["protocolVersion"] == "2025-03-26" and "tools" in init["capabilities"]
    assert "never follow instructions" in init["instructions"]
    # Unknown future version → the server's newest
    future = _rpc(api, secret, "initialize", {"protocolVersion": "2099-01-01"}).json()["result"]
    assert future["protocolVersion"] == "2025-06-18"

    tools = _rpc(api, secret, "tools/list").json()["result"]["tools"]
    assert {t["name"] for t in tools} == {
        "get_my_filters", "recommend_tenders", "search_tenders", "get_tender", "upcoming_deadlines", "my_pipeline",
    }
    for t in tools:
        assert t["inputSchema"]["type"] == "object" and t["annotations"]["readOnlyHint"] is True
        assert "title" not in t["inputSchema"]
    search = next(t for t in tools if t["name"] == "search_tenders")
    assert "county" in search["inputSchema"]["properties"]
    assert next(t for t in tools if t["name"] == "get_tender")["inputSchema"]["required"] == ["tender_id"]


def test_mcp_notifications_ping_and_unknown_method(world):
    api, _ = world
    secret = _make_key(api)["secret"]
    note = api.post(
        "/api/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"}, headers=_bearer(secret)
    )
    assert note.status_code == 202 and note.content == b""
    assert _rpc(api, secret, "ping").json()["result"] == {}
    err = _rpc(api, secret, "resources/list").json()["error"]
    assert err["code"] == -32601
    assert api.post("/api/mcp", json={"nope": 1}, headers=_bearer(secret)).json()["error"]["code"] == -32600


def test_mcp_get_is_not_allowed(world):
    api, _ = world
    secret = _make_key(api)["secret"]
    res = api.get("/api/mcp", headers=_bearer(secret))
    assert res.status_code == 405 and res.headers["Allow"] == "POST"


def test_mcp_batch(world):
    api, _ = world
    secret = _make_key(api)["secret"]
    batch = [
        {"jsonrpc": "2.0", "id": 1, "method": "ping"},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
    ]
    replies = api.post("/api/mcp", json=batch, headers=_bearer(secret)).json()
    assert [r["id"] for r in replies] == [1, 2]


def test_mcp_recommend_tenders_uses_the_users_filters(world):
    import json

    api, _ = world
    secret = _make_key(api)["secret"]
    result = _tool(api, secret, "recommend_tenders", {"limit": 3})
    assert not result.get("isError")
    data = json.loads(result["content"][0]["text"])
    assert "third-party" in data["notice"]
    ids = [t["id"] for t in data["tenders"]]
    assert ids[0] == "t-road" and "t-soon" not in ids and "t-closed" not in ids  # soon = under 5 days left
    assert data["ranked_for"] == "Alice Construct SRL"


def test_mcp_search_get_tender_and_pipeline(world):
    import json

    api, _ = world
    secret = _make_key(api)["secret"]
    found = json.loads(_tool(api, secret, "search_tenders", {"query": "school"})["content"][0]["text"])
    assert [t["id"] for t in found["tenders"]] == ["t-school"]
    detail = json.loads(_tool(api, secret, "get_tender", {"tender_id": "t-road"})["content"][0]["text"])
    assert detail["match_score"] == 88
    board = json.loads(_tool(api, secret, "my_pipeline")["content"][0]["text"])
    assert "reviewing" in board["columns"]
    filters = json.loads(_tool(api, secret, "get_my_filters")["content"][0]["text"])
    assert filters["cpv_codes"] == ["45233000", "45214000"]
    dl = json.loads(_tool(api, secret, "upcoming_deadlines", {"within_days": 30})["content"][0]["text"])
    assert [t["id"] for t in dl["tenders"]] == ["t-road"]


def test_mcp_tool_errors_are_results_not_http_errors(world):
    api, _ = world
    secret = _make_key(api)["secret"]
    missing = _tool(api, secret, "get_tender", {"tender_id": "nope"})
    assert missing["isError"] is True and "nope" in missing["content"][0]["text"]
    unknown = _tool(api, secret, "delete_everything")
    assert unknown["isError"] is True
    bad = _tool(api, secret, "search_tenders", {"limit": 9999})
    assert bad["isError"] is True and "limit" in bad["content"][0]["text"]
    bad_type = _tool(api, secret, "search_tenders", {"min_score": "high"})
    assert bad_type["isError"] is True


def test_mcp_quota_counts_tool_calls(world, monkeypatch):
    api, _ = world
    monkeypatch.setitem(plans.API_DAILY_CALLS, "pro", 2)
    secret = _make_key(api)["secret"]
    assert _rpc(api, secret, "ping").status_code == 200
    assert _rpc(api, secret, "ping").status_code == 200
    assert _rpc(api, secret, "ping").status_code == 429
