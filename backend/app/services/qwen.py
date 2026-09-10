from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings
from app.services.budget import BudgetExhausted, qwen_budget


logger = logging.getLogger(__name__)


_USER_MESSAGES = {
    "authentication": "AI analysis is not configured correctly.",
    "invalid_model": "AI analysis is not configured correctly.",
    "rate_limit": "AI analysis is busy right now. Your market evidence is still available. Try again.",
    "timeout": "AI analysis couldn't finish this time. Your market evidence is still available. Try again.",
    "network": "AI analysis couldn't connect this time. Your market evidence is still available. Try again.",
    "empty_structured_output": "AI analysis returned no usable result. Your market evidence is still available. Try again.",
    "malformed_structured_output": "AI analysis returned no usable result. Your market evidence is still available. Try again.",
    "upstream_5xx": "AI analysis is temporarily unavailable. Your market evidence is still available. Try again.",
    "upstream": "AI analysis is temporarily unavailable. Your market evidence is still available. Try again.",
    "budget_exhausted": "The daily AlphaArena AI safety budget has been reached. Deterministic analysis remains available.",
}


class QwenError(RuntimeError):
    """Safe model failure with a machine-readable internal category."""

    def __init__(self, code: str, *, status_code: int | None = None, upstream_code: str | None = None) -> None:
        self.code = code
        self.status_code = status_code
        self.upstream_code = upstream_code
        super().__init__(_USER_MESSAGES.get(code, _USER_MESSAGES["upstream"]))

    @property
    def diagnostic(self) -> dict[str, object]:
        details: dict[str, object] = {"code": self.code}
        if self.status_code is not None:
            details["status_code"] = self.status_code
        if self.upstream_code:
            details["upstream_code"] = self.upstream_code
        return details


def _extract_json(content: object) -> dict[str, Any]:
    if isinstance(content, dict):
        return content
    if content is None or not isinstance(content, str) or not content.strip():
        raise QwenError("empty_structured_output")

    text = content.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.IGNORECASE | re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    try:
        value = json.loads(text)
        if isinstance(value, dict):
            return value
    except json.JSONDecodeError:
        pass

    # Last-resort compatibility for providers that wrap an otherwise valid
    # JSON object in a short preface/suffix. raw_decode avoids greedy brace
    # slicing and never executes model-controlled text.
    decoder = json.JSONDecoder()
    for match in re.finditer(r"\{", text):
        try:
            value, _ = decoder.raw_decode(text[match.start() :])
            if isinstance(value, dict):
                return value
        except json.JSONDecodeError:
            continue
    raise QwenError("malformed_structured_output")


def _safe_upstream_code(response: httpx.Response) -> str | None:
    try:
        payload = response.json()
    except ValueError:
        return None
    if not isinstance(payload, dict) or not isinstance(payload.get("error"), dict):
        return None
    error = payload["error"]
    candidate = error.get("code") or error.get("type")
    if not isinstance(candidate, str):
        return None
    cleaned = re.sub(r"[^a-zA-Z0-9_.-]", "", candidate)[:80]
    return cleaned or None


def _looks_like_invalid_model(response: httpx.Response, upstream_code: str | None) -> bool:
    if upstream_code and "model" in upstream_code.lower():
        return True
    try:
        payload = response.json()
        message = payload.get("error", {}).get("message", "") if isinstance(payload, dict) else ""
    except (AttributeError, ValueError):
        return False
    return isinstance(message, str) and "model" in message[:500].lower()


class QwenClient:
    def __init__(self, *, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._transport = transport
        self._last_error: dict[str, object] | None = None

    @property
    def enabled(self) -> bool:
        return settings.qwen_enabled

    @property
    def provider(self) -> str:
        return settings.qwen_provider

    def diagnostics(self) -> dict[str, object]:
        return {
            "configured": self.enabled,
            "provider": self.provider,
            "model": settings.qwen_model,
            "last_error": dict(self._last_error) if self._last_error else None,
        }

    def _remember_error(self, error: QwenError) -> None:
        self._last_error = {
            **error.diagnostic,
            "provider": self.provider,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        logger.warning(
            "Qwen request failed code=%s provider=%s status=%s upstream_code=%s",
            error.code,
            self.provider,
            error.status_code,
            error.upstream_code,
        )

    def _request_body(self, *, system: str, payload: dict[str, Any]) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": settings.qwen_model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False, default=str)},
            ],
        }
        if self.provider in {"groq", "openai"}:
            body["max_completion_tokens"] = max(1, settings.qwen_max_output_tokens)
        else:
            body["max_tokens"] = max(1, settings.qwen_max_output_tokens)
        if self.provider == "groq":
            # Groq JSON mode rejects raw reasoning. Hidden keeps chain-of-thought
            # out of message.content and out of user-visible responses.
            body["reasoning_format"] = "hidden"
        return body

    @staticmethod
    def _result_from_response(response: httpx.Response) -> dict[str, Any]:
        try:
            data = response.json()
            message = data["choices"][0]["message"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise QwenError("malformed_structured_output") from exc
        if not isinstance(message, dict):
            raise QwenError("malformed_structured_output")

        # Some OpenAI-compatible SDK/proxy layers expose a parsed JSON object.
        # Never fall back to message.reasoning: it is not the final answer.
        content = message.get("content")
        if (content is None or content == "") and isinstance(message.get("parsed"), dict):
            content = message["parsed"]
        return _extract_json(content)

    async def complete_json(self, *, system: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        if not self.enabled:
            return None

        url = f"{settings.qwen_base_url.rstrip('/')}/chat/completions"
        body = self._request_body(system=system, payload=payload)

        attempts = max(1, settings.qwen_max_attempts_per_request)
        last_error = "upstream"
        for attempt in range(attempts):
            try:
                await qwen_budget.acquire_attempt()
            except BudgetExhausted as exc:
                error = QwenError("budget_exhausted")
                self._remember_error(error)
                raise error from exc

            try:
                timeout = httpx.Timeout(
                    settings.qwen_timeout_seconds,
                    connect=min(10.0, settings.qwen_timeout_seconds),
                )
                async with httpx.AsyncClient(
                    timeout=timeout,
                    follow_redirects=True,
                    transport=self._transport,
                ) as client:
                    response = await client.post(
                        url,
                        headers={
                            "Authorization": f"Bearer {settings.qwen_api_key}",
                            "Content-Type": "application/json",
                        },
                        json=body,
                    )
            except httpx.TimeoutException as exc:
                error = QwenError("timeout")
                last_error = error.code
                if attempt + 1 < attempts:
                    await asyncio.sleep(0.5 * (2**attempt))
                    continue
                self._remember_error(error)
                raise error from exc
            except httpx.RequestError as exc:
                error = QwenError("network")
                last_error = error.code
                if attempt + 1 < attempts:
                    await asyncio.sleep(0.5 * (2**attempt))
                    continue
                self._remember_error(error)
                raise error from exc

            if response.status_code < 400:
                try:
                    result = self._result_from_response(response)
                except QwenError as error:
                    self._remember_error(error)
                    raise
                self._last_error = None
                return result

            upstream_code = _safe_upstream_code(response)
            if response.status_code == 429:
                error = QwenError("rate_limit", status_code=429, upstream_code=upstream_code)
            elif response.status_code in {401, 403}:
                error = QwenError("authentication", status_code=response.status_code, upstream_code=upstream_code)
            elif response.status_code in {400, 404} and _looks_like_invalid_model(response, upstream_code):
                error = QwenError("invalid_model", status_code=response.status_code, upstream_code=upstream_code)
            elif response.status_code >= 500:
                error = QwenError("upstream_5xx", status_code=response.status_code, upstream_code=upstream_code)
            else:
                error = QwenError("upstream", status_code=response.status_code, upstream_code=upstream_code)
            last_error = error.code

            retryable = response.status_code in {408, 409, 429} or response.status_code >= 500
            if retryable and attempt + 1 < attempts:
                await asyncio.sleep(0.5 * (2**attempt))
                continue
            self._remember_error(error)
            raise error

        error = QwenError(last_error)
        self._remember_error(error)
        raise error


qwen = QwenClient()
