from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from app.config import settings
from app.services.signal import bitget_signal
from app.services.vibe import UNDERLYING


logger = logging.getLogger(__name__)


class SignalWarmer:
    """Keep Bitget Signal snapshots warm so requests hit cache.

    Individual Signal tool calls take ~15-21s against the public MCP, while
    NightWatch/MarketTwin allow only 4s per request. Without warming, Signal
    context systematically misses the budget and analyses report
    ``signal: unavailable`` even though the endpoint is reachable. The warmer
    refreshes every supported symbol in parallel ahead of time, so requests
    serve evidence from cache in milliseconds.

    The warmer only performs public MCP reads. It never invokes the LLM
    client, so the zero-scheduled-LLM-calls guarantee is preserved.
    """

    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._stop = asyncio.Event()
        self._last_run: str | None = None
        self._last_error: str | None = None
        self._warmed_symbols: int = 0

    @property
    def interval_seconds(self) -> int:
        return max(120, settings.signal_cache_seconds - 60)

    @property
    def status(self) -> dict[str, Any]:
        return {
            "enabled": bool(settings.bitget_signal_mcp_url),
            "running": self._task is not None and not self._task.done(),
            "interval_seconds": self.interval_seconds,
            "last_run": self._last_run,
            "last_error": self._last_error,
            "warmed_symbols": self._warmed_symbols,
        }

    async def run_once(self) -> int:
        if not settings.bitget_signal_mcp_url:
            return 0
        results = await asyncio.gather(
            *(bitget_signal.snapshot(symbol) for symbol in UNDERLYING),
            return_exceptions=True,
        )
        warmed = 0
        failures = 0
        for result in results:
            if isinstance(result, Exception):
                failures += 1
            elif isinstance(result, dict) and result.get("connected"):
                warmed += 1
            else:
                failures += 1
        self._warmed_symbols = warmed
        self._last_run = datetime.now(timezone.utc).isoformat()
        self._last_error = None if failures == 0 else f"{failures}/{len(results)} symbol snapshots unavailable"
        logger.info("Signal cache warming: %d/%d symbols connected", warmed, len(results))
        return warmed

    async def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                await self.run_once()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self._last_error = f"Signal warming failed: {type(exc).__name__}"
                self._last_run = datetime.now(timezone.utc).isoformat()
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self.interval_seconds)
            except asyncio.TimeoutError:
                continue

    async def start(self) -> None:
        if not settings.bitget_signal_mcp_url or (self._task and not self._task.done()):
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._loop(), name="alphaarena-signal-warmer")

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


signal_warmer = SignalWarmer()
