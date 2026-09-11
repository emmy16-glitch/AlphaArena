from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.config import settings


class BudgetExhausted(RuntimeError):
    pass


@dataclass
class _DailyState:
    day: str
    attempts: int = 0


class QwenBudget:
    """Application-side fuse for AI calls.

    This protects a hackathon deployment from accidental loops/retries. It is
    deliberately reported as per API process: provider billing/quota remains the
    external source of truth, and a horizontally scaled deployment needs a
    shared persistent counter before increasing the limit.
    """

    def __init__(self) -> None:
        self._state = _DailyState(day=self._today())
        self._lock = asyncio.Lock()

    @staticmethod
    def _today() -> str:
        return datetime.now(timezone.utc).date().isoformat()

    @staticmethod
    def _reset_time() -> str:
        now = datetime.now(timezone.utc)
        tomorrow = datetime.combine(now.date() + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        return tomorrow.isoformat()

    async def acquire_attempt(self) -> None:
        async with self._lock:
            today = self._today()
            if self._state.day != today:
                self._state = _DailyState(day=today)
            limit = max(0, settings.qwen_daily_attempt_limit)
            if self._state.attempts >= limit:
                raise BudgetExhausted(
                    "The daily AlphaArena AI safety budget has been reached. Deterministic analysis remains available."
                )
            self._state.attempts += 1

    async def status(self) -> dict[str, object]:
        async with self._lock:
            today = self._today()
            if self._state.day != today:
                self._state = _DailyState(day=today)
            used = self._state.attempts
        limit = max(0, settings.qwen_daily_attempt_limit)
        return {
            "configured": settings.qwen_enabled,
            "daily_attempt_limit": limit,
            "attempts_used_today": used,
            "attempts_remaining_today": max(0, limit - used),
            "max_output_tokens_per_attempt": max(1, settings.qwen_max_output_tokens),
            "max_attempts_per_request": max(1, settings.qwen_max_attempts_per_request),
            "resets_at": self._reset_time(),
            "accounting_scope": "per-api-process safety fuse; provider billing remains source of truth",
        }

    async def reset_for_tests(self) -> None:
        async with self._lock:
            self._state = _DailyState(day=self._today())


qwen_budget = QwenBudget()
