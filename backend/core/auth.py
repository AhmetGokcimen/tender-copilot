"""JWT session tokens + Google OAuth 2.0 (authorization code flow).

Deliberately small: no signup/password/email-verify machinery (see task
scope). Two ways in: real Google login, or the one-click demo login that
mints a long-lived token for the fixed demo user. Google is contacted
with plain httpx against the documented OAuth2/userinfo endpoints — no
google-auth/authlib dependency needed.
"""

import time
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx
import jwt

from core.config import settings

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

DEMO_USER = {"sub": "demo", "email": "demo@ofera.local", "name": "Demo User"}

ACCESS_TOKEN_EXPIRE_SECONDS = 12 * 3600
DEMO_TOKEN_EXPIRE_SECONDS = 30 * 24 * 3600
OAUTH_STATE_EXPIRE_SECONDS = 600


@dataclass
class CurrentUser:
    sub: str
    email: str
    name: str
    provider: str  # "google" | "demo"


def create_access_token(
    *, sub: str, email: str, name: str, provider: str, expires_in: int = ACCESS_TOKEN_EXPIRE_SECONDS
) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": sub,
            "email": email,
            "name": name,
            "provider": provider,
            "iat": now,
            "exp": now + expires_in,
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> CurrentUser:
    """Raises jwt.PyJWTError when the token is bad or expired."""
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    return CurrentUser(
        sub=payload["sub"], email=payload["email"], name=payload["name"],
        provider=payload["provider"],
    )


def create_demo_token() -> str:
    return create_access_token(
        **DEMO_USER, provider="demo", expires_in=DEMO_TOKEN_EXPIRE_SECONDS
    )


def create_oauth_state() -> str:
    """Self-contained CSRF state: integrity + expiry verified from the JWT
    itself, so no server-side session store is needed."""
    now = int(time.time())
    return jwt.encode(
        {"purpose": "oauth-state", "iat": now, "exp": now + OAUTH_STATE_EXPIRE_SECONDS},
        settings.jwt_secret,
        algorithm="HS256",
    )


def verify_oauth_state(state: str) -> None:
    """Raises jwt.PyJWTError/ValueError when the state is forged or stale."""
    payload = jwt.decode(state, settings.jwt_secret, algorithms=["HS256"])
    if payload.get("purpose") != "oauth-state":
        raise ValueError("Not an OAuth state token")


def google_redirect_uri() -> str:
    return f"{settings.backend_url}/api/auth/google/callback"


def build_google_authorize_url(state: str) -> str:
    return GOOGLE_AUTHORIZE_URL + "?" + urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": google_redirect_uri(),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "online",
            "prompt": "select_account",
        }
    )


def frontend_token_redirect(token: str) -> str:
    return f"{settings.frontend_url}/auth/callback?token={token}"


async def exchange_code_for_tokens(code: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": google_redirect_uri(),
            },
        )
        response.raise_for_status()
        return response.json()


async def fetch_google_userinfo(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
        )
        response.raise_for_status()
        return response.json()
