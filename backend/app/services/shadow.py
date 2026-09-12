"""Shadow Session — session boundary + honest bucket attribution.

Listed = NYSE cash session (Mon-Fri 09:30-16:00 America/New_York,
holidays excluded). Shadow = everything else (nights, weekends, holidays).

ZoneInfo handles the DST shift automatically (13:30-20:00 UTC in DST,
14:30-21:00 UTC out of DST) — correct for demo dates without a manual table.

Pure deterministic logic. No LLM. No predictions — only "occurred in".
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")

# Small hardcoded US market holiday list (full-day Shadow). Demo scope.
# Format: YYYY-MM-DD (NYSE closed).
US_MARKET_HOLIDAYS = frozenset({
    "2025-01-01",  # New Year's Day
    "2025-01-09",  # National Day of Mourning (Carter)
    "2025-01-20",  # MLK Day
    "2025-02-17",  # Presidents Day
    "2025-04-18",  # Good Friday
    "2025-05-26",  # Memorial Day
    "2025-06-19",  # Juneteenth
    "2025-07-04",  # Independence Day
    "2025-09-01",  # Labor Day
    "2025-11-27",  # Thanksgiving
    "2025-12-25",  # Christmas
    "2026-01-01",
    "2026-01-19",
    "2026-02-16",
    "2026-04-03",
    "2026-05-25",
    "2026-06-19",
    "2026-07-03",  # July 4 observed (Friday)
    "2026-09-07",
    "2026-11-26",
    "2026-12-25",
})

SESSION_LABEL = "Listed = NYSE hours. Shadow = everything else — nights, weekends, holidays."


def _ensure_utc(value: Any) -> datetime:
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def is_listed(dt_utc: Any) -> bool:
    """True if a UTC timestamp falls inside the NYSE cash session."""
    utc = _ensure_utc(dt_utc)
    et = utc.astimezone(ET)
    # Weekend.
    if et.weekday() >= 5:
        return False
    # Full-day holiday -> Shadow.
    if et.date().isoformat() in US_MARKET_HOLIDAYS:
        return False
    minutes = et.hour * 60 + et.minute
    # 09:30 <= t < 16:00 ET.
    return (9 * 60 + 30) <= minutes < (16 * 60)


def session_of(dt_utc: Any) -> str:
    return "listed" if is_listed(dt_utc) else "shadow"


def tag_candles(candles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Tag each candle dict (with ts in ms or iso time) with its session."""
    tagged: list[dict[str, Any]] = []
    for candle in candles:
        raw_ts = candle.get("ts", candle.get("time", candle.get("timestamp")))
        try:
            if isinstance(raw_ts, (int, float)):
                dt = datetime.fromtimestamp(float(raw_ts) / 1000, tz=timezone.utc)
            else:
                dt = _ensure_utc(raw_ts)
        except Exception:
            continue
        tagged.append({**candle, "session": session_of(dt), "iso": dt.isoformat()})
    return tagged


def kill_check(
    entry_price: float,
    side: str,
    kill_price: float | None,
    candles: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """First candle that touches the kill level, tagged with its session.

    LONG kill: candle close <= kill. SHORT kill: close >= kill.
    WAIT or missing kill: None. Pure observation — "occurred in", never
    "predicted".
    """
    if not kill_price or kill_price <= 0 or entry_price <= 0:
        return None
    upper = str(side).upper()
    if upper == "WAIT":
        return None
    for candle in tag_candles(candles):
        try:
            price = float(candle.get("close", candle.get("price", 0)) or 0)
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue
        hit = price <= float(kill_price) if upper == "LONG" else price >= float(kill_price)
        if hit:
            return {"kill_hit": True, "kill_at": str(candle.get("iso")), "kill_session": str(candle.get("session")), "kill_price_touched": price}
    return {"kill_hit": False, "kill_at": None, "kill_session": None, "kill_price_touched": None}


def attribute_moves(
    entry_price: float,
    side: str,
    candles: list[dict[str, Any]],
    granularity_label: str = "1H",
) -> dict[str, Any]:
    """Split the entry->last price move into Listed vs Shadow buckets.

    Each step-to-step delta is credited to the session of the *ending*
    candle. Sign is oriented so positive = helpful for the side.
    LONG: + means price rose. SHORT: + means price fell.
    Pure arithmetic — no prediction.
    """
    listed_move = 0.0
    shadow_move = 0.0
    prev = float(entry_price) if entry_price and entry_price > 0 else 0.0
    direction = -1.0 if str(side).upper() == "SHORT" else 1.0
    last_listed_price: float | None = None
    kill_iso: str | None = None
    kill_session: str | None = None

    tagged = tag_candles(candles)
    for candle in tagged:
        try:
            price = float(candle.get("close", candle.get("price", 0)) or 0)
        except (TypeError, ValueError):
            continue
        if price <= 0 or prev <= 0:
            prev = price if price > 0 else prev
            continue
        step_pct = ((price / prev) - 1) * 100 * direction
        if candle.get("session") == "listed":
            listed_move += step_pct
            last_listed_price = price
        else:
            shadow_move += step_pct
        prev = price
        kill_iso = str(candle.get("iso"))
        kill_session = str(candle.get("session"))

    total = listed_move + shadow_move
    return {
        "listed_move_pct": round(listed_move, 4),
        "shadow_move_pct": round(shadow_move, 4),
        "total_move_pct": round(total, 4),
        "kill_session": kill_session,
        "kill_at": kill_iso,
        "candle_count": len(tagged),
        "granularity": granularity_label,
        "is_estimate": granularity_label.strip().upper() != "1M",
        "last_listed_price": last_listed_price,
        "session_label": SESSION_LABEL,
    }


def flatten_before_dark(
    entry_price: float,
    side: str,
    settled_price: float,
    last_listed_price: float | None,
) -> dict[str, Any] | None:
    """Counterfactual: what if flattened at the last NYSE close.

    Pure arithmetic on observed prices. Never a recommendation.
    """
    if not last_listed_price or last_listed_price <= 0 or entry_price <= 0 or settled_price <= 0:
        return None
    direction = -1.0 if str(side).upper() == "SHORT" else 1.0
    flat_pct = (((float(last_listed_price) / float(entry_price)) - 1) * 100 * direction)
    final_pct = (((float(settled_price) / float(entry_price)) - 1) * 100 * direction)
    return {
        "flatten_price": round(float(last_listed_price), 4),
        "flatten_pnl_pct": round(flat_pct, 4),
        "final_pnl_pct": round(final_pct, 4),
        "saved_pct": round(flat_pct - final_pct, 4),
    }
