from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    bitget_base_url: str = "https://api.bitget.com"
    frontend_origins: str = "http://localhost:5173"
    market_cache_seconds: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


settings = Settings()
