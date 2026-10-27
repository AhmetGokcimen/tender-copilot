"""JWT auth + Google OAuth + demo login (offline; Google HTTP stubbed)."""

import jwt
import pytest
from fastapi.testclient import TestClient

from core.config import settings


def _token(**overrides) -> str:
    from core.auth import create_access_token

    claims = {"sub": "u1", "email": "u@x.ro", "name": "U", "provider": "google"}
    claims.update(overrides)
    return create_access_token(**claims)


def test_token_roundtrip() -> None:
    from core.auth import decode_access_token

    user = decode_access_token(_token())
    assert (user.sub, user.email, user.provider) == ("u1", "u@x.ro", "google")


def test_tampered_token_rejected() -> None:
    from core.auth import decode_access_token

    with pytest.raises(jwt.PyJWTError):
        decode_access_token(_token() + "x")


def test_protected_route_needs_bearer(api: TestClient) -> None:
    assert api.get("/api/companies").status_code == 401
    res = api.get("/api/companies", headers={"Authorization": f"Bearer {_token()}"})
    assert res.status_code == 200
    assert res.json() == {"items": [], "total": 0}


def test_demo_login_redirects_with_long_lived_token(api: TestClient) -> None:
    from core.auth import decode_access_token

    res = api.get("/api/auth/demo")
    assert res.status_code in (302, 307)
    location = res.headers["location"]
    assert location.startswith(f"{settings.frontend_url}/auth/callback?token=")
    user = decode_access_token(location.split("token=", 1)[1])
    assert user.sub == "demo"


def test_me_returns_current_user(api: TestClient) -> None:
    res = api.get("/api/auth/me", headers={"Authorization": f"Bearer {_token()}"})
    assert res.status_code == 200
    assert res.json()["email"] == "u@x.ro"
    assert res.json()["company_ids"] == []
    assert api.get("/api/auth/me").status_code == 401


def test_demo_login_provisions_user_row(api: TestClient) -> None:
    from sqlmodel import Session, select

    from db import engine
    from models.user import User

    api.get("/api/auth/demo")
    api.get("/api/auth/demo")
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        assert [(u.subject, u.provider) for u in users] == [("demo", "demo")]


def test_me_lists_user_company_ids(api: TestClient) -> None:
    from sqlmodel import Session

    from core.membership import get_or_create_user, link_user_company
    from db import engine
    from models.company import CompanyProfile

    with Session(engine) as session:
        session.add(CompanyProfile(name="Mine"))
        session.commit()
        user = get_or_create_user(
            session, subject="u1", email="u@x.ro", name="U", provider="google"
        )
        link_user_company(session, user.id, 1)

    res = api.get("/api/auth/me", headers={"Authorization": f"Bearer {_token()}"})
    assert res.json()["company_ids"] == [1]


@pytest.mark.asyncio
async def test_google_callback_mints_token_on_valid_state(
    api: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from core import auth

    async def fake_exchange(code: str) -> dict:
        assert code == "auth-code"
        return {"access_token": "google-at"}

    async def fake_userinfo(access_token: str) -> dict:
        assert access_token == "google-at"
        return {"email": "jane@gmail.com", "name": "Jane"}

    from api import auth_routes

    monkeypatch.setattr(auth_routes, "exchange_code_for_tokens", fake_exchange)
    monkeypatch.setattr(auth_routes, "fetch_google_userinfo", fake_userinfo)
    state = auth.create_oauth_state()

    res = api.get(f"/api/auth/google/callback?code=auth-code&state={state}")
    assert res.status_code in (302, 307)
    user = auth.decode_access_token(res.headers["location"].split("token=", 1)[1])
    assert (user.email, user.provider) == ("jane@gmail.com", "google")


def test_google_callback_rejects_bad_state_and_errors(api: TestClient) -> None:
    assert api.get("/api/auth/google/callback?code=x&state=bogus").status_code == 400
    assert api.get("/api/auth/google/callback?code=x").status_code == 400
    assert api.get("/api/auth/google/callback?error=access_denied").status_code == 401


def test_google_login_needs_client_id(api: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from core import auth

    assert api.get("/api/auth/google/login").status_code in (302, 307)  # conftest sets a test id
    monkeypatch.setattr(settings, "google_client_id", "")
    assert api.get("/api/auth/google/login").status_code == 501
    assert auth.google_redirect_uri().endswith("/api/auth/google/callback")
