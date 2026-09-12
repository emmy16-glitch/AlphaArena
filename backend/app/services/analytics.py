from __future__ import annotations

import re
import statistics
from typing import Any


def returns_pct(values: list[float]) -> list[float]:
    clean = [float(v) for v in values if v is not None and float(v) > 0]
    return [((b / a) - 1) * 100 for a, b in zip(clean, clean[1:]) if a > 0]


def realized_volatility_pct(values: list[float]) -> float:
    """Per-period sample volatility of simple % returns, in percentage points.

    Formula: ``statistics.stdev(returns_pct(values))`` where returns are simple
    period-over-period percent changes ``((b / a) - 1) * 100``. Uses the *sample*
    standard deviation (Bessel's correction, ddof=1), which requires
    ``len(returns) >= 2`` (i.e. >= 3 prices); otherwise returns 0.0 so callers
    can treat it as "insufficient data".

    Units: percent per input bar (hourly when fed ~24 hourly closes). This is
    NOT annualized and NOT scaled by sqrt(N): scaling by ``sqrt(len(returns))``
    would make the metric grow with sample size. To annualize hourly bars,
    multiply by ``sqrt(24 * 365)`` at the call site and label it as such.
    """
    returns = returns_pct(values)
    if len(returns) < 2:
        return 0.0
    return statistics.stdev(returns)


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


def market_metrics(asset: dict[str, Any]) -> dict[str, float | None]:
    """Per-asset tape metrics. Keys preserved for API/frontend compat.

    ``momentum_pct``, ``realized_vol_pct`` (per-bar sample stdev, see
    :func:`realized_volatility_pct`) and ``drawdown_pct`` are ``None`` when
    ``spark`` has fewer than 5 real points ("insufficient data") instead of a
    fabricated number. ``hourly_vol_pct`` is an alias of ``realized_vol_pct``
    with an honest unit-bearing name. ``change_pct``/``range_pct`` come from
    the 24h ticker and are always numeric.
    """
    price = float(asset.get("price") or 0)
    high = float(asset.get("high24") or price)
    low = float(asset.get("low24") or price)
    spark = [float(v) for v in asset.get("spark") or [] if v is not None]
    range_pct = ((high - low) / price * 100) if price else 0.0
    if len(spark) < 5:
        momentum: float | None = None
        realized: float | None = None
        drawdown: float | None = None
    else:
        momentum = momentum_pct(spark)
        realized = realized_volatility_pct(spark)
        drawdown = max_drawdown_pct(spark)
    return {
        "change_pct": float(asset.get("changePct") or 0),
        "momentum_pct": momentum,
        "realized_vol_pct": realized,
        "hourly_vol_pct": realized,
        "drawdown_pct": drawdown,
        "range_pct": max(0.0, range_pct),
    }


def resilience_score(asset: dict[str, Any], direction: str, risk_pct: float) -> tuple[int, int, str]:
    """Heuristic 5–95 pressure-tolerance score (NOT a calibrated probability).

    Starts from heuristic baselines (64.0 directional / 72.0 WAIT) with capped
    linear adjustments for 24h change, short-window momentum, per-bar
    volatility, 24h range and requested risk %. Weights are hand-chosen
    heuristics, not fitted or calibrated values. Missing tape metrics
    (``None`` = insufficient spark data) contribute 0 adjustment and lower
    confidence instead of inventing a number.
    """
    m = market_metrics(asset)
    change = float(m["change_pct"] or 0)
    momentum = float(m["momentum_pct"]) if m["momentum_pct"] is not None else 0.0
    volatility = float(m["realized_vol_pct"]) if m["realized_vol_pct"] is not None else 0.0
    has_tape = m["momentum_pct"] is not None
    range_pct = float(m["range_pct"] or 0)

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
    if not has_tape:
        # No measured tape: admit it via lower confidence instead of a number.
        confidence = int(round(max(45, min(92, confidence - 12))))
    risk = "LOW" if score >= 75 else "MEDIUM" if score >= 58 else "HIGH" if score >= 40 else "EXTREME"
    return score, confidence, risk


# Hand-set, UNCALIBRATED sensitivity assumptions — not measured calibration.
# Displayed to users as "Assumption-based prior (uncalibrated)" with
# ``calibrated: false`` per asset (see market_twin._historical_impact).
# The only measured path is Vibe-Trading beta_to_qqq with >= 20 observations.
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
    """Parse a shock's magnitude ONLY from the prompt text.

    Severity (the 10–100 slider) NEVER enters ``magnitude`` here: when the
    prompt names an explicit number (``5%``, ``40bp``) it is used verbatim,
    otherwise a fixed prompt-independent default applies (Nasdaq 5%,
    yields 40bp, BTC 8%, earnings 5%, policy/liquidity/custom 5 severity
    units). Severity scales the impact exactly once, inside
    :func:`scenario_impact` (and the measured-beta path in
    ``market_twin._historical_impact``), so "Nasdaq -5%" typed explicitly and
    the slider default produce the same number at equal severity.
    """
    text = prompt.lower()
    percent = re.search(r"([+-]?\d+(?:\.\d+)?)\s*%", text)
    bps = re.search(r"([+-]?\d+(?:\.\d+)?)\s*(?:bp|bps|basis points?)", text)
    down_words = any(word in text for word in ("fall", "falls", "fell", "drop", "drops", "down", "crash", "miss", "restriction", "ban", "freeze", "cut"))
    up_words = any(word in text for word in ("rise", "rises", "rose", "up", "spike", "hike", "surge", "jump"))

    if "nasdaq" in text or "qqq" in text or "ndx" in text:
        magnitude = abs(float(percent.group(1))) if percent else 5.0
        return {"driver": "Nasdaq 100", "category": "nasdaq", "magnitude": magnitude, "unit": "%", "direction": "down" if down_words or not up_words else "up"}
    if "yield" in text or "treasury" in text or "rate" in text:
        magnitude = abs(float(bps.group(1))) if bps else 40.0
        return {"driver": "Treasury yields", "category": "yields", "magnitude": magnitude, "unit": "bp", "direction": "down" if down_words and not up_words else "up"}
    if "btc" in text or "bitcoin" in text:
        magnitude = abs(float(percent.group(1))) if percent else 8.0
        return {"driver": "Bitcoin", "category": "btc", "magnitude": magnitude, "unit": "%", "direction": "down" if down_words or not up_words else "up"}
    if "earnings" in text or "guidance" in text:
        magnitude = abs(float(percent.group(1))) if percent else 5.0
        return {"driver": "Earnings surprise", "category": "earnings", "magnitude": magnitude, "unit": "%", "direction": "down" if down_words or "miss" in text else "up"}
    if "regulation" in text or "export" in text or "policy" in text or "ban" in text:
        magnitude = abs(float(percent.group(1))) if percent else 5.0
        return {"driver": "Policy shock", "category": "policy", "magnitude": magnitude, "unit": "severity", "direction": "down" if down_words or not up_words else "up"}
    if "liquidity" in text or "spread" in text or "order book" in text:
        magnitude = abs(float(percent.group(1))) if percent else 5.0
        return {"driver": "Liquidity shock", "category": "liquidity", "magnitude": magnitude, "unit": "severity", "direction": "down" if not up_words else "up"}
    magnitude = abs(float(percent.group(1))) if percent else 5.0
    return {"driver": "Custom market shock", "category": "nasdaq", "magnitude": magnitude, "unit": "%", "direction": "down" if down_words or not up_words else "up"}


def scenario_impact(symbol: str, shock: dict[str, Any], severity: int, volatility_pct: float | None = 0.0) -> tuple[float, float, float, int]:
    """Deterministic sensitivity estimate using UNCALIBRATED prior betas.

    ``impact = beta * magnitude * direction_sign * (0.7 + severity/100*0.5)``
    where ``beta`` comes from the hand-set ``SCENARIO_BETAS`` table
    (assumption-based prior, ``calibrated: false`` — see
    ``market_twin._historical_impact`` for the measured-beta alternative).
    Severity is applied exactly ONCE here via the scale multiplier; it is
    intentionally absent from :func:`parse_shock` magnitude derivation.
    ``volatility_pct`` (per-bar hourly vol, ``None`` treated as 0) only widens
    the uncertainty band and lowers confidence; it never changes the sign.
    Returns ``(impact_pct, lower_pct, upper_pct, confidence)`` — tuple shape
    preserved for callers/tests.
    """
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
    vol = float(volatility_pct) if volatility_pct is not None else 0.0
    vol = max(0.0, vol)
    band = max(0.8, abs(impact) * 0.28 + vol * 0.35)
    confidence = int(max(45, min(82, 76 - vol * 2 - abs(impact) * 0.5)))
    return round(impact, 2), round(impact - band, 2), round(impact + band, 2), confidence
