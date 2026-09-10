from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    bitget_base_url: str = "https://api.bitget.com"
    frontend_origins: str = "http://localhost:5173"
    market_cache_seconds: int = 10

    # Pulse only derives public market metrics. It must never spend LLM credits.
    watcher_enabled: bool = True
    watcher_interval_seconds: int = 60

    # Qwen model-family inference. Groq is the hackathon default, while the
    # OpenAI-compatible client remains usable with Alibaba or another host.
    ai_provider: str = "auto"
    qwen_api_key: str = ""
    qwen_base_url: str = "https://api.groq.com/openai/v1"
    qwen_model: str = "qwen/qwen3.6-27b"
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
    def qwen_provider(self) -> str:
        configured = self.ai_provider.strip().lower()
        if configured and configured != "auto":
            return configured
        hostname = (urlparse(self.qwen_base_url).hostname or "").lower()
        if hostname == "api.groq.com" or hostname.endswith(".groq.com"):
            return "groq"
        if hostname.endswith(".aliyuncs.com"):
            return "alibaba"
        if hostname == "api.openai.com" or hostname.endswith(".openai.com"):
            return "openai"
        return "openai-compatible"

    @property
    def vibe_enabled(self) -> bool:
        return bool(self.vibe_mcp_url.strip())


settings = Settings()
