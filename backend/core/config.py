from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    log_level: str = "info"

    meta_api_key: str = ""
    # Meta's official Llama API, OpenAI-compatible mode. Override via env if
    # the hackathon provides a different gateway/key.
    meta_api_base_url: str = "https://api.llama.com/compat/v1"
    meta_model: str = "Llama-4-Maverick-17B-128E-Instruct-FP8"

    database_url: str = "sqlite:///./data/app.db"

    class Config:
        env_file = ".env"


settings = Settings()
