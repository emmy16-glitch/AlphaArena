from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.services.analytics import market_metrics, parse_shock, scenario_impact
from app.services.bitget import bitget_market
from app.services.qwen import QwenError, qwen
from app.services.signal import bitget_signal
from app.services.vibe import vibe_research


TWIN_SYSTEM_PROMPT = """You are MarketTwin's scenario explainer inside AlphaArena.
The numerical impacts were already calculated by a deterministic model. Do not change or invent those numbers.
Explain the causal chain and identify what evidence would make the scenario less or more relevant.
If Vibe-Trading historical evidence is absent, do not invent historical events or probabilities.
Return ONLY JSON with keys: explanation and analogues. analogues is an array of objects
{label,outcome,relevance}; it may be empty when the supplied evidence does not verify a useful analogue.
This is scenario analysis, not a forecast or financial advice.
"""


class MarketTwinService:
    async def simulate(self, request: Any) -> dict[str, Any]:
        shock = parse_shock(request.prompt, request.severity)
        assets: list[dict[str, Any]] = []
        for symbol in request.symbols[:8]:
            try:
                assets.append(await bitget_market.get_asset(symbol))
            except Exception:
                continue
        if not assets:
            assets = await bitget_market.get_assets()

        impacts: list[dict[str, Any]] = []
        for asset in assets:
            metrics = market_metrics(asset)
            impact, lower, upper, confidence = scenario_impact(asset["symbol"], shock, request.severity, metrics["realized_vol_pct"])
            impacts.append({
                "symbol": asset["symbol"],
                "current_price": asset["price"],
                "impact_pct": impact,
                "lower_pct": lower,
                "upper_pct": upper,
                "confidence": confidence,
            })

        # Pull the richest historical context for the first selected equity, but
        # fail open so a public-data outage never makes MarketTwin unusable.
        async def vibe_context() -> dict[str, Any]:
            try:
                return await asyncio.wait_for(vibe_research.historical_context(assets[0]["symbol"]), timeout=16)
            except Exception as exc:
                return {"connected": False, "errors": [str(exc)]}

        async def macro_context() -> dict[str, Any]:
            try:
                return await asyncio.wait_for(bitget_signal.snapshot(assets[0]["symbol"]), timeout=10)
            except Exception as exc:
                return {"connected": False, "errors": [str(exc)]}

        vibe, signal = await asyncio.gather(vibe_context(), macro_context())
        default_explanation = (
            f"MarketTwin interpreted the prompt as a {shock['driver']} {shock['direction']} shock of {shock['magnitude']}{shock['unit']}. "
            "The displayed ranges come from AlphaArena's transparent cross-asset sensitivity model, widened by each asset's current realised-volatility sample. "
            "They are stress estimates, not predicted returns."
        )
        analogues: list[dict[str, str]] = []
        explanation = default_explanation
        ai: dict[str, Any] | None = None
        if qwen.enabled:
            try:
                ai = await qwen.complete_json(
                    system=TWIN_SYSTEM_PROMPT,
                    payload={
                        "scenario": request.model_dump(),
                        "parsed_shock": shock,
                        "calculated_impacts": impacts,
                        "vibe_history": vibe,
                        "bitget_signal": signal,
                    },
                )
            except QwenError:
                ai = None
        if ai and isinstance(ai.get("explanation"), str):
            explanation = ai["explanation"][:1400]
        for item in (ai or {}).get("analogues", []) if isinstance((ai or {}).get("analogues", []), list) else []:
            if isinstance(item, dict) and item.get("label"):
                analogues.append({
                    "label": str(item.get("label"))[:180],
                    "outcome": str(item.get("outcome") or "")[:420],
                    "relevance": str(item.get("relevance") or "")[:420],
                })
        if not analogues:
            analogues = [{
                "label": "Historical analogue layer",
                "outcome": "No verified historical analogue is shown until Vibe-Trading returns evidence for this scenario.",
                "relevance": "The stress ranges above remain usable as transparent sensitivity tests without pretending they are historical forecasts.",
            }]

        return {
            "id": f"twin_{uuid4().hex[:12]}",
            "prompt": request.prompt,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "duration": request.duration,
            "shock": shock,
            "impacts": impacts,
            "explanation": explanation,
            "analogues": analogues,
            "model_source": "AlphaArena cross-asset sensitivity model v1",
            "sources": {
                "market": "bitget-live",
                "qwen": "connected" if ai else ("configured-error" if qwen.enabled else "deterministic-fallback"),
                "vibe": "connected" if vibe.get("connected") else "not-configured",
                "signal": "connected" if signal.get("connected") else "unavailable",
            },
        }


market_twin = MarketTwinService()
