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
optional Vibe-Trading U.S.-equity research, and optional Bitget Signal macro/news context.
Your job is to challenge the thesis from opposing angles and return ONLY valid JSON.
Never invent a price, filing, headline, historical event, probability, or statistic that is not in the evidence.
If evidence is missing, say it is missing. Prefer falsifiable invalidation conditions.
Required JSON keys: headline, summary, verdict (LONG|SHORT|WAIT), supports, objections,
invalidation_conditions, analogues, agents. supports/objections are arrays of objects with title, detail,
source, strength (low|medium|high). analogues are objects with label,outcome,relevance. agents are objects
with role,stance (support|oppose|neutral),confidence (0-100),summary,evidence (array of strings).
Include these roles: Bull, Bear, Risk, Historical, Evidence Skeptic, Chief Critic.
"""


def _safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _evidence_items(items: Any, fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for item in _safe_list(items):
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "Evidence")[:120]
        detail = str(item.get("detail") or "")[:700]
        if not detail:
            continue
        strength = str(item.get("strength") or "medium").lower()
        if strength not in {"low", "medium", "high"}:
            strength = "medium"
        cleaned.append({"title": title, "detail": detail, "source": str(item.get("source") or "analysis")[:80], "strength": strength})
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
            confidence = int(item.get("confidence", 60))
        except (TypeError, ValueError):
            confidence = 60
        cleaned.append({
            "role": str(item.get("role") or "Analyst")[:80],
            "stance": stance,
            "confidence": max(0, min(100, confidence)),
            "summary": str(item.get("summary") or "Evidence is mixed.")[:500],
            "evidence": [str(x)[:260] for x in _safe_list(item.get("evidence"))[:5]],
        })
    return cleaned[:8] or fallback


class NightWatchService:
    async def _external_context(self, symbol: str) -> tuple[dict[str, Any], dict[str, Any]]:
        async def vibe() -> dict[str, Any]:
            try:
                return await asyncio.wait_for(vibe_research.snapshot(symbol), timeout=18)
            except Exception as exc:
                return {"connected": False, "evidence": {}, "errors": [str(exc)]}

        async def signal() -> dict[str, Any]:
            try:
                return await asyncio.wait_for(bitget_signal.snapshot(symbol), timeout=12)
            except Exception as exc:
                return {"connected": False, "evidence": {}, "errors": [str(exc)]}

        return tuple(await asyncio.gather(vibe(), signal()))  # type: ignore[return-value]

    async def analyze(self, request: Any) -> dict[str, Any]:
        asset = await bitget_market.get_asset(request.symbol)
        metrics = market_metrics(asset)
        resilience, confidence, risk_level = resilience_score(asset, request.direction, request.risk_pct)
        vibe, signal = await self._external_context(request.symbol)

        change = metrics["change_pct"]
        direction_aligned = (request.direction == "LONG" and change > 0) or (request.direction == "SHORT" and change < 0)
        support_fallback = [
            {
                "title": "Live tape aligns with the thesis" if direction_aligned else "There is still measurable market structure",
                "detail": f"Bitget Reality shows {request.symbol} at {asset['price']:.2f}, {change:+.2f}% over 24h. Short-window momentum is {metrics['momentum_pct']:+.2f}%.",
                "source": "Bitget Reality market data",
                "strength": "medium" if direction_aligned else "low",
            },
            {
                "title": "The thesis is explicit and testable",
                "detail": f"The user supplied a {request.holding_period} {request.direction} thesis with {request.risk_pct:.1f}% risk allocation, so NightWatch can define conditions that would invalidate it.",
                "source": "User thesis",
                "strength": "medium",
            },
        ]
        objection_fallback = [
            {
                "title": "Volatility can overwhelm the narrative",
                "detail": f"The current candle sample implies {metrics['realized_vol_pct']:.2f}% short-window realised volatility and a {metrics['range_pct']:.2f}% 24h high-low range.",
                "source": "AlphaArena deterministic risk engine",
                "strength": "high" if metrics["realized_vol_pct"] > 3 else "medium",
            },
            {
                "title": "Direction and price action may diverge",
                "detail": "A compelling story is not sufficient evidence that the tokenized price will continue in the same direction. NightWatch treats a reversal in the current price structure as a falsification signal.",
                "source": "NightWatch risk policy",
                "strength": "medium",
            },
        ]

        adverse_nasdaq = {"driver": "Nasdaq 100", "category": "nasdaq", "magnitude": 5.0, "unit": "%", "direction": "down"}
        macro_impact, _, _, _ = scenario_impact(request.symbol, adverse_nasdaq, 70, metrics["realized_vol_pct"])
        liquidity_shock = {"driver": "Liquidity shock", "category": "liquidity", "magnitude": 6.0, "unit": "severity", "direction": "down"}
        liquidity_impact, _, _, _ = scenario_impact(request.symbol, liquidity_shock, 65, metrics["realized_vol_pct"])
        gap_impact = -max(1.0, metrics["realized_vol_pct"] * 1.8)
        stress = [
            {"name": "Nasdaq -5%", "impact_pct": macro_impact, "detail": "Cross-asset sensitivity stress, not a forecast."},
            {"name": "Liquidity deterioration", "impact_pct": liquidity_impact, "detail": "Tests thinner off-hours liquidity and wider execution uncertainty."},
            {"name": "Adverse gap", "impact_pct": round(gap_impact, 2), "detail": "Uses the current realised-volatility sample to size an adverse gap stress."},
        ]

        base_agents = [
            {"role": "Bull", "stance": "support", "confidence": min(85, 52 + int(max(change, 0) * 4)), "summary": "Tests the strongest version of the user's thesis against the live tape.", "evidence": [support_fallback[0]["detail"]]},
            {"role": "Bear", "stance": "oppose", "confidence": min(88, 58 + int(abs(change) * 2)), "summary": "Looks for crowding, reversal and already-priced-in risk.", "evidence": [objection_fallback[1]["detail"]]},
            {"role": "Risk", "stance": "oppose", "confidence": 78, "summary": "Focuses on volatility, gap risk and position sizing rather than the story.", "evidence": [objection_fallback[0]["detail"]]},
            {"role": "Historical", "stance": "neutral", "confidence": 55 if not vibe.get("connected") else 76, "summary": "Historical research is richer when the Vibe-Trading MCP sidecar is connected.", "evidence": ["Vibe-Trading connected." if vibe.get("connected") else "Vibe-Trading not configured yet; no historical event claim is fabricated."]},
            {"role": "Evidence Skeptic", "stance": "neutral", "confidence": 82, "summary": "Rejects unsupported headlines, stale claims and invented statistics.", "evidence": ["Only retrieved or deterministic evidence is allowed into the final report."]},
            {"role": "Chief Critic", "stance": "neutral", "confidence": confidence, "summary": "Weighs evidence quality rather than counting agent votes.", "evidence": [f"Deterministic resilience score: {resilience}/100."]},
        ]

        qwen_payload = {
            "trade": request.model_dump(),
            "bitget_market": asset,
            "deterministic_metrics": metrics,
            "deterministic_resilience": resilience,
            "stress_scenarios": stress,
            "vibe_trading": vibe,
            "bitget_signal": signal,
        }
        ai: dict[str, Any] | None = None
        if qwen.enabled:
            try:
                ai = await qwen.complete_json(system=SYSTEM_PROMPT, payload=qwen_payload)
            except QwenError:
                ai = None

        verdict = str((ai or {}).get("verdict") or ("LONG" if resilience >= 75 and request.direction == "LONG" else "SHORT" if resilience >= 75 and request.direction == "SHORT" else "WAIT")).upper()
        if verdict not in {"LONG", "SHORT", "WAIT"}:
            verdict = "WAIT"
        headline = str((ai or {}).get("headline") or ("Thesis is resilient." if resilience >= 75 else "Wait for stronger confirmation." if resilience >= 52 else "The thesis is fragile under stress."))[:180]
        summary = str((ai or {}).get("summary") or f"NightWatch scores this {request.direction} thesis {resilience}/100 using the live Bitget Reality tape and deterministic risk metrics. External research is {'connected' if vibe.get('connected') else 'not yet connected'}, so unsupported historical claims are withheld.")[:1200]

        analogues: list[dict[str, str]] = []
        for item in _safe_list((ai or {}).get("analogues"))[:5]:
            if isinstance(item, dict) and item.get("label"):
                analogues.append({"label": str(item.get("label"))[:160], "outcome": str(item.get("outcome") or "")[:360], "relevance": str(item.get("relevance") or "")[:360]})
        if not analogues:
            analogues = [{
                "label": "Historical analogue search pending" if not vibe.get("connected") else "Vibe-Trading evidence retrieved",
                "outcome": "No historical outcome is invented when the research adapter cannot provide a verified analogue.",
                "relevance": "Connect the Vibe-Trading MCP sidecar to ground this section in retrieved U.S.-equity history.",
            }]

        invalidations = [str(x)[:300] for x in _safe_list((ai or {}).get("invalidation_conditions"))[:6] if str(x).strip()]
        if not invalidations:
            invalidations = [
                "The live price structure reverses against the stated direction instead of confirming it.",
                f"The position requires more than {request.risk_pct:.1f}% portfolio risk to remain viable.",
                "A new verified catalyst materially contradicts the original thesis.",
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
                "vibe": "connected" if vibe.get("connected") else "not-configured",
                "signal": "connected" if signal.get("connected") else "unavailable",
            },
        }


nightwatch = NightWatchService()
