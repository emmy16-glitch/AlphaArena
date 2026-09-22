from __future__ import annotations

import time

import pytest

from app.services import decision_tape as tape_module
from app.services.decision_sessions import (
    decision_sessions,
    receipt_canonical_payload,
    receipt_hash,
)
from app.services.storage import store


def _fresh_asset(symbol: str = "rNVDA") -> dict[str, object]:
    now_ms = int(time.time() * 1000)
    return {
        "symbol": symbol,
        "price": 100.0,
        "changePct": 1.2,
        "spreadBps": 2.0,
        "spark": [98.0, 99.0, 99.5, 100.0, 100.2, 100.4],
        "timestamp": now_ms,
    }


@pytest.mark.asyncio
async def test_session_freezes_one_snapshot_for_all_lanes(monkeypatch: pytest.MonkeyPatch) -> None:
    await store.clear_memory()

    async def fake_asset(symbol: str) -> dict[str, object]:
        return _fresh_asset(symbol)

    async def fake_analyze(request: object, *, market_asset: dict[str, object] | None = None) -> dict[str, object]:
        assert market_asset is not None
        assert float(market_asset["price"]) == 100.0
        return {
            "id": "nw-test",
            "verdict": "LONG",
            "confidence": 64,
            "headline": "Test headline",
            "summary": "Test summary",
        }

    monkeypatch.setattr(tape_module.bitget_market, "get_asset", fake_asset)
    import app.services.decision_sessions as sessions_module

    monkeypatch.setattr(sessions_module.nightwatch, "analyze", fake_analyze)

    session = await decision_sessions.create_session(
        symbol="rNVDA",
        thesis="NVDA stays strong over the next 24 hours unless tape reverses.",
        human_direction="LONG",
        horizon="24h",
        confidence=70.0,
        risk_pct=2.0,
    )
    snapshot_id = session["snapshot"]["id"]
    assert session["snapshot_hash"]
    assert session["ready_for_arena"] is True
    assert session["refusal"] is None
    for lane in ("human", "nightwatch", "baseline"):
        assert session["participants"][lane]["snapshot_id"] == snapshot_id
        assert session["participants"][lane]["status"] == "decided"
    # Qwen is unconfigured in test env: explicit unavailable, never a faked HOLD.
    assert session["participants"]["qwen"]["status"] == "unavailable"
    assert session["participants"]["qwen"]["direction"] is None


@pytest.mark.asyncio
async def test_receipt_hash_is_stable_and_verifiable(monkeypatch: pytest.MonkeyPatch) -> None:
    await store.clear_memory()

    async def fake_asset(symbol: str) -> dict[str, object]:
        return _fresh_asset(symbol)

    async def fake_analyze(request: object, *, market_asset: dict[str, object] | None = None) -> dict[str, object]:
        return {"id": "nw-1", "verdict": "WAIT", "confidence": 55, "headline": "H", "summary": "S"}

    monkeypatch.setattr(tape_module.bitget_market, "get_asset", fake_asset)
    import app.services.decision_sessions as sessions_module

    monkeypatch.setattr(sessions_module.nightwatch, "analyze", fake_analyze)

    session = await decision_sessions.create_session(
        symbol="rNVDA",
        thesis="NVDA holds flat over the next 24 hours unless volume breaks out.",
        human_direction="WAIT",
        horizon="24h",
        confidence=55.0,
    )
    canonical = receipt_canonical_payload(session)
    assert receipt_hash(canonical) == session["receipt_hash"]
    # No secrets leak into the receipt payload.
    assert "key" not in receipt_hash(canonical)
    flat = str(canonical).lower()
    assert "sk-" not in flat and "api_key" not in flat

    result = await decision_sessions.verify_receipt(session["id"])
    assert result is not None
    assert result["verified"] is True


@pytest.mark.asyncio
async def test_short_thesis_returns_structured_refusal(monkeypatch: pytest.MonkeyPatch) -> None:
    await store.clear_memory()

    async def fake_asset(symbol: str) -> dict[str, object]:
        return _fresh_asset(symbol)

    async def fake_analyze(request: object, *, market_asset: dict[str, object] | None = None) -> dict[str, object]:
        return {"id": "nw-1", "verdict": "WAIT", "confidence": 50, "headline": "H", "summary": "S"}

    monkeypatch.setattr(tape_module.bitget_market, "get_asset", fake_asset)
    import app.services.decision_sessions as sessions_module

    monkeypatch.setattr(sessions_module.nightwatch, "analyze", fake_analyze)

    session = await decision_sessions.create_session(
        symbol="rNVDA",
        thesis="NVDA up",
        human_direction="LONG",
        horizon="24h",
        confidence=60.0,
    )
    assert session["refusal"] is not None
    assert session["refusal"]["code"] == "THESIS_NOT_FALSIFIABLE"
    assert session["refusal"]["title"]
    assert session["refusal"]["explanation"]
    assert session["ready_for_arena"] is False
    with pytest.raises(ValueError):
        await decision_sessions.enter_arena(session["id"])


@pytest.mark.asyncio
async def test_risk_guardrail_blocks_arena_entry(monkeypatch: pytest.MonkeyPatch) -> None:
    await store.clear_memory()

    async def fake_asset(symbol: str) -> dict[str, object]:
        return _fresh_asset(symbol)

    async def fake_analyze(request: object, *, market_asset: dict[str, object] | None = None) -> dict[str, object]:
        return {"id": "nw-1", "verdict": "LONG", "confidence": 60, "headline": "H", "summary": "S"}

    monkeypatch.setattr(tape_module.bitget_market, "get_asset", fake_asset)
    import app.services.decision_sessions as sessions_module

    monkeypatch.setattr(sessions_module.nightwatch, "analyze", fake_analyze)

    session = await decision_sessions.create_session(
        symbol="rNVDA",
        thesis="NVDA stays strong over the next 24 hours unless tape reverses hard.",
        human_direction="LONG",
        horizon="24h",
        confidence=60.0,
        risk_pct=15.0,
    )
    assert session["refusal"] is not None
    assert session["refusal"]["code"] == "RISK_LIMIT_EXCEEDED"
