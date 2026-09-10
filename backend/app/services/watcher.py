from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.config import settings
from app.services.pulse import pulse_service
from app.services.storage import store


class PulseWatcher:
    """Lightweight always-on detector for the Azure backend.

    The watcher does not invoke Qwen on a timer. It only evaluates inexpensive
    public market metrics. Deep AI analysis stays user-triggered so credits are
    not burned while nobody is using the product.
    """

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._stop = asyncio.Event()
        self._latest: list[dict[str, Any]] = []
        self._last_error: str = ""
        self._last_run: str | None = None

    @property
    def latest(self) -> list[dict[str, Any]]:
        return self._latest

    @property
    def status(self) -> dict[str, Any]:
        return {
            "enabled": settings.watcher_enabled,
            "running": self._task is not None and not self._task.done(),
            "interval_seconds": settings.watcher_interval_seconds,
            "last_run": self._last_run,
            "last_error": self._last_error or None,
            "event_count": len(self._latest),
        }

    async def run_once(self) -> list[dict[str, Any]]:
        events = await pulse_service.events()
        self._latest = events
        self._last_error = ""
        self._last_run = datetime.now(timezone.utc).isoformat()
        snapshot = {
            "id": f"pulse_snapshot_{uuid4().hex[:12]}",
            "created_at": self._last_run,
            "events": events,
        }
        await store.save("pulse_snapshots", snapshot["id"], snapshot)
        return events

    async def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                await self.run_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self._last_error = str(exc)[:500]
                self._last_run = datetime.now(timezone.utc).isoformat()
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=settings.watcher_interval_seconds)
            except asyncio.TimeoutError:
                continue

    async def start(self) -> None:
        if not settings.watcher_enabled or (self._task and not self._task.done()):
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._loop(), name="alphaarena-pulse-watcher")

    async def stop(self) -> None:
        if not self._task:
            return
        self._stop.set()
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None


pulse_watcher = PulseWatcher()
