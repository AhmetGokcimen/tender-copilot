"""OAuth 2.1 state for connecting AI assistants (claude.ai, ChatGPT, ...) to the
MCP server without pasting a key.

OAuthClient: an app registered through dynamic client registration (RFC 7591).
OAuthCode: a short-lived, single-use authorization code bound to a PKCE
challenge. OAuthToken: one issued access/refresh pair. Tokens and codes are
stored only as SHA-256 hashes.

Every grant to an app also gets one `ApiKey` row (`oauth_client_id` set), the
"connection". Quota, last-used time, listing and revoking all work through it,
so an OAuth token is just another way to authenticate as that key.
"""

from datetime import UTC, datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class OAuthClient(SQLModel, table=True):
    id: str = Field(primary_key=True)  # the public client_id
    name: str
    redirect_uris: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_utcnow)


class OAuthCode(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    code_hash: str = Field(unique=True, index=True)
    client_id: str = Field(foreign_key="oauthclient.id")
    user_id: int = Field(foreign_key="app_user.id", index=True)
    redirect_uri: str
    code_challenge: str  # S256 only
    expires_at: datetime
    used_at: datetime | None = None


class OAuthToken(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    key_id: int = Field(foreign_key="apikey.id", index=True)  # the connection
    client_id: str = Field(foreign_key="oauthclient.id")
    access_hash: str = Field(unique=True, index=True)
    access_expires_at: datetime
    refresh_hash: str = Field(unique=True, index=True)
    refresh_expires_at: datetime
    refresh_used_at: datetime | None = None
    created_at: datetime = Field(default_factory=_utcnow)
