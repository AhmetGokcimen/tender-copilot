"""Login routes. Deliberately NOT behind the bearer guard (main.py wires
this router without it): these are the routes that hand out tokens."""

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from core.auth import (
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
from core.config import settings
from core.security import get_current_user

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
    code: str | None = None, state: str | None = None, error: str | None = None
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
    token = create_access_token(
        sub=f"google:{info['email']}",
        email=info["email"],
        name=info.get("name", info["email"]),
        provider="google",
    )
    return RedirectResponse(frontend_token_redirect(token))


@router.get("/auth/demo")
def demo_login() -> RedirectResponse:
    """Zero-friction demo entry: mints the fixed demo user's long-lived
    token and hands it to the frontend — no Google account needed."""
    return RedirectResponse(frontend_token_redirect(create_demo_token()))


@router.get("/auth/me")
def me(user: CurrentUser = Depends(get_current_user)) -> dict:
    return {"sub": user.sub, "email": user.email, "name": user.name, "provider": user.provider}
