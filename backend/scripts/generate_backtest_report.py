"""Generate a reproducible backtest report from committed or live prices.

Usage:
    python backend/scripts/generate_backtest_report.py --symbol rNVDA --out samples/backtest-rNVDA.json
    python backend/scripts/generate_backtest_report.py --prices 100,101,99,102 --out /tmp/report.json

Live mode fetches Bitget Reality hourly closes via the app service; offline mode
uses the provided CSV prices so judges can reproduce without network.
Code is the report: backend/app/services/backtest.py::backtest_metrics.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.backtest import backtest_metrics  # noqa: E402


async def live_prices(symbol: str) -> list[float]:
    from app.services.bitget import bitget_market

    asset = await bitget_market.get_asset(symbol)
    return [float(v) for v in asset.get("spark") or [] if v]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", default="rNVDA")
    parser.add_argument("--prices", default="")
    parser.add_argument("--out", default="samples/backtest.json")
    args = parser.parse_args()

    if args.prices:
        prices = [float(x) for x in args.prices.split(",") if x.strip()]
        source = "offline-provided closes"
    else:
        prices = asyncio.run(live_prices(args.symbol))
        source = "bitget-reality hourly closes via app.services.bitget"
    report = {
        "symbol": args.symbol,
        "source": source,
        "num_prices": len(prices),
        "metrics": backtest_metrics(prices),
        "code": "backend/app/services/backtest.py::backtest_metrics",
        "disclaimer": "Historical replay is context, not a prediction.",
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
