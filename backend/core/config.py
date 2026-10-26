from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_env: str = "development"
    log_level: str = "info"

    meta_api_key: str = ""
    meta_api_base_url: str = ""

    database_url: str = "sqlite:///./data/app.db"

    class Config:
        env_file = ".env"


settings = Settings()
