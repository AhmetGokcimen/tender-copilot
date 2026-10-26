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

    class Config:
        env_file = ".env"


settings = Settings()
