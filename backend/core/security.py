"""Bearer-token guard for every /api/* route (except /api/auth/*, which is
wired without it). Tokens are minted by core.auth via Google OAuth or the
demo login — there is no anonymous access anymore (see API_CHANGES.md)."""

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.auth import CurrentUser, decode_access_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Missing bearer token — log in via /api/auth/demo or /api/auth/google/login",
        )
    try:
        return decode_access_token(creds.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None
