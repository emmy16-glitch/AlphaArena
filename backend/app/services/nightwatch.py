from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.services.analytics import market_metrics, resilience_score, scenario_impact
from app.services.bitget import bitget_market
from app.services.qwen import QwenError, qwen
from app.services.signal import bitget_signal
from app.services.vibe import vibe_research


SYSTEM_PROMPT = """You are NightWatch, the adversarial decision-stress engine inside AlphaArena.
You do NOT give financial advice and you do NOT place trades. The human decides.
You receive a user's trade thesis plus live Bitget Reality market data, deterministic risk metrics,
Vibe-Trading U.S.-equity research when available, and Bitget Signal macro/news context when available.
Challenge the thesis from opposing angles and return ONLY valid JSON.
Never invent a price, filing, headline, historical event, probability, statistic, or source not present in evidence.
Treat Vibe-Trading mechanically-selected analogues as observations, never predictions.
If evidence is missing, say so. Prefer falsifiable invalidation conditions.
Required keys: headline, summary, verdict (LONG|SHORT|WAIT), supports, objections,
invalidation_conditions, analogues, agents. supports/objections are arrays of objects with title, detail,
source, strength (low|medium|high). analogues are objects with label,outcome,relevance. agents are objects
with role,stance (support|oppose|neutral),confidence (0-100),summary,evidence (array of strings).
Include roles: Bull, Bear, Risk, Historical, Evidence Skeptic, Chief Critic.
"""


def _safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _evidence_items(items: Any, fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for item in _safe_list(items):
        if not isinstance(item, dict):
            continue
        detail = str(item.get("detail") or "").strip()[:700]
        if not detail:
            continue
        strength = str(item.get("strength") or "medium").lower()
        if strength not in {"low", "medium", "high"}:
            strength = "medium"
        cleaned.append({
            "title": str(item.get("title") or "Evidence")[:120],
            "detail": detail,
            "source": str(item.get("source") or "analysis")[:100],
            "strength": strength,
        })
    return cleaned[:6] or fallback


def _agents(items: Any, fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for item in _safe_list(items):
        if not isinstance(item, dict):
            continue
        stance = str(item.get("stance") or "neutral").lower()
        if stance not in {"support", "oppose", "neutral"}:
            stance = "neutral"
        try:
            confidence = max(0, min(100, int(item.get("confidence", 60))))
        except (TypeError, ValueError):
            confidence = 60
        cleaned.append({
            "role": str(item.get("role") or "Analyst")[:80],
            "stance": stance,
            "confidence": confidence,
            "summary": str(item.get("summary") or "Evidence is mixed.")[:500],
            "evidence": [str(x)[:260] for x in _safe_list(item.get("evidence"))[:5]],
        })
    return cleaned[:8] or fallback


def _vibe_evidence(vibe: dict[str, Any], current_change: float) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, str]]]:
    if not vibe.get("connected"):
        return [], [], []
    stats = vibe.get("historical_stats") if isinstance(vibe.get("historical_stats"), dict) else {}
    supports: list[dict[str, Any]] = []
    objections: list[dict[str, Any]] = []
    momentum = stats.get("momentum_20d_pct")
    beta = stats.get("beta_to_qqq")
    corr = stats.get("correlation_to_qqq")
    vol = stats.get("annualized_volatility_pct")
    worst = stats.get("daily_return_worst_decile_pct")

    if isinstance(momentum, (int, float)):
        item = {
            "title": "Underlying 20-day momentum",
            "detail": f"Vibe-Trading history measures the underlying's 20-day momentum at {float(momentum):+.2f}% across {int(stats.get('observations') or 0)} observations.",
            "source": "Vibe-Trading historical market data",
            "strength": "medium",
        }
        if current_change == 0 or float(momentum) * current_change >= 0:
            supports.append(item)
        else:
            objections.append(item)
    if isinstance(beta, (int, float)) and isinstance(corr, (int, float)):
        objections.append({
            "title": "Nasdaq co-movement is measurable",
            "detail": f"Historical beta to QQQ is {float(beta):.2f} with correlation {float(corr):.2f}; a broad-index reversal can therefore challenge a single-name narrative.",
            "source": "Vibe-Trading historical calibration",
            "strength": "high" if abs(float(corr)) >= 0.6 else "medium",
        })
    if isinstance(vol, (int, float)) and isinstance(worst, (int, float)):
        objections.append({
            "title": "Historical tail movement matters",
            "detail": f"Vibe-Trading measures annualized historical volatility near {float(vol):.1f}% and a daily-return 10th percentile of {float(worst):+.2f}% over the retrieved sample.",
            "source": "Vibe-Trading historical market data",
            "strength": "medium",
        })
    analogues = [
        {
            "label": str(item.get("label") or "")[:180],
            "outcome": str(item.get("outcome") or "")[:420],
            "relevance": str(item.get("relevance") or "")[:420],
        }
        for item in _safe_list(vibe.get("analogues"))[:5]
        if isinstance(item, dict) and item.get("label")
    ]
    return supports, objections, analogues


class NightWatchService:
    async def _external_context(self, symbol: str) -> tuple[dict[str, Any], dict[str, Any]]:
        async def vibe_task() -> dict[str, Any]:
            try:
                return await asyncio.wait_for(vibe_research.snapshot(symbol), timeout=30)
            except Exception as exc:
                return {"connected": False, "evidence": {}, "errors": [str(exc)]}

        async def signal_task() -> dict[str, Any]:
            try:
                return await asyncio.wait_for(bitget_signal.snapshot(symbol), timeout=15)
            except Exception as exc:
                return {"connected": False, "evidence": {}, "errors": [str(exc)]}

        vibe, signal = await asyncio.gather(vibe_task(), signal_task())
        return vibe, signal

    async def analyze(self, request: Any) -> dict[str, Any]:
        asset = await bitget_market.get_asset(request.symbol)
        metrics = market_metrics(asset)
        resilience, confidence, risk_level = resilience_score(asset, request.direction, request.risk_pct)
        vibe, signal = await self._external_context(request.symbol)

        change = metrics["change_pct"]
        direction_aligned = (request.direction == "LONG" and change > 0) or (request.direction == "SHORT" and change < 0)
        support_fallback: list[dict[str, Any]] = [
            {
                "title": "Live tape aligns with the thesis" if direction_aligned else "The live tape is measurable",
                "detail": f"Bitget Reality shows {request.symbol} at {asset['price']:.2f}, {change:+.2f}% over 24h. Short-window momentum is {metrics['momentum_pct']:+.2f}%.",
                "source": "Bitget Reality market data",
                "strength": "medium" if direction_aligned else "low",
            },
            {
                "title": "The claim is falsifiable",
                "detail": f"The user supplied a {request.holding_period} {request.direction} thesis with {request.risk_pct:.1f}% risk allocation, allowing explicit failure conditions.",
                "source": "User thesis",
                "strength": "medium",
            },
        ]
        objection_fallback: list[dict[str, Any]] = [
            {
                "title": "Volatility can overwhelm the narrative",
                "detail": f"The Bitget candle sample implies {metrics['realized_vol_pct']:.2f}% short-window realised volatility and a {metrics['range_pct']:.2f}% 24h high-low range.",
                "source": "AlphaArena deterministic risk engine",
                "strength": "high" if metrics["realized_vol_pct"] > 3 else "medium",
            },
            {
                "title": "Narrative and price can diverge",
                "detail": "A compelling story is not evidence that price must continue in the same direction. A sustained reversal against the stated direction is treated as falsification evidence.",
                "source": "NightWatch risk policy",
                "strength": "medium",
            },
        ]
        vibe_support, vibe_objections, vibe_analogues = _vibe_evidence(vibe, change)
        support_fallback.extend(vibe_support)
        objection_fallback.extend(vibe_objections)

        nasdaq_shock = {"driver": "Nasdaq 100", "category": "nasdaq", "magnitude": 5.0, "unit": "%", "direction": "down"}
        macro_impact, _, _, _ = scenario_impact(request.symbol, nasdaq_shock, 70, metrics["realized_vol_pct"])
        liquidity_shock = {"driver": "Liquidity shock", "category": "liquidity", "magnitude": 6.0, "unit": "severity", "direction": "down"}
        liquidity_impact, _, _, _ = scenario_impact(request.symbol, liquidity_shock, 65, metrics["realized_vol_pct"])
        gap_impact = -max(1.0, metrics["realized_vol_pct"] * 1.8)
        stress = [
            {"name": "Nasdaq -5%", "impact_pct": macro_impact, "detail": "Cross-asset sensitivity stress; not a forecast."},
            {"name": "Liquidity deterioration", "impact_pct": liquidity_impact, "detail": "Tests thinner off-hours liquidity and wider execution uncertainty."},
            {"name": "Adverse gap", "impact_pct": round(gap_impact, 2), "detail": "Sizes an adverse gap from the current short-window realised-volatility sample."},
        ]

        historical_summary = "No verified historical series was retrieved."
        stats = vibe.get("historical_stats") if isinstance(vibe.get("historical_stats"), dict) else {}
        if stats:
            historical_summary = f"Vibe-Trading supplied {int(stats.get('observations') or 0)} underlying observations with historical risk and QQQ calibration."
        base_agents = [
            {"role": "Bull", "stance": "support", "confidence": min(85, 52 + int(max(change, 0) * 4)), "summary": "Builds the strongest evidence-based version of the user's thesis.", "evidence": [support_fallback[0]["detail"]]},
            {"role": "Bear", "stance": "oppose", "confidence": min(88, 58 + int(abs(change) * 2)), "summary": "Looks for reversal, crowding and already-priced-in risk.", "evidence": [objection_fallback[1]["detail"]]},
            {"role": "Risk", "stance": "oppose", "confidence": 78, "summary": "Focuses on volatility, gap risk, spread and position sizing rather than the story.", "evidence": [objection_fallback[0]["detail"]]},
            {"role": "Historical", "stance": "neutral", "confidence": 76 if stats else 45, "summary": historical_summary, "evidence": [vibe_analogues[0]["outcome"]] if vibe_analogues else [historical_summary]},
            {"role": "Evidence Skeptic", "stance": "neutral", "confidence": 86, "summary": "Rejects unsupported headlines, stale claims and invented statistics.", "evidence": ["Only retrieved, user-supplied or deterministic evidence may enter the verdict."]},
            {"role": "Chief Critic", "stance": "neutral", "confidence": confidence, "summary": "Weighs evidence quality instead of counting agent votes.", "evidence": [f"Deterministic resilience score: {resilience}/100."]},
        ]

        ai: dict[str, Any] | None = None
        if qwen.enabled:
            try:
                ai = await qwen.complete_json(system=SYSTEM_PROMPT, payload={
                    "trade": request.model_dump(),
                    "bitget_market": asset,
                    "deterministic_metrics": metrics,
                    "deterministic_resilience": resilience,
                    "stress_scenarios": stress,
                    "vibe_trading": vibe,
                    "bitget_signal": signal,
                })
            except QwenError:
                ai = None

        fallback_verdict = request.direction if resilience >= 75 and request.direction in {"LONG", "SHORT"} else "WAIT"
        verdict = str((ai or {}).get("verdict") or fallback_verdict).upper()
        if verdict not in {"LONG", "SHORT", "WAIT"}:
            verdict = "WAIT"
        headline = str((ai or {}).get("headline") or ("Thesis survives the first stress test." if resilience >= 75 else "Wait for stronger confirmation." if resilience >= 52 else "The thesis is fragile under stress."))[:180]
        summary = str((ai or {}).get("summary") or f"NightWatch scores this {request.direction} thesis {resilience}/100 using live Bitget Reality data, deterministic risk tests, and {'retrieved Vibe-Trading history' if stats else 'no verified historical series yet'}. Unsupported claims are withheld.")[:1200]

        ai_analogues = []
        for item in _safe_list((ai or {}).get("analogues"))[:5]:
            if isinstance(item, dict) and item.get("label"):
                ai_analogues.append({"label": str(item.get("label"))[:180], "outcome": str(item.get("outcome") or "")[:420], "relevance": str(item.get("relevance") or "")[:420]})
        analogues = vibe_analogues or ai_analogues
        if not analogues:
            analogues = [{
                "label": "No verified analogue available",
                "outcome": "NightWatch withholds a historical outcome instead of inventing one.",
                "relevance": "Connect/retry Vibe-Trading to ground this section in retrieved U.S.-equity history.",
            }]

        invalidations = [str(x)[:300] for x in _safe_list((ai or {}).get("invalidation_conditions"))[:6] if str(x).strip()]
        if not invalidations:
            invalidations = [
                "The live price structure reverses against the stated direction instead of confirming it.",
                f"The position requires more than {request.risk_pct:.1f}% portfolio risk to remain viable.",
                "A newly verified catalyst materially contradicts the original thesis.",
            ]

        return {
            "id": f"nw_{uuid4().hex[:12]}",
            "symbol": request.symbol,
            "direction": request.direction,
            "thesis": request.thesis,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "resilience": resilience,
            "confidence": confidence,
            "risk_level": risk_level,
            "verdict": verdict,
            "headline": headline,
            "summary": summary,
            "supports": _evidence_items((ai or {}).get("supports"), support_fallback),
            "objections": _evidence_items((ai or {}).get("objections"), objection_fallback),
            "analogues": analogues,
            "stress_scenarios": stress,
            "invalidation_conditions": invalidations,
            "agents": _agents((ai or {}).get("agents"), base_agents),
            "sources": {
                "market": "bitget-live",
                "qwen": "connected" if ai else ("configured-error" if qwen.enabled else "deterministic-fallback"),
                "vibe": "connected" if vibe.get("connected") else ("unavailable" if vibe_research.enabled else "not-configured"),
                "signal": "connected" if signal.get("connected") else "unavailable",
            },
        }


nightwatch = NightWatchService()
