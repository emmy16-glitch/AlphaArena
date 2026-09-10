from __future__ import annotations

import json
from datetime import datetime, timezone

import httpx
import pytest

from app.services.analytics import parse_shock, scenario_impact
from app.services.arena import _pnl, arena_service
from app.services.mcp import MCPHttpClient
from app.services.storage import store
from app.services.vibe import _historical_stats, _move_analogues


def test_yield_shock_direction_flips_impact() -> None:
    rise = parse_shock("Treasury yields spike 40bp", 60)
    fall = parse_shock("Treasury yields fall 40bp", 60)
    rise_impact = scenario_impact("rNVDA", rise, 60)[0]
    fall_impact = scenario_impact("rNVDA", fall, 60)[0]
    assert rise_impact < 0
    assert fall_impact > 0
    assert abs(rise_impact) == abs(fall_impact)


def test_nasdaq_direction_is_respected() -> None:
    down = parse_shock("Nasdaq falls 5%", 70)
    up = parse_shock("Nasdaq rises 5%", 70)
    assert scenario_impact("rAAPL", down, 70)[0] < 0
    assert scenario_impact("rAAPL", up, 70)[0] > 0


def test_mcp_sse_decoder_selects_matching_jsonrpc_id() -> None:
    request = httpx.Request("POST", "https://example.test/mcp")
    body = (
        'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress","params":{}}\n\n'
        'event: message\ndata: {"jsonrpc":"2.0","id":7,"result":{"content":"ok"}}\n\n'
    )
    response = httpx.Response(200, request=request, headers={"content-type": "text/event-stream"}, text=body)
    decoded = MCPHttpClient._decode_response(response, expected_id=7)
    assert decoded["id"] == 7
    assert decoded["result"]["content"] == "ok"


def _records(prices: list[float]) -> list[dict[str, object]]:
    return [
        {"trade_date": f"2026-01-{index + 1:02d}", "close": price}
        for index, price in enumerate(prices)
    ]


def test_vibe_history_produces_beta_and_mechanical_analogues() -> None:
    qqq = [100 + index * 0.7 + (index % 3) * 0.2 for index in range(30)]
    nvda = [150 + index * 1.3 + (index % 4) * 0.5 for index in range(30)]
    stats = _historical_stats(_records(nvda), _records(qqq))
    assert stats["observations"] == 30
    assert stats["paired_observations"] >= 20
    assert stats["beta_to_qqq"] is not None
    assert stats["correlation_to_qqq"] is not None
    analogues = _move_analogues(_records(nvda), 1.0, limit=3)
    assert len(analogues) <= 3
    assert all("not a prediction" in row["relevance"] for row in analogues)


def test_pnl_long_short_wait() -> None:
    assert _pnl("LONG", 100, 110) == 10.0
    assert _pnl("SHORT", 100, 110) == -10.0
    assert _pnl("WAIT", 100, 110) == 0.0


@pytest.mark.asyncio
async def test_settled_battle_is_immutable() -> None:
    await store.clear_memory()
    battle = {
        "id": "battle-test",
        "symbol": "rNVDA",
        "thesis": "test thesis",
        "user_side": "LONG",
        "ai_side": "WAIT",
        "opponent": "NightWatch",
        "stake": 10000.0,
        "entry_price": 100.0,
        "current_price": 100.0,
        "user_pnl_pct": 0.0,
        "ai_pnl_pct": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": "2000-01-01T00:00:00+00:00",
        "settled_at": None,
        "settled_price": None,
        "status": "live",
        "source": "bitget",
    }
    first = await arena_service._refresh(dict(battle), {"rNVDA": 110.0})
    assert first["status"] == "settled"
    assert first["settled_price"] == 110.0
    assert first["user_pnl_pct"] == 10.0

    second = await arena_service._refresh(dict(first), {"rNVDA": 50.0})
    assert second["settled_price"] == 110.0
    assert second["current_price"] == 110.0
    assert second["user_pnl_pct"] == 10.0


def test_json_payloads_stay_strict() -> None:
    payload = {"impact": scenario_impact("rQQQ", parse_shock("Nasdaq falls 5%", 60), 60)[0]}
    json.dumps(payload, allow_nan=False)
