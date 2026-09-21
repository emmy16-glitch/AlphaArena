from __future__ import annotations

import httpx
import pytest

from app.config import settings
from app.services.jev_bridge import JevBridge, JevBridgeError


@pytest.mark.asyncio
async def test_jev_bridge_accepts_typed_decision(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jev_adapter_url", "https://adapter.test/decision")
    monkeypatch.setattr(settings, "jev_adapter_token", "secret")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer secret"
        payload = request.read().decode()
        assert "snapshot_id" in payload
        return httpx.Response(
            200,
            json={
                "direction": "LONG",
                "confidence": 78,
                "model": "jev",
                "metadata": {"adapter": "test"},
            },
        )

    bridge = JevBridge(transport=httpx.MockTransport(handler))
    result = await bridge.decide(
        {
            "id": "snap_1",
            "symbol": "rNVDA",
            "captured_at": "2026-09-21T10:00:00+00:00",
            "price": 100.0,
            "change_pct_24h": 1.2,
            "spread_bps": 2.0,
            "spark": [99.0, 100.0],
        }
    )
    assert result is not None
    assert result["direction"] == "LONG"
    assert result["confidence"] == 78.0
    assert result["latency_ms"] >= 0


@pytest.mark.asyncio
async def test_jev_bridge_rejects_untyped_direction(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jev_adapter_url", "https://adapter.test/decision")

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"direction": "BUY_NOW", "confidence": 90})

    bridge = JevBridge(transport=httpx.MockTransport(handler))
    with pytest.raises(JevBridgeError, match="LONG, SHORT, or WAIT"):
        await bridge.decide(
            {
                "id": "snap_2",
                "symbol": "rNVDA",
                "captured_at": "2026-09-21T10:00:00+00:00",
                "price": 100.0,
                "change_pct_24h": 0.0,
                "spread_bps": 1.0,
                "spark": [100.0, 100.0],
            }
        )
