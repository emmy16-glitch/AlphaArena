from __future__ import annotations

from typing import Any

from app.config import settings
from app.services.mcp import MCPHttpClient
from app.services.vibe import UNDERLYING


class BitgetSignalResearch:
    async def snapshot(self, display_symbol: str) -> dict[str, Any]:
        """Collect public macro/news context through Bitget Signal's MCP.

        bitget-signal is primarily crypto/macro oriented, so AlphaArena uses it
        as cross-asset context rather than pretending it provides equity
        fundamentals. Company-specific equity research stays with Vibe-Trading.
        """
        if not settings.bitget_signal_mcp_url:
            return {"connected": False, "evidence": {}, "errors": ["Signal MCP URL not configured"]}

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
        calls: list[tuple[str, dict[str, Any]]] = [
            ("rates_yields", {"action": "rates_snapshot"}),
            ("global_assets", {"action": "price", "symbol": "^NDX"}),
            ("global_assets", {"action": "price", "symbol": "DX-Y.NYB"}),
            ("global_assets", {"action": "price", "symbol": "^TNX"}),
            ("global_assets", {"action": "price", "symbol": "^VIX"}),
            ("news_feed", {"action": "latest", "feeds": "cnbc,bbc_world,guardian", "keyword": topic, "limit": 6}),
            ("tradfi_news", {"action": "news", "limit": 6}),
        ]
        evidence: dict[str, Any] = {}
        errors: list[str] = []
        for index, (name, arguments) in enumerate(calls):
            try:
                value = await client.call_tool(name, arguments)
                key = name if name not in evidence else f"{name}_{index}"
                text = value if isinstance(value, str) else str(value)
                evidence[key] = text[:3500] + ("…" if len(text) > 3500 else "")
            except Exception as exc:
                errors.append(f"{name}: {exc}")
        return {"connected": bool(evidence), "evidence": evidence, "errors": errors}


bitget_signal = BitgetSignalResearch()
