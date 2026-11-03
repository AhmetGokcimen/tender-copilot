"""Key management for the signed-in web app: create, list, revoke API keys.

These routes use the normal session JWT (a key must not be able to mint more
keys). The raw key appears only in the create response.
"""

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session

from backend.core import api_keys
from backend.core.membership import get_request_user
from backend.core.plans import API_MAX_KEYS, api_daily_limit, user_plan
from backend.core.security import get_current_user
from backend.db import get_session
from backend.models.api_key import ApiKey
from backend.models.user import User

router = APIRouter(prefix="/api-keys", tags=["api-keys"], dependencies=[Depends(get_current_user)])


class ApiKeyView(BaseModel):
    id: int
    name: str
    prefix: str
    company_id: int | None
    created_at: datetime
    last_used_at: datetime | None
    expires_at: datetime | None
    connected_app: bool = False  # an app signed in through OAuth, not a key the user made

    @classmethod
    def of(cls, key: ApiKey) -> "ApiKeyView":
        return cls(
            id=key.id, name=key.name, prefix=key.prefix, company_id=key.company_id,
            created_at=key.created_at, last_used_at=key.last_used_at, expires_at=key.expires_at,
            connected_app=key.oauth_client_id is not None,
        )


class ApiKeyList(BaseModel):
    keys: list[ApiKeyView]
    max_keys: int
    daily_limit: int
    used_today: int


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    company_id: int | None = None
    expires_in_days: int | None = Field(default=None, ge=1, le=730)


class ApiKeyCreated(BaseModel):
    key: ApiKeyView
    secret: str  # shown once


@router.get("", response_model=ApiKeyList)
def list_keys(session: Session = Depends(get_session), user: User = Depends(get_request_user)) -> ApiKeyList:
    return ApiKeyList(
        keys=[ApiKeyView.of(k) for k in api_keys.active_keys(session, user.id)],
        max_keys=API_MAX_KEYS,
        daily_limit=api_daily_limit(user_plan(user)),
        used_today=api_keys.daily_usage(session, user.id),
    )


@router.post("", response_model=ApiKeyCreated, status_code=201)
def create_key(
    body: ApiKeyCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),
) -> ApiKeyCreated:
    key, raw = api_keys.create_key(
        session, user, name=body.name, company_id=body.company_id, expires_in_days=body.expires_in_days
    )
    return ApiKeyCreated(key=ApiKeyView.of(key), secret=raw)


@router.delete("/{key_id}", status_code=204)
def revoke_key(
    key_id: int, session: Session = Depends(get_session), user: User = Depends(get_request_user)
) -> None:
    api_keys.revoke_key(session, user, key_id)
