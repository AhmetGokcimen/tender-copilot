from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    app_env: str = "development"
    log_level: str = "info"

    meta_api_key: str = ""
    # Confirmed live (2026-10-26): api.meta.ai's Responses API, not the
    # OpenAI-compatible chat/completions shape — POST {base_url}/responses
    # with {model, instructions, input: [...], text: {format: {...}}}.
    meta_api_base_url: str = "https://api.meta.ai/v1"
    meta_model: str = "muse-wonder-1.0"

    # Absolute and anchored to backend/ (not the cwd): the server now runs
    # from the repo root, so a bare ./data/... would silently create a
    # second database in the wrong place. DATABASE_URL env still overrides
    # (tests use a temp file; production will use Postgres).
    database_url: str = f"sqlite:///{(_BACKEND_DIR / 'data' / 'app.db').as_posix()}"

    # JWT secret for session/OAuth-state tokens. The default keeps local
    # demo setup frictionless but is NOT safe for anything public — set a
    # long random JWT_SECRET there (see .env.example).
    jwt_secret: str = "dev-only-insecure-change-me"
    # Supabase Auth: the frontend signs users in with Supabase and sends its
    # access token. Tokens are verified against the project's JWKS
    # (asymmetric keys); SUPABASE_JWT_SECRET covers projects still on the
    # legacy shared HS256 secret. The URL is public; set it empty to stop
    # accepting Supabase tokens.
    supabase_url: str = "https://goqnsooohsohbfpshszh.supabase.co"
    supabase_jwt_secret: str = ""
    # The one-click demo login hands every visitor the same shared user, so a
    # deployed API (Vercel) refuses it unless this is set (see core.auth).
    enable_demo_login: bool = False
    # Past-winners lookups one user may run per calendar month (each distinct
    # tender costs one). Plans can raise this later; for now it is one number.
    past_winners_monthly_limit: int = 10
    # Plan every user gets until billing exists (see core.plans). Pre-launch: all features on.
    default_plan: str = "pro"
    # Google OAuth 2.0 (authorization code flow). Empty = Google login
    # disabled (the /auth/demo login still works).
    google_client_id: str = ""
    google_client_secret: str = ""
    # Where the frontend runs (OAuth/demo redirects land here) and where
    # this API runs (the Google redirect URI is {backend_url}/api/auth/...).
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    # Comma-separated CORS allow-list. No "*" default: dev (localhost:3000)
    # plus whatever prod origin is deployed, nothing else.
    allowed_origins: str = "http://localhost:3000"
    # Shared secret for POST /internal/sync-tenders (X-Sync-Token header),
    # separate from user JWT auth. Empty = the endpoint refuses with 503.
    sync_secret: str = ""


settings = Settings()
