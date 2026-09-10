from __future__ import annotations

import json
from collections.abc import Callable

import httpx
import pytest

from app.config import settings
from app.services.budget import qwen_budget
from app.services.qwen import QwenClient, QwenError


@pytest.fixture(autouse=True)
async def configured_qwen(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_provider", "groq")
    monkeypatch.setattr(settings, "qwen_api_key", "test-secret-never-log")
    monkeypatch.setattr(settings, "qwen_base_url", "https://api.groq.com/openai/v1")
    monkeypatch.setattr(settings, "qwen_model", "qwen/qwen3.6-27b")
    monkeypatch.setattr(settings, "qwen_daily_attempt_limit", 100)
    monkeypatch.setattr(settings, "qwen_max_attempts_per_request", 1)
    monkeypatch.setattr(settings, "qwen_max_output_tokens", 1400)
    monkeypatch.setattr(settings, "qwen_timeout_seconds", 1.0)
    await qwen_budget.reset_for_tests()


def _response(content: object, **message_fields: object) -> httpx.Response:
    return httpx.Response(
        200,
        json={"choices": [{"message": {"content": content, **message_fields}}]},
    )


def _client(handler: Callable[[httpx.Request], httpx.Response]) -> QwenClient:
    return QwenClient(transport=httpx.MockTransport(handler))


async def _complete(client: QwenClient) -> dict[str, object] | None:
    return await client.complete_json(system="Return JSON.", payload={"fact": "grounded"})


@pytest.mark.asyncio
async def test_successful_json_response() -> None:
    result = await _complete(_client(lambda _: _response('{"verdict":"WAIT"}')))
    assert result == {"verdict": "WAIT"}


@pytest.mark.asyncio
async def test_json_fenced_in_markdown() -> None:
    result = await _complete(_client(lambda _: _response('```json\n{"verdict":"LONG"}\n```')))
    assert result == {"verdict": "LONG"}


@pytest.mark.asyncio
async def test_direct_json_object_content() -> None:
    result = await _complete(_client(lambda _: _response({"verdict": "SHORT"})))
    assert result == {"verdict": "SHORT"}


@pytest.mark.asyncio
async def test_harmless_surrounding_text_is_defensively_parsed() -> None:
    result = await _complete(_client(lambda _: _response('Result follows: {"verdict":"WAIT"} done.')))
    assert result == {"verdict": "WAIT"}


@pytest.mark.asyncio
async def test_empty_content_has_specific_error() -> None:
    with pytest.raises(QwenError) as captured:
        await _complete(_client(lambda _: _response("")))
    assert captured.value.code == "empty_structured_output"


@pytest.mark.asyncio
async def test_malformed_content_has_specific_error() -> None:
    with pytest.raises(QwenError) as captured:
        await _complete(_client(lambda _: _response("This is not JSON.")))
    assert captured.value.code == "malformed_structured_output"


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [401, 403])
async def test_authentication_errors_are_classified(status: int) -> None:
    client = _client(lambda _: httpx.Response(status, json={"error": {"code": "invalid_api_key"}}))
    with pytest.raises(QwenError) as captured:
        await _complete(client)
    assert captured.value.code == "authentication"
    assert captured.value.status_code == status


@pytest.mark.asyncio
async def test_rate_limit_is_classified() -> None:
    client = _client(lambda _: httpx.Response(429, json={"error": {"type": "rate_limit_error"}}))
    with pytest.raises(QwenError) as captured:
        await _complete(client)
    assert captured.value.code == "rate_limit"


@pytest.mark.asyncio
async def test_invalid_model_is_classified() -> None:
    client = _client(lambda _: httpx.Response(400, json={"error": {"code": "model_not_found"}}))
    with pytest.raises(QwenError) as captured:
        await _complete(client)
    assert captured.value.code == "invalid_model"


@pytest.mark.asyncio
async def test_upstream_5xx_is_classified() -> None:
    client = _client(lambda _: httpx.Response(503, text="large upstream response intentionally ignored"))
    with pytest.raises(QwenError) as captured:
        await _complete(client)
    assert captured.value.code == "upstream_5xx"
    assert captured.value.status_code == 503


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("exception_type", "code"),
    [(httpx.ReadTimeout, "timeout"), (httpx.ConnectError, "network")],
)
async def test_transport_errors_are_classified(
    exception_type: type[httpx.RequestError],
    code: str,
) -> None:
    def fail(request: httpx.Request) -> httpx.Response:
        raise exception_type("provider unavailable", request=request)

    with pytest.raises(QwenError) as captured:
        await _complete(_client(fail))
    assert captured.value.code == code


@pytest.mark.asyncio
async def test_attempt_budget_increments_once_per_http_attempt() -> None:
    before = await qwen_budget.status()
    await _complete(_client(lambda _: _response('{"ok":true}')))
    after = await qwen_budget.status()
    assert int(after["attempts_used_today"]) == int(before["attempts_used_today"]) + 1


@pytest.mark.asyncio
async def test_retry_count_never_exceeds_configured_maximum(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "qwen_max_attempts_per_request", 2)
    calls = 0

    def unavailable(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503)

    with pytest.raises(QwenError):
        await _complete(_client(unavailable))
    assert calls == 2
    assert int((await qwen_budget.status())["attempts_used_today"]) == 2


@pytest.mark.asyncio
async def test_api_key_never_appears_in_exception_strings() -> None:
    secret = settings.qwen_api_key
    client = _client(lambda _: httpx.Response(401, json={"error": {"message": f"bad key {secret}"}}))
    with pytest.raises(QwenError) as captured:
        await _complete(client)
    assert secret not in str(captured.value)
    assert secret not in repr(captured.value)
    assert secret not in json.dumps(captured.value.diagnostic)


def test_diagnostics_identify_provider_without_credentials() -> None:
    diagnostic = QwenClient().diagnostics()
    assert diagnostic["provider"] == "groq"
    assert diagnostic["model"] == "qwen/qwen3.6-27b"
    assert settings.qwen_api_key not in json.dumps(diagnostic)


@pytest.mark.asyncio
async def test_reasoning_metadata_is_never_used_as_result_content() -> None:
    client = _client(lambda _: _response(None, reasoning='{"verdict":"LONG"}'))
    with pytest.raises(QwenError) as captured:
        await _complete(client)
    assert captured.value.code == "empty_structured_output"


@pytest.mark.asyncio
async def test_parsed_structured_output_is_used_when_content_is_empty() -> None:
    client = _client(lambda _: _response(None, parsed={"verdict": "WAIT"}))
    assert await _complete(client) == {"verdict": "WAIT"}


@pytest.mark.asyncio
async def test_groq_request_uses_json_mode_and_hidden_reasoning() -> None:
    captured_body: dict[str, object] = {}

    def inspect_request(request: httpx.Request) -> httpx.Response:
        captured_body.update(json.loads(request.content))
        return _response('{"ok":true}')

    await _complete(_client(inspect_request))
    assert captured_body["response_format"] == {"type": "json_object"}
    assert captured_body["reasoning_format"] == "hidden"
    assert captured_body["max_completion_tokens"] == 1400
    assert "max_tokens" not in captured_body


@pytest.mark.asyncio
async def test_non_groq_provider_omits_groq_reasoning_parameter(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "ai_provider", "alibaba")
    captured_body: dict[str, object] = {}

    def inspect_request(request: httpx.Request) -> httpx.Response:
        captured_body.update(json.loads(request.content))
        return _response('{"ok":true}')

    await _complete(_client(inspect_request))
    assert captured_body["response_format"] == {"type": "json_object"}
    assert captured_body["max_tokens"] == 1400
    assert "reasoning_format" not in captured_body
    assert "max_completion_tokens" not in captured_body
