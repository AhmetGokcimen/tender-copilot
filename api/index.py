"""Vercel serverless entrypoint for the FastAPI backend.

Vercel turns every .py file under api/ into a separate function, so this
directory holds ONLY this file: it re-exports the real `app` from the
backend package (all routes already carry the /api prefix, and
vercel.json rewrites /api/* here). Local dev runs uvicorn against
backend.main:app directly — this file is never used locally.
"""

from backend.main import app  # noqa: F401 — re-exported for Vercel
