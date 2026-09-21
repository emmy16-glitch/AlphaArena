from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.main import _decision_worker_status
from app.services.mcp import MCPHttpClient
from app.services.storage import store
from scripts.decision_worker import run as run_decision_worker


def test_mcp_client_keeps_default_auth_headers() -> None:
    client = MCPHttpClient(
        "https://example.test/mcp",
        "Example",
        {"Authorization": "Bearer secret"},
    )
    assert client.default_headers["Authorization"] == "Bearer secret"


@pytest.mark.asyncio
async def test_worker_status_reports_recent_heartbeat() -> None:
    await store.clear_memory()
    now = datetime.now(timezone.utc).isoformat()
    await store.save(
        "service_status",
        "decision_worker",
        {
            "id": "decision_worker",
            "service": "decision_worker",
            "status": "running",
            "started_at": now,
            "heartbeat_at": now,
            "interval_seconds": 5,
            "symbols": ["rNVDA"],
            "jev_enabled": False,
            "last_error": None,
            "updated_at": now,
        },
    )
    status = await _decision_worker_status()
    assert status["connected"] is True
    assert status["status"] == "running"
    assert status["symbols"] == ["rNVDA"]


@pytest.mark.asyncio
async def test_worker_refuses_ephemeral_storage() -> None:
    if store.durable:
        pytest.skip("This safety test is for the normal CI/local no-Mongo environment")
    with pytest.raises(RuntimeError, match="requires durable MongoDB"):
        await run_decision_worker()
