from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    bitget_base_url: str = "https://api.bitget.com"
    frontend_origins: str = "http://localhost:5173"
    market_cache_seconds: int = 10

    # Pulse only derives public market metrics. It must never spend LLM credits.
    watcher_enabled: bool = True
    watcher_interval_seconds: int = 60

    # Alibaba Cloud Model Studio / Qwen. These are application-side safety
    # fuses, not a statement of the provider's billing/quota policy.
    qwen_api_key: str = ""
    qwen_base_url: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    qwen_model: str = "qwen-plus"
    qwen_daily_attempt_limit: int = 12
    qwen_max_output_tokens: int = 1400
    qwen_max_attempts_per_request: int = 1
    qwen_timeout_seconds: float = 35.0

    # Public Bitget Signal MCP used for macro/news context.
    bitget_signal_mcp_url: str = "https://datahub.noxiaohao.com/mcp"
    signal_cache_seconds: int = 300

    # Vibe-Trading is a research-only MCP sidecar. Shell tools stay disabled in
    # the sidecar container. A longer cache protects latency and free resources.
    vibe_mcp_url: str = ""
    vibe_cache_seconds: int = 900
    mcp_timeout_seconds: float = 20.0

    # Optional persistence. The Arena remains paper-only regardless of storage.
    mongodb_uri: str = ""
    mongodb_db: str = "alphaarena"
    arena_starting_capital: float = 100_000.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def qwen_enabled(self) -> bool:
        return bool(self.qwen_api_key.strip())

    @property
    def vibe_enabled(self) -> bool:
        return bool(self.vibe_mcp_url.strip())


settings = Settings()
