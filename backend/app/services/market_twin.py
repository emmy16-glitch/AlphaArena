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


TWIN_SYSTEM_PROMPT = """You are MarketTwin's scenario explainer. Do not give financial advice.
The supplied impact numbers were calculated by deterministic code: never change or invent them.
Use only supplied evidence and treat historical analogues as observations, not forecasts.
Return exactly one concise JSON object with no markdown: explanation (under 500 characters) and analogues
(at most 3 objects with label, outcome, relevance). If history is missing, return an empty analogue list."""


def _model_signal_context(signal: dict[str, Any]) -> dict[str, Any]:
    evidence = signal.get("evidence") if isinstance(signal.get("evidence"), dict) else {}
    return {
        "connected": bool(signal.get("connected")),
        "evidence": {str(key): str(value)[:900] for key, value in list(evidence.items())[:4]},
        "errors": signal.get("errors", [])[:5],
    }


def _historical_impact(
    symbol: str,
    shock: dict[str, Any],
    severity: int,
    short_volatility_pct: float,
    calibration: dict[str, Any] | None,
) -> tuple[float, float, float, int, str]:
    """Use measured Vibe beta for Nasdaq shocks; transparent priors otherwise."""
    if shock.get("category") == "nasdaq" and calibration:
        beta = calibration.get("beta_to_qqq")
        correlation = calibration.get("correlation_to_qqq")
        observations = int(calibration.get("observations") or 0)
        if isinstance(beta, (int, float)) and observations >= 20:
            sign = -1.0 if shock.get("direction") == "down" else 1.0
            scale = 0.7 + severity / 100 * 0.5
            impact = float(beta) * float(shock.get("magnitude") or 0) * sign * scale
            corr_abs = abs(float(correlation)) if isinstance(correlation, (int, float)) else 0.0
            uncertainty = max(0.8, abs(impact) * (0.42 - min(0.22, corr_abs * 0.22)) + short_volatility_pct * 0.35)
            confidence = int(max(45, min(88, 52 + min(20, observations / 12) + corr_abs * 18 - short_volatility_pct)))
            return round(impact, 2), round(impact - uncertainty, 2), round(impact + uncertainty, 2), confidence, "Vibe-Trading measured beta"
    impact, lower, upper, confidence = scenario_impact(symbol, shock, severity, short_volatility_pct)
    return impact, lower, upper, confidence, "AlphaArena transparent prior"


class MarketTwinService:
    async def simulate(self, request: Any) -> dict[str, Any]:
        shock = parse_shock(request.prompt, request.severity)
        requested_symbols = list(dict.fromkeys(request.symbols))[:8]

        asset_results = await asyncio.gather(*(bitget_market.get_asset(symbol) for symbol in requested_symbols), return_exceptions=True)
        assets = [asset for asset in asset_results if isinstance(asset, dict)]
        if not assets:
            assets = await bitget_market.get_assets()
        symbols = [asset["symbol"] for asset in assets]

        async def get_calibrations() -> dict[str, dict[str, Any]]:
            if shock.get("category") != "nasdaq" or not vibe_research.enabled:
                return {}
            try:
                return await asyncio.wait_for(vibe_research.calibrations(symbols), timeout=8)
            except Exception:
                return {}

        async def get_vibe_context() -> dict[str, Any]:
            try:
                return await asyncio.wait_for(vibe_research.historical_context(assets[0]["symbol"]), timeout=8)
            except Exception as exc:
                return {"connected": False, "errors": [str(exc)]}

        async def get_macro_context() -> dict[str, Any]:
            try:
                return await asyncio.wait_for(bitget_signal.snapshot(assets[0]["symbol"]), timeout=4)
            except Exception as exc:
                return {"connected": False, "errors": [str(exc)]}

        calibrations, vibe, signal = await asyncio.gather(get_calibrations(), get_vibe_context(), get_macro_context())

        impacts: list[dict[str, Any]] = []
        model_sources: set[str] = set()
        for asset in assets:
            metrics = market_metrics(asset)
            impact, lower, upper, confidence, model = _historical_impact(
                asset["symbol"], shock, request.severity, metrics["realized_vol_pct"], calibrations.get(asset["symbol"]),
            )
            model_sources.add(model)
            impacts.append({
                "symbol": asset["symbol"],
                "current_price": asset["price"],
                "impact_pct": impact,
                "lower_pct": lower,
                "upper_pct": upper,
                "confidence": confidence,
                "model": model,
                "beta_to_qqq": (calibrations.get(asset["symbol"]) or {}).get("beta_to_qqq"),
            })

        default_explanation = (
            f"MarketTwin interpreted the prompt as a {shock['driver']} {shock['direction']} shock of {shock['magnitude']}{shock['unit']}. "
            "Where Vibe-Trading provides enough aligned U.S.-equity history, Nasdaq sensitivity uses measured historical beta; otherwise AlphaArena uses a documented fallback sensitivity. "
            "Uncertainty bands widen with current Bitget Reality volatility. These are stress estimates, not predicted returns."
        )

        deterministic_analogues = vibe.get("analogues") if isinstance(vibe.get("analogues"), list) else []
        analogues = [item for item in deterministic_analogues[:5] if isinstance(item, dict)]
        explanation = default_explanation
        ai: dict[str, Any] | None = None
        if qwen.enabled:
            try:
                ai = await qwen.complete_json(
                    system=TWIN_SYSTEM_PROMPT,
                    # Twin's response is a short explanation; default effort
                    # avoids spending the free-tier token window on hidden
                    # chain-of-thought while keeping the answer grounded.
                    reasoning_effort="default",
                    max_output_tokens=1200,
                    payload={
                        "scenario": request.model_dump(),
                        "parsed_shock": shock,
                        "calculated_impacts": impacts,
                        "vibe_history": vibe,
                        "bitget_signal": _model_signal_context(signal),
                    },
                )
            except QwenError:
                ai = None
        if ai and isinstance(ai.get("explanation"), str):
            explanation = ai["explanation"][:1400]
        if ai and not analogues:
            raw_analogues = ai.get("analogues") if isinstance(ai.get("analogues"), list) else []
            for item in raw_analogues[:5]:
                if isinstance(item, dict) and item.get("label"):
                    analogues.append({
                        "label": str(item.get("label"))[:180],
                        "outcome": str(item.get("outcome") or "")[:420],
                        "relevance": str(item.get("relevance") or "")[:420],
                    })
        if not analogues:
            analogues = [{
                "label": "No verified historical analogue available",
                "outcome": "MarketTwin withholds an analogue rather than fabricating one.",
                "relevance": "The scenario remains a transparent sensitivity test; connect/retry Vibe-Trading to add historical comparison.",
            }]

        if model_sources == {"Vibe-Trading measured beta"}:
            model_source = "Vibe-Trading historical calibration + AlphaArena stress engine"
        elif "Vibe-Trading measured beta" in model_sources:
            model_source = "Hybrid Vibe-Trading calibration + AlphaArena transparent priors"
        else:
            model_source = "AlphaArena transparent sensitivity priors"

        return {
            "id": f"twin_{uuid4().hex[:12]}",
            "prompt": request.prompt,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "duration": request.duration,
            "shock": shock,
            "impacts": impacts,
            "explanation": explanation,
            "analogues": analogues,
            "model_source": model_source,
            "sources": {
                "market": "bitget-live",
                "qwen": "connected" if ai else ("configured-error" if qwen.enabled else "deterministic-fallback"),
                "vibe": "connected" if vibe.get("connected") else ("unavailable" if vibe_research.enabled else "not-configured"),
                "signal": "connected" if signal.get("connected") else "unavailable",
            },
        }


market_twin = MarketTwinService()
