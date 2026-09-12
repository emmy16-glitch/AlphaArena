from __future__ import annotations

import statistics
from typing import Any

from app.services.analytics import max_drawdown_pct, returns_pct
from app.services.bitget import bitget_market


def backtest_metrics(prices: list[float], starting: float = 100_000.0) -> dict[str, Any]:
    """Deterministic buy-and-hold backtest on a price series.

    Returns return_pct, max_drawdown_pct, sharpe_like, win_rate (up-bar %),
    num_bars. Pure function so judges can reproduce it from committed samples.
    Code is the report: see backend/scripts/generate_backtest_report.py.
    """
    clean = [float(p) for p in prices if p is not None and float(p) > 0]
    if len(clean) < 2:
        return {
            "num_bars": len(clean),
            "return_pct": 0.0,
            "max_drawdown_pct": 0.0,
            "sharpe_like": 0.0,
            "win_rate": 0.0,
            "method": "buy-and-hold on provided closes; no lookahead",
        }
    rets = returns_pct(clean)
    total = (clean[-1] / clean[0] - 1) * 100
    dd = max_drawdown_pct(clean)
    sharpe = round(statistics.mean(rets) / (statistics.stdev(rets) or 1.0), 4) if len(rets) >= 2 else 0.0
    wins = sum(1 for r in rets if r > 0)
    return {
        "num_bars": len(clean),
        "return_pct": round(total, 4),
        "max_drawdown_pct": round(dd, 4),
        "sharpe_like": sharpe,
        "win_rate": round(wins / len(rets) * 100, 2) if rets else 0.0,
        "method": "buy-and-hold on provided closes; no lookahead",
    }


async def backtest_symbol(symbol: str) -> dict[str, Any]:
    asset = await bitget_market.get_asset(symbol)
    spark = [float(v) for v in asset.get("spark") or [] if v]
    metrics = backtest_metrics(spark)
    return {
        "symbol": symbol,
        "exchange_symbol": asset.get("exchangeSymbol"),
        "entry_price": asset.get("price"),
        "prices_used": len(spark),
        "frequency": "hourly closes (last ~24, Bitget Reality candles)",
        "metrics": metrics,
        "code": "backend/app/services/backtest.py::backtest_metrics + backend/scripts/generate_backtest_report.py",
        "disclaimer": "Historical replay is context, not a prediction of future returns.",
    }
