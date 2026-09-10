from __future__ import annotations

import asyncio
import json
import re
from typing import Any

import httpx

from app.config import settings
from app.services.budget import BudgetExhausted, qwen_budget


class QwenError(RuntimeError):
    pass


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        value = json.loads(text)
        if isinstance(value, dict):
            return value
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            value = json.loads(text[start : end + 1])
            if isinstance(value, dict):
                return value
        except json.JSONDecodeError:
            pass
    raise QwenError("AI reasoning returned an unreadable response")


class QwenClient:
    @property
    def enabled(self) -> bool:
        return settings.qwen_enabled

    async def complete_json(self, *, system: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        if not self.enabled:
            return None

        url = f"{settings.qwen_base_url.rstrip('/')}/chat/completions"
        body = {
            "model": settings.qwen_model,
            "temperature": 0.2,
            "max_tokens": max(1, settings.qwen_max_output_tokens),
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False, default=str)},
            ],
        }

        attempts = max(1, settings.qwen_max_attempts_per_request)
        last_error = "AI reasoning is temporarily unavailable"
        for attempt in range(attempts):
            try:
                await qwen_budget.acquire_attempt()
            except BudgetExhausted as exc:
                raise QwenError(str(exc)) from exc

            try:
                timeout = httpx.Timeout(
                    settings.qwen_timeout_seconds,
                    connect=min(10.0, settings.qwen_timeout_seconds),
                )
                async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                    response = await client.post(
                        url,
                        headers={
                            "Authorization": f"Bearer {settings.qwen_api_key}",
                            "Content-Type": "application/json",
                        },
                        json=body,
                    )
            except httpx.HTTPError as exc:
                last_error = "AI reasoning could not connect"
                if attempt + 1 < attempts:
                    await asyncio.sleep(0.5 * (2**attempt))
                    continue
                raise QwenError(last_error) from exc

            if response.status_code < 400:
                try:
                    data = response.json()
                    text = data["choices"][0]["message"]["content"]
                except (ValueError, KeyError, IndexError, TypeError) as exc:
                    raise QwenError("AI reasoning returned an unreadable response") from exc
                return _extract_json(str(text))

            if response.status_code == 429:
                last_error = "AI reasoning is busy right now"
            elif response.status_code in {401, 403}:
                last_error = "AI reasoning is not configured correctly"
            else:
                last_error = "AI reasoning is temporarily unavailable"

            retryable = response.status_code in {408, 409, 429} or response.status_code >= 500
            if retryable and attempt + 1 < attempts:
                await asyncio.sleep(0.5 * (2**attempt))
                continue
            raise QwenError(last_error)

        raise QwenError(last_error)


qwen = QwenClient()
