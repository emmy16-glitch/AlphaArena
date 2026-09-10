from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from app.config import settings
from app.services.mcp import MCPError, MCPHttpClient


UNDERLYING = {
    "rNVDA": "NVDA",
    "rTSLA": "TSLA",
    "rAAPL": "AAPL",
    "rMSFT": "MSFT",
    "rAMD": "AMD",
    "rQQQ": "QQQ",
}


def _clip(value: Any, limit: int = 4500) -> str:
    text = value if isinstance(value, str) else str(value)
    return text if len(text) <= limit else text[:limit] + "…"


class VibeTradingResearch:
    @property
    def enabled(self) -> bool:
        return settings.vibe_enabled

    async def snapshot(self, display_symbol: str) -> dict[str, Any]:
        ticker = UNDERLYING.get(display_symbol, display_symbol.lstrip("r").upper())
        if not self.enabled:
            return {"connected": False, "ticker": ticker, "evidence": {}, "errors": ["VIBE_MCP_URL is not configured"]}

        client = MCPHttpClient(settings.vibe_mcp_url, "Vibe-Trading")
        end = date.today()
        start = end - timedelta(days=180)
        calls: list[tuple[str, dict[str, Any]]] = [
            ("technical_indicators", {"symbol": ticker}),
            ("get_fundamentals", {"symbols": [ticker]}),
            ("get_stock_news", {"code": f"{ticker}.US", "scope": "stock", "limit": 8}),
            ("get_sec_filings", {"ticker": ticker}),
            ("get_financial_statements", {"code": f"{ticker}.US", "statement": "indicators", "period": "quarter", "offset": 0}),
            ("get_market_data", {"codes": [f"{ticker}.US"], "start_date": start.isoformat(), "end_date": end.isoformat(), "source": "auto", "interval": "1D", "max_rows": 220}),
        ]
        evidence: dict[str, str] = {}
        errors: list[str] = []
        for name, arguments in calls:
            try:
                evidence[name] = _clip(await client.call_tool(name, arguments))
            except Exception as exc:  # one unavailable finance source must not kill the report
                errors.append(f"{name}: {exc}")
        return {
            "connected": bool(evidence),
            "ticker": ticker,
            "evidence": evidence,
            "errors": errors,
        }

    async def historical_context(self, display_symbol: str) -> dict[str, Any]:
        snapshot = await self.snapshot(display_symbol)
        return {
            "connected": snapshot["connected"],
            "ticker": snapshot["ticker"],
            "market_data": snapshot["evidence"].get("get_market_data", ""),
            "technical": snapshot["evidence"].get("technical_indicators", ""),
            "errors": snapshot["errors"],
        }


vibe_research = VibeTradingResearch()
