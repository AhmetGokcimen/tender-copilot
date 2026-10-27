from pydantic_settings import BaseSettings, SettingsConfigDict


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

    database_url: str = "sqlite:///./data/app.db"

    # JWT secret for session/OAuth-state tokens. The default keeps local
    # demo setup frictionless but is NOT safe for anything public — set a
    # long random JWT_SECRET there (see .env.example).
    jwt_secret: str = "dev-only-insecure-change-me"
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


settings = Settings()
