from __future__ import annotations

from typing import Any


def playbook_config(twin: dict[str, Any]) -> dict[str, Any]:
    """Map a MarketTwin result to a copy-pasteable Bitget GetAgent Playbook block.

    Keeps AlphaArena paper-only: output is a monitoring/pause config suggestion,
    never an order. Field names mirror Playbook: Strategy, Pair, Amount, Frequency,
    Entry Condition, Pause Condition, Market Regime, Signal Confidence, Optimizer Reason.
    """
    shock = twin.get("shock") or {}
    impacts = twin.get("impacts") or []
    top = sorted(impacts, key=lambda r: abs(float(r.get("impact_pct") or 0)), reverse=True)[:3]
    pairs = [str(r.get("symbol")) for r in top]
    worst = min([float(r.get("impact_pct") or 0) for r in top], default=0.0)
    return {
        "Strategy": f"Stress-watch: {shock.get('driver', 'custom shock')} {shock.get('direction', '')} {shock.get('magnitude', '')}{shock.get('unit', '')}",
        "Pair": ", ".join(pairs) if pairs else "rNVDA",
        "Amount per Cycle": "Paper only in AlphaArena — set your Playbook paper size",
        "Frequency": str(twin.get("duration") or "24H"),
        "Entry Condition": f"Enter review when driver moves {shock.get('magnitude', '')}{shock.get('unit', '')} {shock.get('direction', '')}; most sensitive: {pairs[0] if pairs else 'rNVDA'}",
        "Pause Condition": f"Pause if realized stress exceeds worst estimated {worst:.2f}% or invalidation conditions trigger",
        "Market Regime": str(shock.get("category", "nasdaq")),
        "Signal Confidence": f"{twin.get('model_source', 'deterministic')} | calibrated={any(bool(r.get('calibrated')) for r in top)}",
        "Optimizer Reason": str((twin.get("explanation_view") or {}).get("impact_summary") or twin.get("explanation") or "")[:500],
        "Source": "AlphaArena MarketTwin (paper-only suggestion, not an order)",
    }
