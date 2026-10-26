from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router as api_router
from core.config import settings
from db import init_db

app = FastAPI(
    title="Tender Copilot API",
    version="0.1.0",
    description=(
        "Multi-country public-procurement copilot backend. Only Romania/SEAP "
        "is implemented so far — see the repo README for the adapter "
        "architecture. Open (no auth) unless API_KEY is set in the backend's "
        "environment, in which case every /api/* call needs an X-API-Key header."
    ),
)

_origins = ["*"] if settings.allowed_origins == "*" else settings.allowed_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=settings.allowed_origins != "*",  # can't combine "*" with credentials
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
