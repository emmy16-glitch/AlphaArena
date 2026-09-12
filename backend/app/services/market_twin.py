from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.services.analytics import SCENARIO_BETAS, market_metrics, parse_shock, scenario_impact
from app.services.bitget import bitget_market
from app.services.qwen import QwenError, qwen
from app.services.signal import bitget_signal
from app.services.vibe import vibe_research


ASSET_NAMES = {
    "rNVDA": "Nvidia",
    "rTSLA": "Tesla",
    "rAAPL": "Apple",
    "rMSFT": "Microsoft",
    "rAMD": "AMD",
    "rQQQ": "the Nasdaq 100 tracker",
}

CHALLENGE_OPTIONS = [
    "The size of the market move",
    "The time horizon",
    "The estimated asset reaction",
    "The historical evidence",
    "The confidence level",
    "The assumption that historical relationships still apply",
    "I have company-specific information",
]


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


# Minimum ALIGNED (paired asset+QQQ) daily observations before MarketTwin may
# use measured Vibe beta. Exposed per impact as ``observations_minimum`` so the
# "Show your work" panel can state the gate truthfully.
CALIBRATION_MIN_OBSERVATIONS = 20


def _calibration_counts(calibration: dict[str, Any] | None) -> tuple[int | None, float | None, float | None, float | None]:
    """Return (paired_observations, beta, correlation, annualized_vol).

    Older cached calibrations only carry ``observations`` (close count), so fall
    back to it when ``paired_observations`` is absent.
    """
    if not calibration:
        return None, None, None, None
    paired = calibration.get("paired_observations")
    if not isinstance(paired, (int, float)):
        paired = calibration.get("observations")
    beta = calibration.get("beta_to_qqq")
    correlation = calibration.get("correlation_to_qqq")
    annual_vol = calibration.get("annualized_volatility_pct")
    return (
        int(paired) if isinstance(paired, (int, float)) else None,
        float(beta) if isinstance(beta, (int, float)) else None,
        float(correlation) if isinstance(correlation, (int, float)) else None,
        float(annual_vol) if isinstance(annual_vol, (int, float)) else None,
    )


def _prior_beta(symbol: str, category: str) -> float:
    return float(SCENARIO_BETAS.get(category, SCENARIO_BETAS["nasdaq"]).get(symbol, 1.0))


def _historical_impact(
    symbol: str,
    shock: dict[str, Any],
    severity: int,
    short_volatility_pct: float | None,
    calibration: dict[str, Any] | None,
) -> tuple[float, float, float, int, str, bool, dict[str, Any]]:
    """Use measured Vibe beta for Nasdaq shocks; assumption-based prior otherwise.

    Severity is applied exactly ONCE via the ``0.7 + severity/100*0.5`` scale
    multiplier (never inside magnitude derivation — see ``parse_shock``), so a
    "Nasdaq -5%" typed explicitly and the slider default agree at equal
    severity. Non-Nasdaq categories and Nasdaq shocks with fewer than
    ``CALIBRATION_MIN_OBSERVATIONS`` paired observations use the hand-set
    UNCALIBRATED ``SCENARIO_BETAS`` table, labelled "Assumption-based prior
    (uncalibrated)" with ``calibrated=False``.
    Returns ``(impact, lower, upper, confidence, model_label, calibrated, work)``
    where ``work`` exposes the intermediate inputs for the "Show your work"
    panel: beta used/source, paired observation count vs the gate, volatility
    inputs, severity scale and the fallback reason.
    """
    vol = float(short_volatility_pct) if isinstance(short_volatility_pct, (int, float)) else 0.0
    vol = max(0.0, vol)
    scale = 0.7 + severity / 100 * 0.5
    paired, beta, correlation, annual_vol = _calibration_counts(calibration)
    category = str(shock.get("category"))
    prior = _prior_beta(symbol, category)

    def work_dict(
        *,
        calibrated: bool,
        beta_used: float | None,
        beta_source: str,
        fallback_reason: str | None,
    ) -> dict[str, Any]:
        return {
            "beta_used": beta_used,
            "beta_source": beta_source,
            "prior_beta": prior,
            "correlation_to_qqq": correlation,
            "paired_observations": paired,
            "observations_minimum": CALIBRATION_MIN_OBSERVATIONS,
            "calibration_gate_passed": calibrated,
            "fallback_reason": fallback_reason,
            "short_volatility_pct": short_volatility_pct,
            "annualized_volatility_pct": annual_vol,
            "severity": severity,
            "severity_scale": round(scale, 4),
        }

    if category == "nasdaq" and calibration:
        observations = paired if paired is not None else 0
        if beta is not None and observations >= CALIBRATION_MIN_OBSERVATIONS:
            sign = -1.0 if shock.get("direction") == "down" else 1.0
            impact = beta * float(shock.get("magnitude") or 0) * sign * scale
            corr_abs = abs(correlation) if correlation is not None else 0.0
            uncertainty = max(0.8, abs(impact) * (0.42 - min(0.22, corr_abs * 0.22)) + vol * 0.35)
            confidence = int(max(45, min(88, 52 + min(20, observations / 12) + corr_abs * 18 - vol)))
            work = work_dict(calibrated=True, beta_used=beta, beta_source="measured", fallback_reason=None)
            return round(impact, 2), round(impact - uncertainty, 2), round(impact + uncertainty, 2), confidence, "Vibe-Trading measured beta", True, work
        reason = "vibe_unavailable" if paired is None else "fewer_than_20_paired_observations"
        impact, lower, upper, confidence = scenario_impact(symbol, shock, severity, vol)
        work = work_dict(calibrated=False, beta_used=None, beta_source="prior", fallback_reason=reason)
        return impact, lower, upper, confidence, "Assumption-based prior (uncalibrated)", False, work
    reason = "non_nasdaq_category_uses_prior" if category != "nasdaq" else "vibe_unavailable"
    impact, lower, upper, confidence = scenario_impact(symbol, shock, severity, vol)
    work = work_dict(calibrated=False, beta_used=None, beta_source="prior", fallback_reason=reason)
    return impact, lower, upper, confidence, "Assumption-based prior (uncalibrated)", False, work


def aggregate_portfolio_impact(legs: list[dict[str, Any]]) -> dict[str, Any]:
    """Stake-weighted portfolio aggregate over per-leg stress results.

    Each leg carries ``stake`` (virtual dollars) and side-adjusted
    ``impact_pct``/``lower_pct``/``upper_pct``. The aggregate sums leg dollar
    impacts without assuming any diversification benefit: bounds are the sum of
    leg bounds. ``impact_pct`` is the dollar total expressed against total
    stake. Pure function — unit-tested without network access.
    """
    total_stake = round(sum(float(leg.get("stake") or 0) for leg in legs), 2)
    dollars = round(sum(float(leg.get("stake") or 0) * float(leg.get("impact_pct") or 0) / 100 for leg in legs), 2)
    lower_dollars = round(sum(float(leg.get("stake") or 0) * float(leg.get("lower_pct") or 0) / 100 for leg in legs), 2)
    upper_dollars = round(sum(float(leg.get("stake") or 0) * float(leg.get("upper_pct") or 0) / 100 for leg in legs), 2)
    if total_stake > 0:
        impact_pct = round(dollars / total_stake * 100, 2)
        lower_pct = round(lower_dollars / total_stake * 100, 2)
        upper_pct = round(upper_dollars / total_stake * 100, 2)
    else:
        impact_pct = lower_pct = upper_pct = 0.0
    return {
        "total_stake": total_stake,
        "impact_dollars": dollars,
        "lower_dollars": lower_dollars,
        "upper_dollars": upper_dollars,
        "impact_pct": impact_pct,
        "lower_pct": lower_pct,
        "upper_pct": upper_pct,
        "legs": len(legs),
        "method": "stake-weighted sum of leg impacts; bounds assume no diversification benefit",
    }


def _apply_side(impact: float, lower: float, upper: float, side: str) -> tuple[float, float, float]:
    """Adjust an asset-level move for position direction.

    LONG rides the move; SHORT mirrors it (bounds swap on sign flip); WAIT has
    no exposure so all three are 0.
    """
    if side == "SHORT":
        return round(-impact, 2), round(-upper, 2), round(-lower, 2)
    if side == "WAIT":
        return 0.0, 0.0, 0.0
    return impact, lower, upper


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
            impact, lower, upper, confidence, model, calibrated, work = _historical_impact(
                asset["symbol"], shock, request.severity, metrics["realized_vol_pct"], calibrations.get(asset["symbol"]),
            )
            model_sources.add(model)
            impacts.append({
                "symbol": asset["symbol"],
                "asset_name": ASSET_NAMES.get(asset["symbol"], asset["symbol"]),
                "current_price": asset["price"],
                "impact_pct": impact,
                "lower_pct": lower,
                "upper_pct": upper,
                "confidence": confidence,
                "model": model,
                "calibrated": calibrated,
                "beta_to_qqq": (calibrations.get(asset["symbol"]) or {}).get("beta_to_qqq"),
                "beta_source": work["beta_source"],
                "prior_beta": work["prior_beta"],
                "correlation_to_qqq": work["correlation_to_qqq"],
                "paired_observations": work["paired_observations"],
                "observations_minimum": work["observations_minimum"],
                "calibration_gate_passed": work["calibration_gate_passed"],
                "fallback_reason": work["fallback_reason"],
                "short_volatility_pct": work["short_volatility_pct"],
                "annualized_volatility_pct": work["annualized_volatility_pct"],
                "severity_scale": work["severity_scale"],
            })

        default_explanation = (
            f"MarketTwin interpreted the prompt as a {shock['driver']} {shock['direction']} shock of {shock['magnitude']}{shock['unit']}. "
            "Where Vibe-Trading provides enough aligned U.S.-equity history (>= 20 observations), Nasdaq sensitivity uses measured historical beta; otherwise an assumption-based prior (uncalibrated) is used and labelled per asset. "
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
                "relevance": "The scenario remains an assumption-based sensitivity test; connect/retry Vibe-Trading to add historical comparison.",
            }]

        ordered_impacts = sorted(impacts, key=lambda item: abs(float(item["impact_pct"])), reverse=True)
        top_names = [str(item.get("asset_name") or item["symbol"]) for item in ordered_impacts[:3]]
        top_text = ", ".join(top_names[:-1]) + (f", and {top_names[-1]}" if len(top_names) > 1 else (top_names[0] if top_names else "the tracked assets"))
        average_confidence = round(sum(int(item["confidence"]) for item in impacts) / max(1, len(impacts)))
        confidence_label = "limited" if average_confidence < 40 else "mixed" if average_confidence < 60 else "fairly_strong" if average_confidence < 80 else "stronger"
        confidence_phrase = {
            "limited": "The evidence is limited.",
            "mixed": "The evidence is mixed, so uncertainty is substantial.",
            "fairly_strong": "The evidence is fairly strong, but it is not conclusive.",
            "stronger": "The evidence is relatively consistent, but it cannot predict a live event.",
        }[confidence_label]
        plain_summary = (
            f"If {shock['driver']} moved {shock['direction']} by {shock['magnitude']}{shock['unit']} over {request.duration}, "
            f"{top_text} show the largest estimated sensitivity in this simulation. {confidence_phrase}"
        )
        impact_summary = f"The largest simulated move is {ordered_impacts[0]['impact_pct']:+.2f}% for {top_names[0]}." if ordered_impacts else "No tracked asset impact was available."
        limitations = [
            "This is a hypothetical stress test, not a forecast or recommendation.",
            "Historical daily relationships can fail during company news, panic, reversals, or thin liquidity.",
            "The estimated range is a sensitivity bound, not a confidence interval or promised outcome.",
        ]

        if model_sources == {"Vibe-Trading measured beta"}:
            model_source = "Vibe-Trading historical calibration + AlphaArena stress engine"
        elif "Vibe-Trading measured beta" in model_sources:
            model_source = "Hybrid Vibe-Trading calibration + assumption-based priors (uncalibrated)"
        else:
            model_source = "Assumption-based priors (uncalibrated)"

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
                "qwen": "connected" if ai else "deterministic-fallback",
                "vibe": "connected" if vibe.get("connected") else ("unavailable" if vibe_research.enabled else "not-configured"),
                "signal": "connected" if signal.get("connected") else "unavailable",
            },
            "explanation_view": {
                "plain_summary": plain_summary,
                "impact_summary": impact_summary,
                "limitations": limitations,
                "confidence_label": confidence_label,
            },
            "historical_context": {
                "selection_basis": "current_observed_move",
                "data_frequency": "daily",
                "selection_disclaimer": "These daily observations were selected using the underlying asset's current observed move. They provide calibration context; they are not historical matches for this hypothetical scenario and they are not predictions.",
            },
            "transparency": {
                "calibration_minimum_observations": CALIBRATION_MIN_OBSERVATIONS,
                "selection_basis": "current_observed_move",
                "analogue_count": len(analogues),
                "analogue_note": (
                    "Analogues were selected mechanically: same-direction daily moves closest in size "
                    "to the underlying's current observed move. Each analogue reports the actually observed "
                    "next daily move as context only — not a prediction, and not a match for this scenario."
                ),
                "volatility_note": (
                    "Uncertainty bands widen with two volatility inputs: short-window realized volatility "
                    "from recent Bitget Reality prices (hourly bars) and, when Vibe-Trading history is available, "
                    "annualized historical volatility. Missing short-window data is treated as 0, not invented."
                ),
            },
            "assumptions": {
                "benchmark_move_pct": float(shock["magnitude"]) * (-1 if shock["direction"] == "down" else 1),
                "duration": request.duration,
                "sensitivity_method": "historical",
            },
            "challenge_options": CHALLENGE_OPTIONS,
        }

    async def simulate_portfolio(self, request: Any) -> dict[str, Any]:
        """Multi-position stress test over the SAME deterministic engine.

        Additive to :meth:`simulate` — the single-position path is untouched.
        Each position contributes its side-adjusted leg impact; the aggregate is
        a stake-weighted sum via :func:`aggregate_portfolio_impact`. Combined
        scenarios (e.g. "Nasdaq -5% AND rates +50bps") are out of scope for the
        parser: ``parse_shock`` reads one driver from the prompt, which the
        response states honestly via ``shock`` and ``assumptions``.
        """
        from app.services.bitget import BitgetError

        shock = parse_shock(request.prompt, request.severity)
        raw_positions = list(getattr(request, "positions", []) or [])[:8]
        if not raw_positions:
            raise BitgetError("Add at least one paper position before running a portfolio stress test.")

        symbols = [str(getattr(position, "symbol", "") or "") for position in raw_positions]
        asset_results = await asyncio.gather(*(bitget_market.get_asset(symbol) for symbol in symbols), return_exceptions=True)
        assets = [asset for asset in asset_results if isinstance(asset, dict)]
        if not assets:
            # Surface the first upstream failure instead of an empty result.
            failures = [result for result in asset_results if isinstance(result, Exception)]
            raise failures[0] if failures else BitgetError("No Bitget Reality market data is currently available.")
        by_symbol = {str(asset["symbol"]): asset for asset in assets}
        ordered = [(position, by_symbol.get(str(position.symbol))) for position in raw_positions]
        missing = sorted({str(position.symbol) for position, asset in ordered if asset is None})
        if missing:
            raise BitgetError(f"Live price unavailable for: {', '.join(missing)}. Nothing was recorded.")

        tracked = [symbol for symbol in by_symbol]
        calibrations: dict[str, dict[str, Any]] = {}
        if shock.get("category") == "nasdaq" and vibe_research.enabled:
            try:
                calibrations = await asyncio.wait_for(vibe_research.calibrations(tracked), timeout=8)
            except Exception:
                calibrations = {}

        legs: list[dict[str, Any]] = []
        model_sources: set[str] = set()
        for position, asset in ordered:
            assert asset is not None
            side = str(getattr(position, "side", "LONG") or "LONG").upper()
            stake = round(max(0.0, float(getattr(position, "stake", 0) or 0)), 2)
            metrics = market_metrics(asset)
            impact, lower, upper, confidence, model, calibrated, work = _historical_impact(
                str(asset["symbol"]), shock, request.severity, metrics["realized_vol_pct"], calibrations.get(str(asset["symbol"])),
            )
            model_sources.add(model)
            impact, lower, upper = _apply_side(impact, lower, upper, side)
            legs.append({
                "symbol": str(asset["symbol"]),
                "asset_name": ASSET_NAMES.get(str(asset["symbol"]), str(asset["symbol"])),
                "side": side,
                "stake": stake,
                "current_price": asset["price"],
                "impact_pct": impact,
                "lower_pct": lower,
                "upper_pct": upper,
                "impact_dollars": round(stake * impact / 100, 2),
                "lower_dollars": round(stake * lower / 100, 2),
                "upper_dollars": round(stake * upper / 100, 2),
                "confidence": confidence,
                "model": model,
                "calibrated": calibrated,
                "beta_to_qqq": (calibrations.get(str(asset["symbol"])) or {}).get("beta_to_qqq"),
                "beta_source": work["beta_source"],
                "prior_beta": work["prior_beta"],
                "correlation_to_qqq": work["correlation_to_qqq"],
                "paired_observations": work["paired_observations"],
                "observations_minimum": work["observations_minimum"],
                "calibration_gate_passed": work["calibration_gate_passed"],
                "fallback_reason": work["fallback_reason"],
                "short_volatility_pct": work["short_volatility_pct"],
                "annualized_volatility_pct": work["annualized_volatility_pct"],
                "severity_scale": work["severity_scale"],
            })

        aggregate = aggregate_portfolio_impact(legs)
        if model_sources == {"Vibe-Trading measured beta"}:
            model_source = "Vibe-Trading historical calibration + AlphaArena stress engine"
        elif "Vibe-Trading measured beta" in model_sources:
            model_source = "Hybrid Vibe-Trading calibration + assumption-based priors (uncalibrated)"
        else:
            model_source = "Assumption-based priors (uncalibrated)"

        return {
            "id": f"pf_{uuid4().hex[:12]}",
            "prompt": request.prompt,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "duration": request.duration,
            "shock": shock,
            "legs": legs,
            "aggregate": aggregate,
            "model_source": model_source,
            "sources": {
                "market": "bitget-live",
                "vibe": "connected" if any(leg.get("calibrated") for leg in legs) else ("unavailable" if vibe_research.enabled else "not-configured"),
                "signal": "unavailable",
                "qwen": "deterministic-fallback",
            },
            "transparency": {
                "calibration_minimum_observations": CALIBRATION_MIN_OBSERVATIONS,
                "aggregate_method": aggregate["method"],
                "side_note": "SHORT legs mirror the asset move; WAIT legs carry no exposure.",
                "volatility_note": (
                    "Each leg's uncertainty band widens with short-window realized volatility "
                    "from recent Bitget Reality prices; missing short-window data is treated as 0, not invented."
                ),
            },
            "assumptions": {
                "benchmark_move_pct": float(shock["magnitude"]) * (-1 if shock["direction"] == "down" else 1),
                "duration": request.duration,
                "sensitivity_method": "historical",
                "single_driver_note": "One scenario driver is parsed from the prompt; combined multi-driver shocks are not modelled.",
            },
            "disclaimer": "Hypothetical stress estimates, not forecasts or recommendations. Paper only.",
        }


market_twin = MarketTwinService()
