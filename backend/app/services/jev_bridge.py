from __future__ import annotations

import time
from typing import Any

import httpx

from app.config import settings


class JevBridgeError(RuntimeError):
    pass


class JevBridge:
    """Small provider-neutral adapter for an external Jev early-access client.

    AlphaArena sends one frozen market snapshot to the configured adapter and
    accepts only a typed LONG/SHORT/WAIT decision. The adapter is responsible
    for translating this stable contract to whatever Jev SDK/API the operator
    has access to.
    """

    def __init__(self, *, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._transport = transport

    @property
    def enabled(self) -> bool:
        return bool(settings.jev_adapter_url.strip())

    async def decide(self, snapshot: dict[str, Any]) -> dict[str, Any] | None:
        if not self.enabled:
            return None

        payload = {
            "snapshot_id": str(snapshot.get("id")),
            "symbol": str(snapshot.get("symbol")),
            "captured_at": str(snapshot.get("captured_at")),
            "price": float(snapshot.get("price") or 0),
            "change_pct_24h": float(snapshot.get("change_pct_24h") or 0),
            "spread_bps": float(snapshot.get("spread_bps") or 0),
            "spark": list(snapshot.get("spark") or [])[-24:],
            "output_schema": {
                "direction": "LONG|SHORT|WAIT",
                "confidence": "0..100",
            },
        }
        headers = {"Content-Type": "application/json"}
        if settings.jev_adapter_token.strip():
            headers["Authorization"] = f"Bearer {settings.jev_adapter_token.strip()}"

        started = time.perf_counter()
        try:
            timeout = httpx.Timeout(max(0.2, settings.jev_adapter_timeout_seconds))
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, transport=self._transport) as client:
                response = await client.post(settings.jev_adapter_url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise JevBridgeError(f"Jev adapter unavailable: {exc}") from exc
        latency_ms = (time.perf_counter() - started) * 1000

        if not isinstance(data, dict):
            raise JevBridgeError("Jev adapter returned a non-object response")
        direction = str(data.get("direction") or "").upper()
        if direction not in {"LONG", "SHORT", "WAIT"}:
            raise JevBridgeError("Jev adapter direction must be LONG, SHORT, or WAIT")
        try:
            confidence = float(data.get("confidence"))
        except (TypeError, ValueError) as exc:
            raise JevBridgeError("Jev adapter confidence must be numeric") from exc
        if not 0 <= confidence <= 100:
            raise JevBridgeError("Jev adapter confidence must be between 0 and 100")

        return {
            "direction": direction,
            "confidence": round(confidence, 2),
            "latency_ms": round(latency_ms, 3),
            "model": str(data.get("model") or "jev")[:120],
            "note": str(data.get("note") or "Jev adapter decision")[:500],
            "metadata": data.get("metadata") if isinstance(data.get("metadata"), dict) else {},
        }


jev_bridge = JevBridge()
