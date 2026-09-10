from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings


DISPLAY_TICKERS = {
    "rNVDA": "NVDA",
    "rTSLA": "TSLA",
    "rAAPL": "AAPL",
    "rMSFT": "MSFT",
    "rAMD": "AMD",
    "rQQQ": "QQQ",
}


class BitgetError(RuntimeError):
    pass


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
        return result if result == result else default
    except (TypeError, ValueError):
        return default


def _format_volume(value: float) -> str:
    if value >= 1_000_000_000:
        return f"{value / 1_000_000_000:.1f}B"
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"{value / 1_000:.1f}K"
    return f"{value:.0f}"


@dataclass
class CacheEntry:
    value: Any
    expires_at: float


class BitgetMarketClient:
    def __init__(self) -> None:
        self._cache: dict[str, CacheEntry] = {}

    async def _get(self, path: str, params: dict[str, str]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(base_url=settings.bitget_base_url, timeout=12.0, follow_redirects=True) as client:
                response = await client.get(path, params=params)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise BitgetError(f"Bitget market request failed: {exc}") from exc
        if not isinstance(payload, dict) or payload.get("code") != "00000":
            message = payload.get("msg") if isinstance(payload, dict) else "invalid response"
            raise BitgetError(str(message or "Bitget API request failed"))
        return payload

    async def get_reality_instruments(self) -> list[dict[str, Any]]:
        now = time.time()
        cached = self._cache.get("__reality_instruments__")
        if cached and cached.expires_at > now:
            return cached.value
        payload = await self._get("/api/v3/market/instruments", {"category": "SPOT"})
        rows = payload.get("data") or []
        instruments = [row for row in rows if isinstance(row, dict) and str(row.get("isReality", "")).lower() == "yes"]
        self._cache["__reality_instruments__"] = CacheEntry(instruments, now + 300)
        return instruments

    async def _exchange_symbol(self, display_symbol: str) -> str:
        ticker = DISPLAY_TICKERS.get(display_symbol)
        if ticker is None:
            raise BitgetError(f"Unsupported AlphaArena symbol: {display_symbol}")
        desired = f"R{ticker}USDT".upper()
        try:
            instruments = await self.get_reality_instruments()
            for instrument in instruments:
                symbol = str(instrument.get("symbol") or "")
                if symbol.upper() == desired:
                    return symbol
        except BitgetError:
            # Ticker/candle endpoints may still work when instrument discovery is
            # temporarily unavailable; use the documented Reality convention.
            pass
        return f"r{ticker}USDT"

    async def get_asset(self, display_symbol: str) -> dict[str, Any]:
        if display_symbol not in DISPLAY_TICKERS:
            raise BitgetError(f"Unsupported AlphaArena symbol: {display_symbol}")

        now = time.time()
        cached = self._cache.get(display_symbol)
        if cached and cached.expires_at > now:
            return cached.value

        exchange_symbol = await self._exchange_symbol(display_symbol)
        ticker_task = self._get("/api/v3/market/tickers", {"category": "SPOT", "symbol": exchange_symbol})
        candle_task = self._get(
            "/api/v3/market/candles",
            {"category": "SPOT", "symbol": exchange_symbol, "interval": "1H", "limit": "24", "type": "market"},
        )
        ticker_payload, candle_payload = await asyncio.gather(ticker_task, candle_task, return_exceptions=True)

        if isinstance(ticker_payload, Exception):
            raise BitgetError(f"Ticker unavailable for {display_symbol}: {ticker_payload}") from ticker_payload

        rows = ticker_payload.get("data") or []
        if not rows or not isinstance(rows[0], dict):
            raise BitgetError(f"Bitget returned no ticker for {exchange_symbol}")
        ticker = rows[0]

        last = _to_float(ticker.get("lastPrice"))
        if last <= 0:
            raise BitgetError(f"Bitget returned an invalid last price for {exchange_symbol}")
        open_24 = _to_float(ticker.get("openPrice24h"), last)
        change_pct = _to_float(ticker.get("price24hPcnt")) * 100
        change_abs = last - open_24
        bid = _to_float(ticker.get("bid1Price"))
        ask = _to_float(ticker.get("ask1Price"))
        midpoint = (bid + ask) / 2 if bid > 0 and ask > 0 else 0.0
        spread_bps = ((ask - bid) / midpoint * 10_000) if midpoint > 0 and ask >= bid else 0.0

        spark: list[float] = []
        if not isinstance(candle_payload, Exception):
            candles = candle_payload.get("data") or []
            try:
                parsed = sorted((row for row in candles if isinstance(row, list) and len(row) >= 5), key=lambda row: int(row[0]))
                spark = [_to_float(row[4]) for row in parsed if _to_float(row[4]) > 0]
            except (TypeError, ValueError):
                spark = []
        if not spark:
            spark = [open_24 or last, last]

        result = {
            "symbol": display_symbol,
            "exchangeSymbol": exchange_symbol,
            "price": last,
            "changePct": change_pct,
            "changeAbs": change_abs,
            "volume": _format_volume(_to_float(ticker.get("volume24h"))),
            "turnover24h": _to_float(ticker.get("turnover24h")),
            "platformTurnover24h": _to_float(ticker.get("platformTurnover24h")),
            "high24": _to_float(ticker.get("highPrice24h"), last),
            "low24": _to_float(ticker.get("lowPrice24h"), last),
            "bid": bid or None,
            "ask": ask or None,
            "spreadBps": round(spread_bps, 3),
            "spark": spark,
            "timestamp": int(_to_float(ticker.get("ts"), time.time() * 1000)),
            "source": "bitget",
            "isReality": True,
        }
        self._cache[display_symbol] = CacheEntry(value=result, expires_at=now + settings.market_cache_seconds)
        return result

    async def get_assets(self) -> list[dict[str, Any]]:
        results = await asyncio.gather(*(self.get_asset(symbol) for symbol in DISPLAY_TICKERS), return_exceptions=True)
        assets = [result for result in results if isinstance(result, dict)]
        if not assets:
            raise BitgetError("No Bitget Reality market data is currently available. Reality market-data access can depend on Bitget account/whitelist availability.")
        return assets


bitget_market = BitgetMarketClient()
