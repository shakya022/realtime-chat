from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./chat.db"
    secret_key: str = "change-me"
    access_token_minutes: int = 60 * 24
    frontend_origin: str = "http://localhost:5173"

    # AI (optional). Leave empty to turn the AI features off.
    ai_provider: str = "gemini"
    ai_api_key: str = ""
    ai_model: str = ""
    ai_rate_limit_per_minute: int = 10

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()