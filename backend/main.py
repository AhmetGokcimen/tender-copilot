import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session

from backend.api.auth_routes import router as auth_router
from backend.api.internal_routes import router as internal_router
from backend.api.public_routes import router as public_router
from backend.api.routes import router as api_router
from backend.core.caiet_jobs import reap_stale_jobs
from backend.core.config import settings
from backend.core.errors import error_summary
from backend.core.score_jobs import reap_stale_jobs as reap_stale_score_jobs
from backend.db import engine, init_db

app = FastAPI(
    title="Tender Copilot API",
    version="0.6.0",
    description=(
        "Multi-country public-procurement copilot backend. Only Romania/SEAP "
        "is implemented so far — see the repo README for the adapter "
        "architecture. Every /api/* call except /api/auth/* needs an "
        "`Authorization: Bearer <JWT>` header; mint one via /api/auth/demo "
        "(one click) or /api/auth/google/login. Data is multi-tenant: every "
        "login owns its companies via onboarding. POST /internal/sync-tenders "
        "is the cron-triggered incremental sync (X-Sync-Token, not JWT). "
        "Breaking changes vs 0.5.0 are listed in API_CHANGES.md."
    ),
)

_origins = ["*"] if settings.allowed_origins == "*" else settings.allowed_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials="*" not in _origins,  # browsers reject "*" combined with credentials
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(public_router, prefix="/api")
app.include_router(api_router, prefix="/api")
app.include_router(internal_router)
# Also under /api: on Vercel only /api/* reaches this function (vercel.json),
# so the scheduled sync calls https://<site>/api/internal/sync-tenders.
app.include_router(internal_router, prefix="/api")


_log = logging.getLogger(__name__)
_ready = False
# Last setup failure, reported by /api/internal/diagnostics (no secrets in it).
setup_error: str | None = None


def ensure_ready() -> None:
    """Creates tables and reaps stale jobs once per process. Called on
    startup and, because serverless runtimes may skip ASGI startup events,
    again lazily before the first request."""
    global _ready, setup_error
    if _ready:
        return
    try:
        init_db()
        with Session(engine) as session:
            reap_stale_jobs(session)
            reap_stale_score_jobs(session)
    except Exception as e:
        setup_error = error_summary(e)
        _log.exception("backend setup failed")
        raise
    setup_error = None
    _ready = True


@app.on_event("startup")
def on_startup() -> None:
    # Never fail startup: a failing lifespan turns every route into a 500,
    # diagnostics included. Requests retry setup lazily instead.
    try:
        ensure_ready()
    except Exception:  # noqa: BLE001 — kept in setup_error for diagnostics
        _log.warning("startup setup failed; retrying on first request")


@app.middleware("http")
async def _ready_before_request(request, call_next):
    # Health and diagnostics must answer even when the database does not.
    if not _ready and not request.url.path.endswith(("/health", "/internal/diagnostics")):
        from starlette.concurrency import run_in_threadpool

        await run_in_threadpool(ensure_ready)
    return await call_next(request)


@app.exception_handler(Exception)
async def _internal_error(request: Request, exc: Exception) -> JSONResponse:
    # Unhandled errors are logged; the sync job (internal routes only) also
    # gets the error class so a failing run says what broke.
    _log.exception("unhandled error on %s", request.url.path)
    detail = error_summary(exc) if "/internal/" in request.url.path else "Internal Server Error"
    return JSONResponse(status_code=500, content={"detail": detail})


@app.get("/health")
@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
