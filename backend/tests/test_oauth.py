"""OAuth 2.1 for the MCP endpoint: discovery, registration, consent, tokens."""

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.core import oauth
from backend.core.api_keys import _burst
from backend.core.auth import create_access_token
from backend.core.membership import get_or_create_user, link_user_company
from backend.models.company import CompanyProfile
from backend.models.oauth import OAuthCode, OAuthToken
from backend.models.tender import SourceSystem, Tender

REDIRECT = "https://claude.ai/api/mcp/auth_callback"


def _jwt(sub: str = "alice") -> dict:
    token = create_access_token(sub=sub, email=f"{sub}@x.ro", name=sub.title(), provider="google")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def _clean():
    _burst.clear()
    oauth._registrations.clear()
    yield
    _burst.clear()
    oauth._registrations.clear()


@pytest.fixture()
def app(api: TestClient):
    from backend.db import engine

    with Session(engine) as s:
        for sub in ("alice", "bob"):
            user = get_or_create_user(s, subject=sub, email=f"{sub}@x.ro", name=sub.title(), provider="google")
            company = CompanyProfile(name=f"{sub.title()} SRL", cui=sub, cpv_codes=["45233000"], annual_capacity=5e6)
            s.add(company)
            s.commit()
            link_user_company(s, user.id, company.id)
        s.add(
            Tender(
                source_system=SourceSystem.ROMANIA_SEAP, external_id="t1", country_code="RO",
                title="Road repair", cpv_codes=["45233000"], estimated_value=1e6, currency="RON",
                submission_deadline=datetime.now(UTC) + timedelta(days=20), county="Cluj",
            )
        )
        s.commit()
    return api


def _pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def _register(app, redirect=REDIRECT, **extra) -> str:
    res = app.post("/api/oauth/register", json={"client_name": "Claude", "redirect_uris": [redirect], **extra})
    assert res.status_code == 201, res.text
    return res.json()["client_id"]


def _approve(app, client_id, challenge, redirect=REDIRECT, sub="alice", approve=True, **over) -> str:
    body = {
        "client_id": client_id, "redirect_uri": redirect, "response_type": "code",
        "code_challenge": challenge, "code_challenge_method": "S256", "state": "xyz", "approve": approve,
    }
    body.update(over)
    res = app.post("/api/oauth/authorize", json=body, headers=_jwt(sub))
    assert res.status_code == 200, res.text
    return res.json()["redirect_to"]


def _query(url: str) -> dict:
    return {k: v[0] for k, v in parse_qs(urlsplit(url).query).items()}


def _token(app, **form):
    return app.post("/api/oauth/token", data=form)


def _connect(app, sub="alice", redirect=REDIRECT) -> dict:
    """Run the whole flow; returns the token response."""
    client_id = _register(app, redirect)
    verifier, challenge = _pkce()
    code = _query(_approve(app, client_id, challenge, redirect, sub))["code"]
    res = _token(
        app, grant_type="authorization_code", code=code, client_id=client_id,
        redirect_uri=redirect, code_verifier=verifier,
    )
    assert res.status_code == 200, res.text
    return {**res.json(), "client_id": client_id}


def _mcp(app, access, method="ping"):
    return app.post(
        "/api/mcp", json={"jsonrpc": "2.0", "id": 1, "method": method}, headers={"Authorization": f"Bearer {access}"}
    )


def _tool_call(app, access):
    body = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "get_my_filters", "arguments": {}}}
    return app.post("/api/mcp", json=body, headers={"Authorization": f"Bearer {access}"})


# --- discovery -------------------------------------------------------------------------------


def test_discovery_documents(app):
    pr = app.get("/.well-known/oauth-protected-resource").json()
    assert pr["resource"] == "http://testserver/api/mcp" and pr["authorization_servers"] == ["http://testserver"]
    suffixed = app.get("/.well-known/oauth-protected-resource/api/mcp").json()
    assert suffixed["resource"] == "http://testserver/api/mcp"

    meta = app.get("/.well-known/oauth-authorization-server").json()
    assert meta["issuer"] == "http://testserver"
    assert meta["token_endpoint"] == "http://testserver/api/oauth/token"
    assert meta["registration_endpoint"] == "http://testserver/api/oauth/register"
    assert meta["authorization_endpoint"].endswith("/en/auth/authorize")
    assert meta["code_challenge_methods_supported"] == ["S256"]
    assert meta["token_endpoint_auth_methods_supported"] == ["none"]
    assert app.get("/.well-known/oauth-authorization-server").headers["cache-control"] == "no-store"


def test_proxy_headers_set_the_origin(app):
    res = app.get(
        "/.well-known/oauth-authorization-server",
        headers={"x-forwarded-proto": "https", "x-forwarded-host": "licits.com"},
    ).json()
    assert res["issuer"] == "https://licits.com" and res["token_endpoint"] == "https://licits.com/api/oauth/token"


def test_mcp_401_points_at_the_resource_metadata(app):
    res = app.post("/api/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping"})
    assert res.status_code == 401
    assert 'resource_metadata="http://testserver/.well-known/oauth-protected-resource"' in res.headers["www-authenticate"]


# --- registration ----------------------------------------------------------------------------


def test_register_returns_a_public_client(app):
    res = app.post("/api/oauth/register", json={"client_name": "  Claude  ", "redirect_uris": [REDIRECT]})
    body = res.json()
    assert res.status_code == 201 and body["client_id"].startswith("lc_")
    assert body["client_name"] == "Claude" and body["token_endpoint_auth_method"] == "none"
    assert "client_secret" not in body


@pytest.mark.parametrize(
    "extra",
    [
        {"redirect_uris": ["javascript:alert(1)"]},
        {"redirect_uris": ["data:text/html,x"]},
        {"redirect_uris": ["http://evil.example/cb"]},
        {"redirect_uris": ["https://ok.example/cb#frag"]},
        {"redirect_uris": []},
        {"redirect_uris": ["https://a.example/1"] * 6},
        {"redirect_uris": [REDIRECT], "grant_types": ["password"]},
        {},
    ],
)
def test_register_rejects_unsafe_metadata(app, extra):
    res = app.post("/api/oauth/register", json={"client_name": "x", **extra})
    assert res.status_code == 400 and res.json()["error"] in ("invalid_redirect_uri", "invalid_client_metadata")


def test_register_accepts_loopback_and_app_schemes(app):
    for uri in ("http://127.0.0.1:33418/callback", "http://localhost/cb", "cursor://anysphere.cursor/oauth"):
        assert app.post("/api/oauth/register", json={"redirect_uris": [uri]}).status_code == 201


def test_register_is_rate_limited(app, monkeypatch):
    monkeypatch.setattr(oauth, "REGISTER_LIMIT", 2)
    for _ in range(2):
        _register(app)
    res = app.post("/api/oauth/register", json={"redirect_uris": [REDIRECT]})
    assert res.status_code == 429 and res.json()["error"] == "temporarily_unavailable"


# --- consent ---------------------------------------------------------------------------------


def test_client_info_for_the_consent_screen(app):
    client_id = _register(app)
    ok = app.get("/api/oauth/client", params={"client_id": client_id, "redirect_uri": REDIRECT})
    assert ok.status_code == 200 and ok.json()["name"] == "Claude"
    bad = app.get("/api/oauth/client", params={"client_id": client_id, "redirect_uri": "https://evil.example/"})
    assert bad.status_code == 400
    assert app.get("/api/oauth/client", params={"client_id": "nope", "redirect_uri": REDIRECT}).status_code == 400


def test_authorize_needs_a_signed_in_user(app):
    client_id = _register(app)
    body = {"client_id": client_id, "redirect_uri": REDIRECT, "approve": True}
    assert app.post("/api/oauth/authorize", json=body).status_code == 401


def test_authorize_never_redirects_to_an_unregistered_address(app):
    client_id = _register(app)
    _, challenge = _pkce()
    body = {
        "client_id": client_id, "redirect_uri": "https://evil.example/steal", "code_challenge": challenge,
        "code_challenge_method": "S256", "approve": True,
    }
    res = app.post("/api/oauth/authorize", json=body, headers=_jwt())
    assert res.status_code == 400 and "redirect_to" not in res.text
    body["client_id"] = "lc_unknown"
    assert app.post("/api/oauth/authorize", json=body, headers=_jwt()).status_code == 400


def test_deny_redirects_with_access_denied_and_state(app):
    client_id = _register(app)
    _, challenge = _pkce()
    q = _query(_approve(app, client_id, challenge, approve=False))
    assert q == {"error": "access_denied", "state": "xyz"}


def test_pkce_is_required(app):
    client_id = _register(app)
    for over in ({"code_challenge": ""}, {"code_challenge_method": "plain"}, {"code_challenge": "short"}):
        _, challenge = _pkce()
        q = _query(_approve(app, client_id, challenge, **over))
        assert q["error"] == "invalid_request" and "code" not in q


def test_only_the_code_response_type(app):
    client_id = _register(app)
    _, challenge = _pkce()
    assert _query(_approve(app, client_id, challenge, response_type="token"))["error"] == "unsupported_response_type"


def test_loopback_redirect_matches_on_any_port(app):
    client_id = _register(app, "http://127.0.0.1:5000/callback")
    _, challenge = _pkce()
    url = _approve(app, client_id, challenge, "http://127.0.0.1:61234/callback")
    assert url.startswith("http://127.0.0.1:61234/callback?") and "code" in _query(url)
    other = app.post(
        "/api/oauth/authorize",
        json={"client_id": client_id, "redirect_uri": "http://127.0.0.1:61234/other", "approve": True},
        headers=_jwt(),
    )
    assert other.status_code == 400


# --- tokens ----------------------------------------------------------------------------------


def test_full_flow_gives_a_token_the_mcp_server_accepts(app):
    tokens = _connect(app)
    assert tokens["token_type"] == "Bearer" and tokens["expires_in"] == 3600 and tokens["scope"] == "tenders.read"
    assert tokens["access_token"].startswith("ofo_") and tokens["refresh_token"].startswith("ofr_")

    assert _mcp(app, tokens["access_token"]).status_code == 200
    search = app.post(
        "/api/mcp",
        json={"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "recommend_tenders", "arguments": {}}},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    ).json()["result"]
    assert "t1" in search["content"][0]["text"]
    assert app.get("/api/v1/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}).json()["company"] == "Alice SRL"


def test_token_response_is_not_cached(app):
    client_id = _register(app)
    verifier, challenge = _pkce()
    code = _query(_approve(app, client_id, challenge))["code"]
    res = _token(app, grant_type="authorization_code", code=code, client_id=client_id,
                 redirect_uri=REDIRECT, code_verifier=verifier)
    assert res.headers["cache-control"] == "no-store"


def test_connected_app_is_listed_and_does_not_use_up_key_slots(app):
    from backend.core.plans import API_MAX_KEYS

    _connect(app)
    listing = app.get("/api/api-keys", headers=_jwt()).json()
    assert [(k["name"], k["connected_app"]) for k in listing["keys"]] == [("Claude", True)]
    for i in range(API_MAX_KEYS):
        assert app.post("/api/api-keys", json={"name": f"k{i}"}, headers=_jwt()).status_code == 201
    assert app.post("/api/api-keys", json={"name": "one more"}, headers=_jwt()).status_code == 409


def test_the_same_app_reconnecting_reuses_one_connection(app):
    first = _connect(app)
    client_id = first["client_id"]
    verifier, challenge = _pkce()
    code = _query(_approve(app, client_id, challenge))["code"]
    _token(app, grant_type="authorization_code", code=code, client_id=client_id,
           redirect_uri=REDIRECT, code_verifier=verifier)
    assert len(app.get("/api/api-keys", headers=_jwt()).json()["keys"]) == 1


def test_wrong_pkce_verifier_is_refused(app):
    client_id = _register(app)
    _, challenge = _pkce()
    code = _query(_approve(app, client_id, challenge))["code"]
    res = _token(app, grant_type="authorization_code", code=code, client_id=client_id,
                 redirect_uri=REDIRECT, code_verifier=secrets.token_urlsafe(48))
    assert res.status_code == 400 and res.json()["error"] == "invalid_grant"


def test_code_must_match_client_and_redirect(app):
    client_id, other = _register(app), _register(app)
    verifier, challenge = _pkce()
    code = _query(_approve(app, client_id, challenge))["code"]
    for form in (
        {"client_id": other, "redirect_uri": REDIRECT},
        {"client_id": client_id, "redirect_uri": "https://claude.ai/other"},
        {"client_id": "lc_nope", "redirect_uri": REDIRECT},
    ):
        res = _token(app, grant_type="authorization_code", code=code, code_verifier=verifier, **form)
        assert res.status_code in (400, 401)
    # None of those attempts burned the code.
    ok = _token(app, grant_type="authorization_code", code=code, client_id=client_id,
                redirect_uri=REDIRECT, code_verifier=verifier)
    assert ok.status_code == 200


def test_expired_code_is_refused(app):
    from backend.db import engine

    client_id = _register(app)
    verifier, challenge = _pkce()
    code = _query(_approve(app, client_id, challenge))["code"]
    with Session(engine) as s:
        row = s.exec(select(OAuthCode)).one()
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        s.add(row)
        s.commit()
    res = _token(app, grant_type="authorization_code", code=code, client_id=client_id,
                 redirect_uri=REDIRECT, code_verifier=verifier)
    assert res.json()["error"] == "invalid_grant"


def test_reusing_a_code_cuts_the_app_off(app):
    client_id = _register(app)
    verifier, challenge = _pkce()
    code = _query(_approve(app, client_id, challenge))["code"]
    form = {
        "grant_type": "authorization_code", "code": code, "client_id": client_id,
        "redirect_uri": REDIRECT, "code_verifier": verifier,
    }
    first = _token(app, **form)
    assert first.status_code == 200
    assert _token(app, **form).json()["error"] == "invalid_grant"
    assert _mcp(app, first.json()["access_token"]).status_code == 401


def test_unsupported_grant_and_garbage(app):
    assert _token(app, grant_type="password", username="a", password="b").json()["error"] == "unsupported_grant_type"
    assert _token(app).json()["error"] == "unsupported_grant_type"
    assert app.get("/api/oauth/token").status_code == 405


def test_refresh_rotates_and_replay_disconnects(app):
    tokens = _connect(app)
    client_id = tokens["client_id"]
    res = _token(app, grant_type="refresh_token", refresh_token=tokens["refresh_token"], client_id=client_id)
    assert res.status_code == 200
    fresh = res.json()
    assert fresh["access_token"] != tokens["access_token"] and fresh["refresh_token"] != tokens["refresh_token"]
    assert _mcp(app, fresh["access_token"]).status_code == 200

    replay = _token(app, grant_type="refresh_token", refresh_token=tokens["refresh_token"], client_id=client_id)
    assert replay.status_code == 400 and replay.json()["error"] == "invalid_grant"
    # The replay disconnected the app: even the newest tokens stop working.
    assert _mcp(app, fresh["access_token"]).status_code == 401
    assert _token(app, grant_type="refresh_token", refresh_token=fresh["refresh_token"], client_id=client_id).status_code == 400


def test_refresh_needs_the_right_client(app):
    tokens = _connect(app)
    other = _register(app)
    res = _token(app, grant_type="refresh_token", refresh_token=tokens["refresh_token"], client_id=other)
    assert res.json()["error"] == "invalid_grant"
    assert _token(app, grant_type="refresh_token", refresh_token="ofr_made-up", client_id=other).status_code == 400


def test_expired_access_token_stops_working_but_refresh_still_does(app):
    from backend.db import engine

    tokens = _connect(app)
    with Session(engine) as s:
        row = s.exec(select(OAuthToken)).one()
        row.access_expires_at = datetime.now(UTC) - timedelta(seconds=1)
        s.add(row)
        s.commit()
    assert _mcp(app, tokens["access_token"]).status_code == 401
    res = _token(app, grant_type="refresh_token", refresh_token=tokens["refresh_token"], client_id=tokens["client_id"])
    assert res.status_code == 200 and _mcp(app, res.json()["access_token"]).status_code == 200


def test_disconnecting_in_settings_revokes_the_tokens(app):
    tokens = _connect(app)
    key_id = app.get("/api/api-keys", headers=_jwt()).json()["keys"][0]["id"]
    assert app.delete(f"/api/api-keys/{key_id}", headers=_jwt()).status_code == 204
    assert _mcp(app, tokens["access_token"]).status_code == 401
    res = _token(app, grant_type="refresh_token", refresh_token=tokens["refresh_token"], client_id=tokens["client_id"])
    assert res.json()["error"] == "invalid_grant"
    # Connecting again after a disconnect gives a fresh, working connection.
    again = _connect(app)
    assert _mcp(app, again["access_token"]).status_code == 200


def test_tokens_belong_to_the_user_who_approved(app):
    alice, bob = _connect(app, "alice"), _connect(app, "bob")
    a = app.get("/api/v1/me", headers={"Authorization": f"Bearer {alice['access_token']}"}).json()
    b = app.get("/api/v1/me", headers={"Authorization": f"Bearer {bob['access_token']}"}).json()
    assert (a["email"], b["email"]) == ("alice@x.ro", "bob@x.ro")


def test_oauth_calls_count_against_the_daily_quota(app, monkeypatch):
    from backend.core import plans

    monkeypatch.setitem(plans.API_DAILY_CALLS, "pro", 2)
    tokens = _connect(app)
    for _ in range(2):
        assert _tool_call(app, tokens["access_token"]).status_code == 200
    assert _tool_call(app, tokens["access_token"]).status_code == 429


def test_a_refresh_token_or_made_up_token_is_not_an_access_token(app):
    tokens = _connect(app)
    assert _mcp(app, tokens["refresh_token"]).status_code == 401
    assert _mcp(app, "ofo_" + secrets.token_urlsafe(32)).status_code == 401


def test_revocation_endpoint_disconnects_the_app(app):
    meta = app.get("/.well-known/oauth-authorization-server").json()
    assert meta["revocation_endpoint"] == "http://testserver/api/oauth/revoke"

    tokens = _connect(app)
    cid = tokens["client_id"]
    # Another client cannot revoke it, and unknown tokens are accepted silently.
    other = _register(app)
    assert app.post("/api/oauth/revoke", data={"token": tokens["access_token"], "client_id": other}).status_code == 200
    assert app.post("/api/oauth/revoke", data={"token": "ofo_unknown", "client_id": cid}).status_code == 200
    assert app.post("/api/oauth/revoke", data={}).status_code == 200
    assert _mcp(app, tokens["access_token"]).status_code == 200

    res = app.post("/api/oauth/revoke", data={"token": tokens["refresh_token"], "client_id": cid})
    assert res.status_code == 200 and res.headers["cache-control"] == "no-store"
    assert _mcp(app, tokens["access_token"]).status_code == 401
    refresh = _token(app, grant_type="refresh_token", refresh_token=tokens["refresh_token"], client_id=cid)
    assert refresh.json()["error"] == "invalid_grant"


def test_unused_clients_are_purged_but_used_ones_stay(app):
    from backend.db import engine
    from backend.models.oauth import OAuthClient

    used = _connect(app)["client_id"]
    idle = _register(app)
    with Session(engine) as s:
        for cid in (used, idle):
            row = s.get(OAuthClient, cid)
            row.created_at = datetime.now(UTC) - timedelta(days=8)
            s.add(row)
        s.commit()
    fresh = _register(app)
    with Session(engine) as s:
        ids = {c.id for c in s.exec(select(OAuthClient)).all()}
    assert ids == {used, fresh}


def test_a_client_asking_for_a_secret_gets_a_public_client(app):
    res = app.post(
        "/api/oauth/register",
        json={"redirect_uris": [REDIRECT], "token_endpoint_auth_method": "client_secret_post", "grant_types": ["authorization_code", "refresh_token", "implicit"]},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["token_endpoint_auth_method"] == "none" and "client_secret" not in body
    assert body["grant_types"] == ["authorization_code", "refresh_token"]


def test_client_id_can_come_from_a_basic_auth_header(app):
    client_id = _register(app)
    verifier, challenge = _pkce()
    code = _query(_approve(app, client_id, challenge))["code"]
    basic = base64.b64encode(f"{client_id}:ignored".encode()).decode()
    res = app.post(
        "/api/oauth/token",
        data={"grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT, "code_verifier": verifier},
        headers={"Authorization": f"Basic {basic}"},
    )
    assert res.status_code == 200 and res.json()["access_token"].startswith("ofo_")
