def test_shadow_session_boundaries() -> None:
    from app.services.shadow import session_of

    # Thu 15:00 UTC = 11:00 ET (DST) -> Listed.
    assert session_of("2026-09-11T15:00:00Z") == "listed"
    # Sat -> Shadow. Night -> Shadow. 03:11 UTC Sat -> Shadow.
    assert session_of("2026-09-13T15:00:00Z") == "shadow"
    assert session_of("2026-09-11T23:00:00Z") == "shadow"
    assert session_of("2026-09-12T03:11:00Z") == "shadow"
    # Thanksgiving full day -> Shadow even at 15:00 UTC.
    assert session_of("2025-11-27T15:00:00Z") == "shadow"
    # Winter (EST): 14:30 UTC = 09:30 ET boundary -> Listed.
    assert session_of("2026-01-15T14:30:00Z") == "listed"
    assert session_of("2026-01-15T14:29:00Z") == "shadow"


def test_shadow_attribution_splits_listed_shadow() -> None:
    from datetime import datetime, timezone

    from app.services.shadow import attribute_moves, flatten_before_dark

    base = int(datetime(2026, 9, 11, 12, 0, tzinfo=timezone.utc).timestamp() * 1000)
    candles = [{"ts": base + i * 3_600_000, "close": 100 + i} for i in range(30)]
    result = attribute_moves(100, "LONG", candles, "1H")
    assert result["candle_count"] == 30
    assert result["is_estimate"] is True
    assert abs(result["listed_move_pct"] + result["shadow_move_pct"] - result["total_move_pct"]) < 1e-6
    assert result["kill_session"] is None
    flat = flatten_before_dark(100, "LONG", 129, 115)
    assert flat is not None and flat["flatten_price"] == 115.0


def test_kill_check_tags_first_touch_session() -> None:
    from datetime import datetime, timezone

    from app.services.shadow import kill_check

    base = int(datetime(2026, 9, 11, 12, 0, tzinfo=timezone.utc).timestamp() * 1000)
    candles = [{"ts": base + i * 3_600_000, "open": 100 - i, "high": 100 - i + 0.5, "low": 100 - i - 0.5, "close": 100 - i} for i in range(10)]
    hit = kill_check(100, "LONG", 98, candles)
    assert hit is not None and hit["kill_hit"] is True
    assert hit["kill_session"] in {"listed", "shadow"}
    assert hit["kill_at"] is not None
    miss = kill_check(100, "LONG", 50, candles)
    assert miss is not None and miss["kill_hit"] is False
    assert kill_check(100, "WAIT", 98, candles) is None


def test_commitment_sentence_changes_hash() -> None:
    from app.services.arena import battle_hash

    base_hash = {
        "id": "x",
        "symbol": "rNVDA",
        "user_side": "LONG",
        "ai_side": "WAIT",
        "stake": 10000.0,
        "entry_price": 100.0,
        "settled_price": 110.0,
        "created_at": "2026-09-11T10:00:00+00:00",
        "settled_at": "2026-09-12T10:00:00+00:00",
    }
    assert battle_hash({**base_hash, "wrong_sentence": "weekend tape"}) != battle_hash({**base_hash, "wrong_sentence": "earnings leak"})

def test_kill_check_uses_intrabar_high_low_not_only_close() -> None:
    from datetime import datetime, timezone

    from app.services.shadow import kill_check

    ts = int(datetime(2026, 9, 11, 15, 0, tzinfo=timezone.utc).timestamp() * 1000)
    long_hit = kill_check(100, "LONG", 95, [{"ts": ts, "open": 97, "high": 98, "low": 94, "close": 96}])
    assert long_hit is not None and long_hit["kill_hit"] is True
    assert long_hit["kill_price_touched"] == 94
    short_hit = kill_check(100, "SHORT", 105, [{"ts": ts, "open": 103, "high": 106, "low": 102, "close": 104}])
    assert short_hit is not None and short_hit["kill_hit"] is True
    assert short_hit["kill_price_touched"] == 106

def test_full_thesis_is_part_of_settlement_freeze() -> None:
    from app.services.arena import battle_hash

    battle = {
        "id": "x", "player_id": "guest_x", "symbol": "rNVDA",
        "thesis": "earnings acceleration continues", "wrong_sentence": "guidance breaks",
        "user_side": "LONG", "ai_side": "WAIT", "opponent": "NightWatch",
        "stake": 10000.0, "quantity": 100.0, "risk_pct": 2.0, "kill_price": 98.0,
        "entry_price": 100.0, "created_at": "2026-09-11T10:00:00+00:00",
        "expires_at": "2026-09-12T10:00:00+00:00", "settled_price": 110.0,
        "settled_at": "2026-09-12T10:00:00+00:00", "settlement_source": "bitget-candle",
        "settlement_granularity": "1m",
    }
    assert battle_hash(battle) != battle_hash({**battle, "thesis": "completely different thesis"})
