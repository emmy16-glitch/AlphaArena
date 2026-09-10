from __future__ import annotations

import math
import re
import statistics
from typing import Any


def returns_pct(values: list[float]) -> list[float]:
    clean = [float(v) for v in values if v is not None and float(v) > 0]
    return [((b / a) - 1) * 100 for a, b in zip(clean, clean[1:]) if a > 0]


def realized_volatility_pct(values: list[float]) -> float:
    """Short-window realised volatility over the supplied sample, in percent."""
    returns = returns_pct(values)
    if len(returns) < 2:
        return 0.0
    return statistics.pstdev(returns) * math.sqrt(max(1, len(returns)))


def momentum_pct(values: list[float]) -> float:
    clean = [float(v) for v in values if v is not None and float(v) > 0]
    if len(clean) < 2:
        return 0.0
    return ((clean[-1] / clean[0]) - 1) * 100


def max_drawdown_pct(values: list[float]) -> float:
    clean = [float(v) for v in values if v is not None and float(v) > 0]
    if not clean:
        return 0.0
    peak = clean[0]
    worst = 0.0
    for value in clean:
        peak = max(peak, value)
        drawdown = ((value / peak) - 1) * 100
        worst = min(worst, drawdown)
    return worst


def market_metrics(asset: dict[str, Any]) -> dict[str, float]:
    price = float(asset.get("price") or 0)
    high = float(asset.get("high24") or price)
    low = float(asset.get("low24") or price)
    spark = [float(v) for v in asset.get("spark") or [] if v is not None]
    range_pct = ((high - low) / price * 100) if price else 0.0
    return {
        "change_pct": float(asset.get("changePct") or 0),
        "momentum_pct": momentum_pct(spark),
        "realized_vol_pct": realized_volatility_pct(spark),
        "drawdown_pct": max_drawdown_pct(spark),
        "range_pct": max(0.0, range_pct),
    }


def resilience_score(asset: dict[str, Any], direction: str, risk_pct: float) -> tuple[int, int, str]:
    m = market_metrics(asset)
    change = m["change_pct"]
    momentum = m["momentum_pct"]
    volatility = m["realized_vol_pct"]
    range_pct = m["range_pct"]

    score = 64.0
    if direction == "LONG":
        score += max(-12, min(12, change * 1.6))
        score += max(-8, min(8, momentum * 1.2))
        if change > 6:
            score -= min(15, (change - 6) * 2.0)
    elif direction == "SHORT":
        score += max(-12, min(12, -change * 1.6))
        score += max(-8, min(8, -momentum * 1.2))
        if change < -6:
            score -= min(15, (abs(change) - 6) * 2.0)
    else:
        score = 72 - min(18, abs(change) * 1.5)

    score -= min(16, volatility * 1.4)
    score -= min(10, max(0, range_pct - 2) * 1.2)
    score -= min(10, max(0, risk_pct - 2) * 1.3)
    score = int(round(max(5, min(95, score))))

    sample_count = len(asset.get("spark") or [])
    confidence = int(round(max(45, min(92, 58 + sample_count * 1.2 - volatility))))
    risk = "LOW" if score >= 75 else "MEDIUM" if score >= 58 else "HIGH" if score >= 40 else "EXTREME"
    return score, confidence, risk


SCENARIO_BETAS: dict[str, dict[str, float]] = {
    "nasdaq": {"rNVDA": 1.55, "rTSLA": 1.42, "rAAPL": 0.86, "rMSFT": 1.02, "rAMD": 1.62, "rQQQ": 1.00},
    "btc": {"rNVDA": 0.28, "rTSLA": 0.36, "rAAPL": 0.14, "rMSFT": 0.18, "rAMD": 0.30, "rQQQ": 0.20},
    # Percentage-point impact per basis point when yields RISE. These values are
    # negative for long-duration growth equities; a yield fall flips the sign.
    "yields": {"rNVDA": -0.085, "rTSLA": -0.095, "rAAPL": -0.045, "rMSFT": -0.055, "rAMD": -0.080, "rQQQ": -0.060},
    "policy": {"rNVDA": -0.85, "rTSLA": -0.35, "rAAPL": -0.24, "rMSFT": -0.38, "rAMD": -0.78, "rQQQ": -0.32},
    "liquidity": {"rNVDA": -0.35, "rTSLA": -0.48, "rAAPL": -0.18, "rMSFT": -0.20, "rAMD": -0.42, "rQQQ": -0.18},
    "earnings": {"rNVDA": -1.00, "rTSLA": -0.18, "rAAPL": -0.12, "rMSFT": -0.15, "rAMD": -0.38, "rQQQ": -0.16},
}


def parse_shock(prompt: str, severity: int) -> dict[str, Any]:
    text = prompt.lower()
    percent = re.search(r"([+-]?\d+(?:\.\d+)?)\s*%", text)
    bps = re.search(r"([+-]?\d+(?:\.\d+)?)\s*(?:bp|bps|basis points?)", text)
    down_words = any(word in text for word in ("fall", "falls", "fell", "drop", "drops", "down", "crash", "miss", "restriction", "ban", "freeze", "cut"))
    up_words = any(word in text for word in ("rise", "rises", "rose", "up", "spike", "hike", "surge", "jump"))

    if "nasdaq" in text or "qqq" in text or "ndx" in text:
        magnitude = abs(float(percent.group(1))) if percent else max(1.0, severity / 12)
        return {"driver": "Nasdaq 100", "category": "nasdaq", "magnitude": magnitude, "unit": "%", "direction": "down" if down_words or not up_words else "up"}
    if "yield" in text or "treasury" in text or "rate" in text:
        magnitude = abs(float(bps.group(1))) if bps else max(10.0, severity * 0.75)
        return {"driver": "Treasury yields", "category": "yields", "magnitude": magnitude, "unit": "bp", "direction": "down" if down_words and not up_words else "up"}
    if "btc" in text or "bitcoin" in text:
        magnitude = abs(float(percent.group(1))) if percent else max(3.0, severity / 4)
        return {"driver": "Bitcoin", "category": "btc", "magnitude": magnitude, "unit": "%", "direction": "down" if down_words or not up_words else "up"}
    if "earnings" in text or "guidance" in text:
        magnitude = abs(float(percent.group(1))) if percent else max(3.0, severity / 8)
        return {"driver": "Earnings surprise", "category": "earnings", "magnitude": magnitude, "unit": "%", "direction": "down" if down_words or "miss" in text else "up"}
    if "regulation" in text or "export" in text or "policy" in text or "ban" in text:
        magnitude = max(2.0, severity / 10)
        return {"driver": "Policy shock", "category": "policy", "magnitude": magnitude, "unit": "severity", "direction": "down" if down_words or not up_words else "up"}
    if "liquidity" in text or "spread" in text or "order book" in text:
        magnitude = max(2.0, severity / 10)
        return {"driver": "Liquidity shock", "category": "liquidity", "magnitude": magnitude, "unit": "severity", "direction": "down" if not up_words else "up"}
    magnitude = abs(float(percent.group(1))) if percent else max(2.0, severity / 12)
    return {"driver": "Custom market shock", "category": "nasdaq", "magnitude": magnitude, "unit": "%", "direction": "down" if down_words or not up_words else "up"}


def scenario_impact(symbol: str, shock: dict[str, Any], severity: int, volatility_pct: float = 0.0) -> tuple[float, float, float, int]:
    category = str(shock["category"])
    beta = SCENARIO_BETAS.get(category, SCENARIO_BETAS["nasdaq"]).get(symbol, 1.0)
    magnitude = max(0.0, float(shock["magnitude"]))
    direction_sign = -1.0 if shock["direction"] == "down" else 1.0

    if category == "yields":
        # beta is defined for a rise in yields, so a fall must invert it.
        impact = beta * magnitude * (1.0 if shock["direction"] == "up" else -1.0)
    elif category in {"policy", "liquidity", "earnings"}:
        # Coefficients encode the normal adverse/down shock direction.
        impact = beta * magnitude * (1.0 if shock["direction"] == "down" else -1.0)
    else:
        impact = beta * magnitude * direction_sign

    impact *= 0.7 + (severity / 100) * 0.5
    band = max(0.8, abs(impact) * 0.28 + max(0.0, volatility_pct) * 0.35)
    confidence = int(max(45, min(82, 76 - max(0.0, volatility_pct) * 2 - abs(impact) * 0.5)))
    return round(impact, 2), round(impact - band, 2), round(impact + band, 2), confidence
