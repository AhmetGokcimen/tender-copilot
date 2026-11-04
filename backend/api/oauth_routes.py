"""OAuth 2.1 endpoints that let an AI assistant (claude.ai, ChatGPT, ...) connect
to /api/mcp by signing the user in, instead of pasting an API key.

Two routers:
- `well_known_router` is mounted at the site root: discovery documents that
  clients fetch from /.well-known/ (vercel.json routes that path here).
- `router` is mounted under /api: client registration, the consent API the
  web app's /auth/authorize page calls (session JWT), and the token endpoint.

Flow: the client finds the MCP server, gets a 401 whose WWW-Authenticate
points at the protected-resource document, reads the authorization-server
document, registers itself, sends the user's browser to the consent page
(which signs them in and asks), receives a code on its redirect URI and swaps
it for tokens. See core/oauth.py for the rules each step enforces.
"""

import base64
from urllib.parse import parse_qs, unquote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session
from starlette.concurrency import run_in_threadpool

from backend.core import oauth
from backend.core.api_keys import public_origin
from backend.core.membership import get_request_user
from backend.db import engine, get_session
from backend.models.user import User

well_known_router = APIRouter(tags=["oauth"])
router = APIRouter(prefix="/oauth", tags=["oauth"])

NO_STORE = {"Cache-Control": "no-store", "Pragma": "no-cache"}


def _json(body: dict, status: int = 200) -> JSONResponse:
    return JSONResponse(body, status_code=status, headers=NO_STORE)


# --- discovery -------------------------------------------------------------------------------


@well_known_router.get("/.well-known/oauth-protected-resource")
@well_known_router.get("/.well-known/oauth-protected-resource/{resource_path:path}")
def protected_resource(request: Request, resource_path: str = "api/mcp") -> JSONResponse:
    origin = public_origin(request)
    return _json(
        {
            "resource": f"{origin}/{resource_path.strip('/') or 'api/mcp'}",
            "authorization_servers": [origin],
            "scopes_supported": [oauth.SCOPE],
            "bearer_methods_supported": ["header"],
            "resource_name": "Licits tenders",
        }
    )


@well_known_router.get("/.well-known/oauth-authorization-server")
@well_known_router.get("/.well-known/oauth-authorization-server/{issuer_path:path}")
def authorization_server(request: Request, issuer_path: str = "") -> JSONResponse:
    origin = public_origin(request)
    return _json(
        {
            "issuer": origin,
            "authorization_endpoint": f"{origin}/en/auth/authorize",
            "token_endpoint": f"{origin}/api/oauth/token",
            "revocation_endpoint": f"{origin}/api/oauth/revoke",
            "registration_endpoint": f"{origin}/api/oauth/register",
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "code_challenge_methods_supported": ["S256"],
            "token_endpoint_auth_methods_supported": ["none"],
            "scopes_supported": [oauth.SCOPE],
        }
    )


# --- client registration ---------------------------------------------------------------------


def _error(e: oauth.OAuthError) -> JSONResponse:
    return _json({"error": e.error, "error_description": e.description}, e.status)


def _basic_client_id(request: Request) -> str:
    """client_id from an `Authorization: Basic` header, for clients that send it
    that way instead of in the form (the secret, if any, is not used)."""
    header = request.headers.get("authorization", "")
    if header[:6].lower() != "basic ":
        return ""
    try:
        return unquote(base64.b64decode(header[6:]).decode().split(":", 1)[0])
    except (ValueError, UnicodeDecodeError):
        return ""


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")


@router.post("/register")
async def register(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except ValueError:
        return _json({"error": "invalid_client_metadata", "error_description": "Body must be JSON"}, 400)
    if not isinstance(body, dict):
        return _json({"error": "invalid_client_metadata", "error_description": "Body must be an object"}, 400)

    def run() -> dict:
        with Session(engine) as session:
            client = oauth.register_client(session, body, _client_ip(request))
            return {
                "client_id": client.id,
                "client_name": client.name,
                "redirect_uris": client.redirect_uris,
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "token_endpoint_auth_method": "none",
                "scope": oauth.SCOPE,
            }

    try:
        return _json(await run_in_threadpool(run), 201)
    except oauth.OAuthError as e:
        return _error(e)


# --- consent (called by the web app's /auth/authorize page) ---------------------------------


class ClientInfo(BaseModel):
    name: str
    scope: str = oauth.SCOPE


@router.get("/client", response_model=ClientInfo)
def client_info(client_id: str, redirect_uri: str, session: Session = Depends(get_session)) -> ClientInfo:
    """Name of the app asking for access, for the consent screen. 400 when
    the app or redirect address is not registered."""
    return ClientInfo(name=oauth.checked_client(session, client_id, redirect_uri).name)


class AuthorizeBody(BaseModel):
    client_id: str
    redirect_uri: str
    response_type: str = "code"
    code_challenge: str = ""
    code_challenge_method: str = ""
    state: str = ""
    approve: bool


class AuthorizeResult(BaseModel):
    redirect_to: str


@router.post("/authorize", response_model=AuthorizeResult)
def authorize(
    body: AuthorizeBody,
    session: Session = Depends(get_session),
    user: User = Depends(get_request_user),  # the signed-in user's session JWT
) -> AuthorizeResult:
    client = oauth.checked_client(session, body.client_id, body.redirect_uri)
    target = oauth.authorize(
        session, user_id=user.id, client=client, redirect_uri=body.redirect_uri,
        response_type=body.response_type, code_challenge=body.code_challenge,
        code_challenge_method=body.code_challenge_method, state=body.state, approve=body.approve,
    )
    return AuthorizeResult(redirect_to=target)


# --- token endpoint ---------------------------------------------------------------------------


@router.post("/token")
async def token(request: Request) -> JSONResponse:
    raw = (await request.body()).decode("utf-8", "replace")
    form = {k: v[0] for k, v in parse_qs(raw, keep_blank_values=True).items()}
    form.setdefault("client_id", _basic_client_id(request))
    grant = form.get("grant_type", "")

    def run() -> dict:
        with Session(engine) as session:
            if grant == "authorization_code":
                return oauth.exchange_code(
                    session, client_id=form.get("client_id", ""), code=form.get("code", ""),
                    redirect_uri=form.get("redirect_uri", ""), code_verifier=form.get("code_verifier", ""),
                )
            if grant == "refresh_token":
                return oauth.refresh(
                    session, client_id=form.get("client_id", ""), refresh_token=form.get("refresh_token", "")
                )
            raise oauth.OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token")

    try:
        return _json(await run_in_threadpool(run))
    except oauth.OAuthError as e:
        return _error(e)


@router.post("/revoke")
async def revoke(request: Request) -> JSONResponse:
    raw = (await request.body()).decode("utf-8", "replace")
    form = {k: v[0] for k, v in parse_qs(raw, keep_blank_values=True).items()}

    def run() -> None:
        with Session(engine) as session:
            oauth.revoke(session, token=form.get("token", ""), client_id=form.get("client_id", ""))

    await run_in_threadpool(run)
    return _json({})


@router.get("/token")
def token_get() -> None:
    raise HTTPException(status_code=405, detail="POST only", headers={"Allow": "POST"})
