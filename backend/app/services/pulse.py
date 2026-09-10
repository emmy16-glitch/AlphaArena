from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services.analytics import market_metrics
from app.services.bitget import bitget_market


def _severity(score: int) -> str:
    if score >= 72:
        return "elevated"
    if score >= 48:
        return "watch"
    return "info"


class PulseService:
    async def events(self) -> list[dict[str, Any]]:
        assets = await bitget_market.get_assets()
        now = datetime.now(timezone.utc).isoformat()
        events: list[dict[str, Any]] = []
        for asset in assets:
            metrics = market_metrics(asset)
            change = metrics["change_pct"]
            range_pct = metrics["range_pct"]
            vol = metrics["realized_vol_pct"]
            score = int(min(96, 24 + abs(change) * 8 + range_pct * 3 + vol * 2))
            direction = "higher" if change >= 0 else "lower"
            if abs(change) >= 3:
                title = f"{asset['symbol']} is moving unusually {direction}"
                summary = (
                    f"Bitget Reality is showing a {change:+.2f}% 24h move. "
                    f"The 24h range is {range_pct:.2f}% and short-window realised volatility is {vol:.2f}%. "
                    "NightWatch flags it for thesis review before a virtual position is opened."
                )
                tags = ["Price anomaly", "Volatility"]
            elif range_pct >= 3.5:
                title = f"{asset['symbol']} range is widening"
                summary = (
                    f"Price is only {change:+.2f}% over 24h, but the high-low range has expanded to {range_pct:.2f}%. "
                    "That can matter more than the headline return when a trade depends on a tight invalidation level."
                )
                tags = ["Range", "Risk"]
            else:
                title = f"{asset['symbol']} tape is relatively calm"
                summary = (
                    f"Bitget Reality shows {change:+.2f}% over 24h with a {range_pct:.2f}% range. "
                    "No large price anomaly is visible from the current public market snapshot."
                )
                tags = ["Market state"]
            events.append({
                "id": f"pulse-{asset['symbol']}",
                "symbol": asset["symbol"],
                "severity": _severity(score),
                "title": title,
                "summary": summary,
                "score": score,
                "price": asset["price"],
                "change_pct": change,
                "tags": tags,
                "detected_at": now,
            })
        events.sort(key=lambda item: item["score"], reverse=True)
        return events


pulse_service = PulseService()
