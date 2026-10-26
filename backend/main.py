from fastapi import FastAPI

from api.routes import router as api_router
from db import init_db

app = FastAPI(title="Tender Copilot API", version="0.1.0")

app.include_router(api_router, prefix="/api")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
