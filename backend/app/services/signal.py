from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any

from app.config import settings
from app.services.mcp import MCPHttpClient
from app.services.vibe import UNDERLYING


@dataclass
class _SignalCache:
    value: dict[str, Any]
    expires_at: float


class BitgetSignalResearch:
    def __init__(self) -> None:
        self._cache: dict[str, _SignalCache] = {}

    async def health(self) -> dict[str, Any]:
        if not settings.bitget_signal_mcp_url:
            return {"connected": False, "reason": "Signal MCP URL not configured"}
        try:
            tools = await asyncio.wait_for(
                MCPHttpClient(settings.bitget_signal_mcp_url, "Bitget Signal").list_tools(),
                timeout=settings.mcp_timeout_seconds + 3,
            )
            names = sorted(str(tool.get("name")) for tool in tools if tool.get("name"))
            return {"connected": bool(names), "tool_count": len(names)}
        except Exception:
            return {"connected": False, "reason": "Bitget Signal research is unavailable"}

    async def snapshot(self, display_symbol: str) -> dict[str, Any]:
        """Collect public macro/news context through the Bitget Signal MCP.

        Signal is contextual evidence only. Company-specific history and
        fundamentals remain Vibe-Trading's responsibility.
        """
        if not settings.bitget_signal_mcp_url:
            return {"connected": False, "evidence": {}, "errors": ["Signal research is not configured"]}

        cached = self._cache.get(display_symbol)
        if cached and cached.expires_at > time.time():
            return cached.value

        ticker = UNDERLYING.get(display_symbol, display_symbol.lstrip("r").upper())
        topic = {
            "NVDA": "NVIDIA",
            "TSLA": "Tesla",
            "AAPL": "Apple",
            "MSFT": "Microsoft",
            "AMD": "AMD",
            "QQQ": "Nasdaq",
        }.get(ticker, ticker)
        client = MCPHttpClient(settings.bitget_signal_mcp_url, "Bitget Signal")
        # global_assets price lookups are excluded: the upstream tool fails
        # them for every symbol (verified with SPY as well as ^NDX/DX-Y.NYB,
        # 2026-09-11) after ~16s with an empty error. Calling it only burns
        # the per-request latency budget and adds error noise.
        calls: list[tuple[str, dict[str, Any]]] = [
            ("rates_yields", {"action": "rates_snapshot"}),
            ("news_feed", {"action": "latest", "feeds": "cnbc,bbc_world,guardian", "keyword": topic, "limit": 6}),
            ("tradfi_news", {"action": "news", "limit": 6}),
        ]
        try:
            available = await client.has_tools({name for name, _ in calls})
        except Exception:
            return {"connected": False, "evidence": {}, "errors": ["Signal research is unavailable"]}

        async def run_call(index: int, name: str, arguments: dict[str, Any]) -> tuple[int, str, Any, str | None]:
            if name not in available:
                return index, name, None, None
            try:
                value = await client.call_tool(name, arguments)
                return index, name, value, None
            except Exception:
                return index, name, None, f"{name}: temporarily unavailable"

        # These are independent public-context lookups. Running them together
        # keeps Signal latency bounded by the slowest source instead of the
        # sum of sequential MCP round trips.
        results = await asyncio.gather(*(run_call(index, name, arguments) for index, (name, arguments) in enumerate(calls)))
        evidence: dict[str, Any] = {}
        errors: list[str] = []
        for index, name, value, error in results:
            if error:
                errors.append(error)
                continue
            if value is None:
                continue
            key = name if name not in evidence else f"{name}_{index}"
            text = value if isinstance(value, str) else str(value)
            evidence[key] = text[:3500] + ("…" if len(text) > 3500 else "")
        result = {"connected": bool(evidence), "evidence": evidence, "errors": errors}
        if result["connected"]:
            self._cache[display_symbol] = _SignalCache(
                result,
                time.time() + max(1, settings.signal_cache_seconds),
            )
        return result


bitget_signal = BitgetSignalResearch()
