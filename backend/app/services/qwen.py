from __future__ import annotations

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
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False, default=str)},
            ],
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {settings.qwen_api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        if response.status_code >= 400:
            raise QwenError(f"Qwen HTTP {response.status_code}: {response.text[:400]}")
        data = response.json()
        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise QwenError("Qwen response did not contain a chat message") from exc
        return _extract_json(str(text))


qwen = QwenClient()
