from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    bitget_base_url: str = "https://api.bitget.com"
    frontend_origins: str = "http://localhost:5173"
    market_cache_seconds: int = 10

    # Cheap market watcher. It never calls the LLM on a timer; it only derives
    # Pulse events from public market metrics. Deep analysis is user-triggered.
    watcher_enabled: bool = True
    watcher_interval_seconds: int = 60

    # Alibaba Cloud Model Studio / Qwen. The shared Singapore DashScope
    # endpoint remains valid; a workspace-dedicated URL can be supplied later.
    qwen_api_key: str = ""
    qwen_base_url: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    qwen_model: str = "qwen-plus"

    # Official bitget-signal installer currently points clients to this public
    # MCP endpoint. No Bitget credentials are sent to it.
    bitget_signal_mcp_url: str = "https://datahub.noxiaohao.com/mcp"

    # Run Vibe-Trading as a Streamable HTTP MCP sidecar, for example:
    # python agent/mcp_server.py --transport http --host 0.0.0.0 --port 8001
    vibe_mcp_url: str = ""
    mcp_timeout_seconds: float = 20.0

    # Optional persistence. Without this, Arena uses an in-memory store so the
    # project remains runnable before MongoDB Atlas is configured.
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
