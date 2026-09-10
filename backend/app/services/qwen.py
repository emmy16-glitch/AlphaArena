from __future__ import annotations

import asyncio
import json
import re
from typing import Any

import httpx

from app.config import settings


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
    raise QwenError("Qwen returned text that was not valid JSON")


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
            "max_tokens": 3500,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False, default=str)},
            ],
        }

        last_error = "Qwen request failed"
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                    response = await client.post(
                        url,
                        headers={
                            "Authorization": f"Bearer {settings.qwen_api_key}",
                            "Content-Type": "application/json",
                        },
                        json=body,
                    )
            except httpx.HTTPError as exc:
                last_error = f"Qwen network error: {exc}"
                if attempt < 2:
                    await asyncio.sleep(0.6 * (2 ** attempt))
                    continue
                raise QwenError(last_error) from exc

            if response.status_code < 400:
                try:
                    data = response.json()
                    text = data["choices"][0]["message"]["content"]
                except (ValueError, KeyError, IndexError, TypeError) as exc:
                    raise QwenError("Qwen response did not contain a valid chat message") from exc
                return _extract_json(str(text))

            last_error = f"Qwen HTTP {response.status_code}: {response.text[:400]}"
            if response.status_code in {408, 409, 429} or response.status_code >= 500:
                if attempt < 2:
                    await asyncio.sleep(0.6 * (2 ** attempt))
                    continue
            raise QwenError(last_error)

        raise QwenError(last_error)


qwen = QwenClient()
