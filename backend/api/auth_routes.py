"""Login routes. Deliberately NOT behind the bearer guard (main.py wires
this router without it): these are the routes that hand out tokens."""

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlmodel import Session

from backend.core.auth import (
    DEMO_USER,
    CurrentUser,
    build_google_authorize_url,
    create_access_token,
    create_demo_token,
    create_oauth_state,
    exchange_code_for_tokens,
    fetch_google_userinfo,
    frontend_token_redirect,
    verify_oauth_state,
)
from backend.core.config import settings
from backend.core.membership import get_or_create_user, user_companies
from backend.core.security import get_current_user
from backend.db import get_session

router = APIRouter(tags=["auth"])


@router.get("/auth/google/login")
def google_login() -> RedirectResponse:
    if not settings.google_client_id:
        raise HTTPException(
            status_code=501, detail="Google OAuth not configured — use /api/auth/demo"
        )
    return RedirectResponse(build_google_authorize_url(create_oauth_state()))


@router.get("/auth/google/callback")
async def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    session: Session = Depends(get_session),
) -> RedirectResponse:
    if error:
        raise HTTPException(status_code=401, detail=f"Google login failed: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code/state — restart at /api/auth/google/login")
    try:
        verify_oauth_state(state)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid or expired state — restart login") from None
    tokens = await exchange_code_for_tokens(code)
    info = await fetch_google_userinfo(tokens["access_token"])
    email = info["email"]
    get_or_create_user(
        session,
        subject=f"google:{email}",
        email=email,
        name=info.get("name", email),
        provider="google",
    )
    token = create_access_token(
        sub=f"google:{email}",
        email=email,
        name=info.get("name", email),
        provider="google",
    )
    return RedirectResponse(frontend_token_redirect(token))


@router.get("/auth/demo")
def demo_login(session: Session = Depends(get_session)) -> RedirectResponse:
    """Zero-friction demo entry: mints the fixed demo user's long-lived
    token and hands it to the frontend — no Google account needed."""
    get_or_create_user(session, subject=DEMO_USER["sub"], email=DEMO_USER["email"], name=DEMO_USER["name"], provider="demo")
    return RedirectResponse(frontend_token_redirect(create_demo_token()))


@router.get("/auth/me")
def me(
    session: Session = Depends(get_session),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    db_user = get_or_create_user(
        session, subject=user.sub, email=user.email, name=user.name, provider=user.provider
    )
    return {
        "sub": user.sub,
        "email": user.email,
        "name": user.name,
        "provider": user.provider,
        "company_ids": [c.id for c in user_companies(session, db_user.id)],
    }
