from __future__ import annotations

import pytest

from app.services import decision_tape as tape_module
from app.services.decision_tape import decision_tape
from app.services.storage import store


@pytest.mark.asyncio
async def test_snapshot_creates_transparent_baseline(monkeypatch: pytest.MonkeyPatch) -> None:
    await store.clear_memory()

    async def fake_asset(symbol: str) -> dict[str, object]:
        return {
            "symbol": symbol,
            "price": 100.0,
            "changePct": 1.0,
            "spreadBps": 2.0,
            "spark": [99.0, 99.5, 100.0],
            "timestamp": 1_700_000_000_000,
        }

    monkeypatch.setattr(tape_module.bitget_market, "get_asset", fake_asset)
    result = await decision_tape.capture_snapshot("rNVDA")
    assert result["snapshot"]["symbol"] == "rNVDA"
    assert result["baseline"]["lane"] == "baseline"
    assert result["baseline"]["direction"] in {"LONG", "SHORT", "WAIT"}
    assert result["baseline"]["model"] == "deterministic-baseline-v1"


@pytest.mark.asyncio
async def test_multiple_lanes_share_one_market_snapshot(monkeypatch: pytest.MonkeyPatch) -> None:
    await store.clear_memory()

    async def fake_asset(symbol: str) -> dict[str, object]:
        return {
            "symbol": symbol,
            "price": 100.0,
            "changePct": 0.0,
            "spreadBps": 1.0,
            "spark": [100.0, 100.0],
            "timestamp": 1_700_000_000_000,
        }

    monkeypatch.setattr(tape_module.bitget_market, "get_asset", fake_asset)
    captured = await decision_tape.capture_snapshot("rNVDA", "guest_test")
    snapshot_id = captured["snapshot"]["id"]
    human = await decision_tape.submit(
        snapshot_id,
        "human",
        "LONG",
        70,
        player_id="guest_test",
        model="human",
    )
    jev = await decision_tape.submit(
        snapshot_id,
        "jev",
        "SHORT",
        62,
        player_id="guest_test",
        model="jev",
        latency_ms=180,
    )
    assert human["snapshot_id"] == jev["snapshot_id"] == snapshot_id
    assert human["entry_price"] == jev["entry_price"] == 100.0


@pytest.mark.asyncio
async def test_due_decisions_are_scored_and_calibrated(monkeypatch: pytest.MonkeyPatch) -> None:
    await store.clear_memory()

    async def fake_asset(symbol: str) -> dict[str, object]:
        return {
            "symbol": symbol,
            "price": 100.0,
            "changePct": 1.0,
            "spreadBps": 1.0,
            "spark": [99.0, 100.0],
            "timestamp": 1_700_000_000_000,
        }

    async def price_near(symbol: str, when_ms: int) -> dict[str, object]:
        return {"price": 110.0, "timestamp": when_ms, "source": "bitget-candle", "granularity": "1m"}

    monkeypatch.setattr(tape_module.bitget_market, "get_asset", fake_asset)
    monkeypatch.setattr(tape_module.bitget_market, "get_price_near", price_near)

    captured = await decision_tape.capture_snapshot("rNVDA", "guest_eval")
    decision = await decision_tape.submit(
        captured["snapshot"]["id"],
        "jev",
        "LONG",
        80,
        player_id="guest_eval",
        model="jev",
        latency_ms=150,
    )
    decision["snapshot_captured_at"] = "2000-01-01T00:00:00+00:00"
    await store.save("decision_tape", decision["id"], decision)

    updated = await decision_tape.evaluate_due("guest_eval")
    jev_row = next(row for row in updated if row["id"] == decision["id"])
    assert jev_row["outcomes"]["5m"]["correct"] is True
    assert jev_row["outcomes"]["24h"]["signed_return_pct"] == 10.0

    summary = await decision_tape.summary("guest_eval")
    stats = summary["lanes"]["jev"]["horizons"]["5m"]
    assert stats["n"] == 1
    assert stats["hit_rate_pct"] == 100.0
    assert stats["brier_score"] == pytest.approx(0.04)
