from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    log_level: str = "info"

    meta_api_key: str = ""
    # Confirmed live (2026-10-26): api.meta.ai's Responses API, not the
    # OpenAI-compatible chat/completions shape — POST {base_url}/responses
    # with {model, instructions, input: [...], text: {format: {...}}}.
    meta_api_base_url: str = "https://api.meta.ai/v1"
    meta_model: str = "muse-wonder-1.0"

    database_url: str = "sqlite:///./data/app.db"

    # Demo-friendly by default: empty = no auth enforced, so the frontend
    # can integrate with zero setup. Set this to require an X-API-Key
    # header on every /api/* request — recommended only once this is
    # deployed somewhere public, to stop random traffic from burning
    # through the Meta API key's quota.
    api_key: str = ""
    # Comma-separated list of allowed origins, or "*" for any (the
    # hackathon-demo default — tighten before a real deployment).
    allowed_origins: str = "*"

    class Config:
        env_file = ".env"


settings = Settings()
