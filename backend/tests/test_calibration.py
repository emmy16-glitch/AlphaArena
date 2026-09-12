from __future__ import annotations

from types import SimpleNamespace

import httpx
import pytest

from app.main import app
from app.services import arena as arena_module
from app.services.arena import arena_service
from app.services.calibration import (
    MIN_SETTLED_BATTLES,
    brier_score,
    calibration_curve,
    track_record,
    win_rate,
)
from app.services.storage import store


def _battle(
    battle_id: str,
    pnl: float,
    confidence: float | None = 70.0,
    side: str = "LONG",
) -> dict[str, object]:
    return {
        "id": battle_id,
        "symbol": "rNVDA",
        "user_side": side,
        "ai_side": "WAIT",
        "stake": 10_000.0,
        "entry_price": 100.0,
        "current_price": 100.0,
        "user_pnl_pct": pnl,
        "ai_pnl_pct": 0.0,
        "created_at": "2026-09-10T10:00:00+00:00",
        "expires_at": "2026-09-11T10:00:00+00:00",
        "settled_at": "2026-09-11T10:00:00+00:00",
        "settled_price": 100.0,
        "stated_confidence": confidence,
        "status": "settled",
        "source": "bitget",
    }


def test_brier_score_rewards_honest_probabilities() -> None:
    assert brier_score([1.0, 1.0, 0.0, 0.0], [1, 1, 0, 0]) == 0.0
    assert brier_score([0.5, 0.5, 0.5, 0.5], [1, 1, 0, 0]) == 0.25
    confident_wrong = brier_score([0.9, 0.9], [0, 0])
    humble_wrong = brier_score([0.6, 0.6], [0, 0])
    assert confident_wrong > humble_wrong


def test_brier_score_rejects_misaligned_inputs() -> None:
    with pytest.raises(ValueError):
        brier_score([], [])
    with pytest.raises(ValueError):
        brier_score([0.7], [1, 0])


def test_win_rate_ignores_wait_positions() -> None:
    battles = [_battle("b1", 5.0), _battle("b2", -3.0), _battle("b3", 0.0, side="WAIT")]
    assert win_rate(battles) == 50.0
    assert win_rate([]) == 0.0


def test_calibration_curve_buckets_without_fabrication() -> None:
    battles = [
        _battle("b1", 5.0, 65.0),
        _battle("b2", -2.0, 65.0),
        _battle("b3", 1.0, 95.0),
        _battle("b4", 1.0, None),
    ]
    curve = calibration_curve(battles)
    assert len(curve) == 5
    bucket_60s = next(row for row in curve if row["bucket"] == "60–70%")
    assert bucket_60s["n"] == 2
    assert bucket_60s["win_rate"] == 50.0
    bucket_50s = next(row for row in curve if row["bucket"] == "50–60%")
    assert bucket_50s["n"] == 0
    assert bucket_50s["win_rate"] is None


def test_track_record_withholds_scores_below_minimum() -> None:
    battles = [_battle(f"b{i}", 5.0, 70.0) for i in range(MIN_SETTLED_BATTLES - 1)]
    record = track_record(battles)
    assert record["insufficient_data"] is True
    assert record["brier_score"] is None
    assert record["settled_battles"] == MIN_SETTLED_BATTLES - 1


def test_track_record_scores_a_full_history() -> None:
    battles = [_battle(f"b{i}", 5.0 if i % 2 == 0 else -5.0, 70.0) for i in range(6)]
    record = track_record(battles)
    assert record["insufficient_data"] is False
    assert record["win_rate"] == 50.0
    assert record["brier_score"] == pytest.approx(0.29, abs=1e-4)
    assert len(record["curve"]) == 5
    assert "repeatable edge" in record["disclaimer"]


def test_track_record_ignores_battles_without_confidence() -> None:
    battles = [_battle(f"b{i}", 5.0, None) for i in range(6)]
    record = track_record(battles)
    assert record["insufficient_data"] is True
    assert record["scored_battles"] == 0


async def test_track_record_endpoint_is_session_scoped() -> None:
    await store.clear_memory()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/track-record")
    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["insufficient_data"] is True
    assert payload["settled_battles"] == 0


async def test_battle_creation_captures_stated_confidence(monkeypatch: pytest.MonkeyPatch) -> None:
    await store.clear_memory()

    async def fake_asset(symbol: str) -> dict[str, object]:
        return {"symbol": symbol, "price": 100.0}

    monkeypatch.setattr(arena_module.bitget_market, "get_asset", fake_asset)
    request = SimpleNamespace(
        symbol="rNVDA",
        user_side="LONG",
        ai_side="WAIT",
        thesis="A calibrated test thesis",
        stake=10_000.0,
        duration_hours=24,
        opponent="NightWatch",
        stated_confidence=75.0,
    )
    battle = await arena_service.create_battle(request)
    assert battle["stated_confidence"] == 75.0


async def test_battle_creation_rejects_out_of_range_confidence() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/arena/battles",
            json={
                "symbol": "rNVDA",
                "user_side": "LONG",
                "ai_side": "WAIT",
                "thesis": "A calibrated test thesis",
                "stake": 10000,
                "duration_hours": 24,
                "stated_confidence": 150,
            },
        )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "CHECK_INPUT"
