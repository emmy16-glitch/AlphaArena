from __future__ import annotations

from typing import Any

#: Settled decisive battles below this count never produce a score.
#: The endpoint returns `insufficient_data: True` with null scores instead.
MIN_SETTLED_BATTLES = 5

#: Bucket edges (inclusive lower, exclusive upper except the last) for the
#: calibration curve, in stated-confidence percentage points.
BUCKETS: list[tuple[int, int]] = [(50, 60), (60, 70), (70, 80), (80, 90), (90, 101)]


def _is_decisive(battle: dict[str, Any]) -> bool:
    return battle.get("status") == "settled" and str(battle.get("user_side")) != "WAIT"


def _is_win(battle: dict[str, Any]) -> bool:
    return _is_decisive(battle) and float(battle.get("user_pnl_pct") or 0) > 0


def _stated_probability(battle: dict[str, Any]) -> float | None:
    raw = battle.get("stated_confidence")
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if value != value:  # NaN guard
        return None
    return max(0.0, min(1.0, value / 100))


def brier_score(probabilities: list[float], outcomes: list[int]) -> float:
    """Mean squared error between stated probabilities and 0/1 outcomes.

    Lower is better: 0.0 is perfect, 0.25 is a constant 50% forecast.
    """
    if not probabilities or len(probabilities) != len(outcomes):
        raise ValueError("probabilities and outcomes must be non-empty and aligned")
    return round(sum((p - o) ** 2 for p, o in zip(probabilities, outcomes)) / len(probabilities), 4)


def win_rate(battles: list[dict[str, Any]]) -> float:
    decisive = [b for b in battles if _is_decisive(b)]
    if not decisive:
        return 0.0
    return round(sum(1 for b in decisive if _is_win(b)) / len(decisive) * 100, 2)


def calibration_curve(battles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Bucket stated confidence vs. observed win rate.

    Only battles with an explicit stated confidence contribute. Buckets with
    no battles report n=0 and a null win rate rather than a fabricated value.
    """
    rows: list[dict[str, Any]] = []
    for low, high in BUCKETS:
        bucket = [
            b
            for b in battles
            if _is_decisive(b)
            and (_stated_probability(b) is not None)
            and low <= float(b.get("stated_confidence") or 0) < high
        ]
        wins = sum(1 for b in bucket if _is_win(b))
        rows.append(
            {
                "bucket": f"{low}–{min(high, 100)}%",
                "stated_midpoint": round((low + min(high, 100)) / 2, 1),
                "n": len(bucket),
                "win_rate": round(wins / len(bucket) * 100, 2) if bucket else None,
            }
        )
    return rows


def track_record(battles: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate a player's settled paper battles into a falsifiable record.

    Deterministic and Qwen-free. Scores are None with insufficient_data=True
    until MIN_SETTLED_BATTLES decisive battles with stated confidence exist.
    """
    decisive = [b for b in battles if _is_decisive(b)]
    scored = [b for b in decisive if _stated_probability(b) is not None]
    total_settled = len(decisive)
    result: dict[str, Any] = {
        "settled_battles": total_settled,
        "scored_battles": len(scored),
        "min_settled_battles": MIN_SETTLED_BATTLES,
        "insufficient_data": len(scored) < MIN_SETTLED_BATTLES,
        "win_rate": win_rate(battles),
        "brier_score": None,
        "brier_baseline": None,
        "curve": [],
        "disclaimer": (
            "Paper-only aggregate of your own settled battles. "
            "A good past score does not prove a repeatable edge; "
            "it only shows whether past confidence matched past outcomes."
        ),
    }
    if result["insufficient_data"]:
        return result
    probabilities = [_stated_probability(b) for b in scored]
    outcomes = [1 if _is_win(b) else 0 for b in scored]
    base_rate = sum(outcomes) / len(outcomes)
    result["brier_score"] = brier_score([p for p in probabilities if p is not None], outcomes)
    result["brier_baseline"] = round(base_rate * (1 - base_rate), 4)
    result["curve"] = calibration_curve(battles)
    return result
