from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from backend.api.auth_routes import router as auth_router
from backend.api.internal_routes import router as internal_router
from backend.api.routes import router as api_router
from backend.core.caiet_jobs import reap_stale_jobs
from backend.core.config import settings
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
app.include_router(api_router, prefix="/api")
app.include_router(internal_router)
# Also under /api: on Vercel only /api/* reaches this function (vercel.json),
# so the scheduled sync calls https://<site>/api/internal/sync-tenders.
app.include_router(internal_router, prefix="/api")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    with Session(engine) as session:
        reap_stale_jobs(session)
        reap_stale_score_jobs(session)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
