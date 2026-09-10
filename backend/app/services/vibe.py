from __future__ import annotations

import asyncio
import json
import math
import statistics
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Mapping

from app.config import settings
from app.services.mcp import MCPHttpClient


UNDERLYING = {
    "rNVDA": "NVDA",
    "rTSLA": "TSLA",
    "rAAPL": "AAPL",
    "rMSFT": "MSFT",
    "rAMD": "AMD",
    "rQQQ": "QQQ",
}
_DATE_KEYS = ("date", "datetime", "trade_date", "time", "timestamp")


@dataclass
class _CacheItem:
    value: dict[str, Any]
    expires_at: float


def _clip(value: Any, limit: int = 5000) -> Any:
    if isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False, default=str)
    else:
        text = str(value)
    return text if len(text) <= limit else text[:limit] + "…"


def _as_mapping(value: Any) -> Mapping[str, Any]:
    if isinstance(value, Mapping):
        return value
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
            if isinstance(decoded, Mapping):
                return decoded
        except json.JSONDecodeError:
            pass
    return {}


def _records(payload: Any, symbol: str) -> list[dict[str, Any]]:
    mapping = _as_mapping(payload)
    raw = mapping.get(symbol) or mapping.get(symbol.replace(".US", "")) or []
    return [dict(row) for row in raw if isinstance(row, Mapping)] if isinstance(raw, list) else []


def _close_series(records: list[dict[str, Any]]) -> list[tuple[str, float]]:
    rows: list[tuple[str, float]] = []
    for index, row in enumerate(records):
        try:
            close = float(row.get("close"))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(close) or close <= 0:
            continue
        raw_date = next((row.get(key) for key in _DATE_KEYS if row.get(key) is not None), index)
        rows.append((str(raw_date), close))
    return rows


def _pct_returns(series: list[tuple[str, float]]) -> list[tuple[str, float]]:
    result: list[tuple[str, float]] = []
    for (_, previous), (when, current) in zip(series, series[1:]):
        if previous > 0:
            result.append((when, (current / previous - 1) * 100))
    return result


def _max_drawdown(closes: list[float]) -> float:
    if not closes:
        return 0.0
    peak = closes[0]
    worst = 0.0
    for value in closes:
        peak = max(peak, value)
        worst = min(worst, (value / peak - 1) * 100)
    return round(worst, 3)


def _percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    pos = max(0.0, min(1.0, q)) * (len(ordered) - 1)
    low = int(math.floor(pos))
    high = int(math.ceil(pos))
    if low == high:
        return ordered[low]
    fraction = pos - low
    return ordered[low] * (1 - fraction) + ordered[high] * fraction


def _paired_beta(asset_returns: list[tuple[str, float]], benchmark_returns: list[tuple[str, float]]) -> tuple[float | None, float | None, int]:
    benchmark = {when: value for when, value in benchmark_returns}
    pairs = [(value, benchmark[when]) for when, value in asset_returns if when in benchmark]
    if len(pairs) < 20:
        return None, None, len(pairs)
    xs = [pair[0] for pair in pairs]
    ys = [pair[1] for pair in pairs]
    mean_x = statistics.fmean(xs)
    mean_y = statistics.fmean(ys)
    covariance = statistics.fmean((x - mean_x) * (y - mean_y) for x, y in pairs)
    variance_y = statistics.fmean((y - mean_y) ** 2 for y in ys)
    std_x = statistics.pstdev(xs)
    std_y = statistics.pstdev(ys)
    beta = covariance / variance_y if variance_y > 1e-12 else None
    correlation = covariance / (std_x * std_y) if std_x > 1e-12 and std_y > 1e-12 else None
    return (round(beta, 4) if beta is not None else None, round(correlation, 4) if correlation is not None else None, len(pairs))


def _historical_stats(asset_records: list[dict[str, Any]], benchmark_records: list[dict[str, Any]]) -> dict[str, Any]:
    series = _close_series(asset_records)
    closes = [value for _, value in series]
    returns = _pct_returns(series)
    return_values = [value for _, value in returns]
    benchmark_returns = _pct_returns(_close_series(benchmark_records))
    beta, correlation, paired = _paired_beta(returns, benchmark_returns)
    momentum_20d = ((closes[-1] / closes[-21] - 1) * 100) if len(closes) >= 21 else 0.0
    annualized_vol = statistics.pstdev(return_values) * math.sqrt(252) if len(return_values) >= 2 else 0.0
    return {
        "observations": len(closes),
        "daily_return_median_pct": round(statistics.median(return_values), 3) if return_values else 0.0,
        "daily_return_worst_decile_pct": round(_percentile(return_values, 0.10), 3),
        "daily_return_best_decile_pct": round(_percentile(return_values, 0.90), 3),
        "annualized_volatility_pct": round(annualized_vol, 2),
        "momentum_20d_pct": round(momentum_20d, 2),
        "max_drawdown_pct": _max_drawdown(closes),
        "beta_to_qqq": beta,
        "correlation_to_qqq": correlation,
        "paired_observations": paired,
    }


def _move_analogues(asset_records: list[dict[str, Any]], current_move_pct: float, limit: int = 5) -> list[dict[str, str]]:
    series = _close_series(asset_records)
    returns = _pct_returns(series)
    if len(returns) < 3:
        return []
    target = abs(current_move_pct)
    direction = 1 if current_move_pct >= 0 else -1
    candidates: list[tuple[float, int]] = []
    for index, (_, move) in enumerate(returns[:-1]):
        if (1 if move >= 0 else -1) != direction:
            continue
        distance = abs(abs(move) - target)
        candidates.append((distance, index))
    candidates.sort(key=lambda item: item[0])
    analogues: list[dict[str, str]] = []
    for _, index in candidates[:limit]:
        when, move = returns[index]
        _, next_move = returns[index + 1]
        analogues.append({
            "label": f"{when}: underlying moved {move:+.2f}%",
            "outcome": f"Next observed daily move was {next_move:+.2f}%.",
            "relevance": f"Selected mechanically as one of the closest same-direction daily moves to the current {current_move_pct:+.2f}% move; it is an analogue, not a prediction.",
        })
    return analogues


class VibeTradingResearch:
    def __init__(self) -> None:
        self._cache: dict[str, _CacheItem] = {}

    @property
    def enabled(self) -> bool:
        return settings.vibe_enabled

    async def _call(self, name: str, arguments: dict[str, Any]) -> Any:
        client = MCPHttpClient(settings.vibe_mcp_url, "Vibe-Trading")
        return await client.call_tool(name, arguments)

    async def health(self) -> dict[str, Any]:
        if not self.enabled:
            return {"connected": False, "reason": "VIBE_MCP_URL is not configured"}
        try:
            tools = await asyncio.wait_for(MCPHttpClient(settings.vibe_mcp_url, "Vibe-Trading").list_tools(), timeout=settings.mcp_timeout_seconds + 3)
            names = {str(tool.get("name")) for tool in tools if tool.get("name")}
            required = {"get_market_data", "technical_indicators", "get_stock_news"}
            return {"connected": required.issubset(names), "tool_count": len(names), "required_tools": sorted(required), "missing": sorted(required - names)}
        except Exception as exc:
            return {"connected": False, "reason": str(exc)[:300]}

    async def snapshot(self, display_symbol: str, lookback_days: int = 365) -> dict[str, Any]:
        ticker = UNDERLYING.get(display_symbol, display_symbol.lstrip("r").upper())
        if not self.enabled:
            return {"connected": False, "ticker": ticker, "evidence": {}, "historical_stats": {}, "analogues": [], "errors": ["VIBE_MCP_URL is not configured"]}

        cache_key = f"{ticker}:{lookback_days}"
        cached = self._cache.get(cache_key)
        if cached and cached.expires_at > time.time():
            return cached.value

        end = date.today()
        start = end - timedelta(days=max(60, min(1095, lookback_days)))
        equity_code = f"{ticker}.US"
        benchmark_code = "QQQ.US"
        codes = [equity_code] if ticker == "QQQ" else [equity_code, benchmark_code]

        calls: list[tuple[str, dict[str, Any]]] = [
            ("get_market_data", {"codes": codes, "start_date": start.isoformat(), "end_date": end.isoformat(), "source": "auto", "interval": "1D", "max_rows": 800}),
            ("technical_indicators", {"symbol": ticker}),
            ("get_fundamentals", {"symbols": [ticker]}),
            ("get_stock_news", {"code": equity_code, "scope": "stock", "limit": 8}),
            ("get_sec_filings", {"ticker": ticker}),
            ("get_financial_statements", {"code": equity_code, "statement": "indicators", "period": "quarter", "offset": 0}),
        ]

        async def run(name: str, arguments: dict[str, Any]) -> tuple[str, Any, str | None]:
            try:
                value = await asyncio.wait_for(self._call(name, arguments), timeout=settings.mcp_timeout_seconds + 5)
                return name, value, None
            except Exception as exc:
                return name, None, str(exc)[:500]

        results = await asyncio.gather(*(run(name, arguments) for name, arguments in calls))
        raw: dict[str, Any] = {}
        evidence: dict[str, Any] = {}
        errors: list[str] = []
        for name, value, error in results:
            if error:
                errors.append(f"{name}: {error}")
                continue
            raw[name] = value
            evidence[name] = _clip(value)

        market_payload = raw.get("get_market_data")
        asset_records = _records(market_payload, equity_code)
        benchmark_records = asset_records if ticker == "QQQ" else _records(market_payload, benchmark_code)
        stats = _historical_stats(asset_records, benchmark_records) if asset_records else {}
        provenance = dict(_as_mapping(market_payload).get("_provenance") or {}) if market_payload else {}
        current_move = 0.0
        asset_returns = _pct_returns(_close_series(asset_records))
        if asset_returns:
            current_move = asset_returns[-1][1]
        analogues = _move_analogues(asset_records, current_move) if asset_records else []

        result = {
            "connected": bool(raw),
            "ticker": ticker,
            "evidence": evidence,
            "historical_stats": stats,
            "analogues": analogues,
            "provenance": provenance,
            "market_records": asset_records[-400:],
            "benchmark_records": benchmark_records[-400:],
            "errors": errors,
        }
        self._cache[cache_key] = _CacheItem(result, time.time() + 180)
        return result

    async def historical_context(self, display_symbol: str) -> dict[str, Any]:
        snapshot = await self.snapshot(display_symbol)
        return {
            "connected": snapshot["connected"],
            "ticker": snapshot["ticker"],
            "historical_stats": snapshot.get("historical_stats", {}),
            "analogues": snapshot.get("analogues", []),
            "technical": snapshot.get("evidence", {}).get("technical_indicators", ""),
            "provenance": snapshot.get("provenance", {}),
            "errors": snapshot.get("errors", []),
        }

    async def calibrations(self, display_symbols: list[str]) -> dict[str, dict[str, Any]]:
        unique = list(dict.fromkeys(display_symbols))[:8]
        snapshots = await asyncio.gather(*(self.snapshot(symbol) for symbol in unique))
        result: dict[str, dict[str, Any]] = {}
        for symbol, snapshot in zip(unique, snapshots):
            stats = snapshot.get("historical_stats") or {}
            if stats:
                result[symbol] = {
                    "beta_to_qqq": stats.get("beta_to_qqq"),
                    "correlation_to_qqq": stats.get("correlation_to_qqq"),
                    "annualized_volatility_pct": stats.get("annualized_volatility_pct"),
                    "observations": stats.get("observations", 0),
                    "provenance": snapshot.get("provenance", {}),
                }
        return result


vibe_research = VibeTradingResearch()
