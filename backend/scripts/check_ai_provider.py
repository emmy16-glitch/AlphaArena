"""One-call manual smoke check for the configured Qwen inference provider."""

from __future__ import annotations

import asyncio

from app.config import settings
from app.services.qwen import QwenError, qwen


async def main() -> int:
    if not qwen.enabled:
        print("FAIL: QWEN_API_KEY is not configured; no model call was made.")
        return 1

    try:
        result = await qwen.complete_json(
            system="Return one valid JSON object only. Do not include reasoning.",
            payload={"task": "Return exactly one boolean field named ok with value true."},
        )
    except QwenError as exc:
        print(f"FAIL: provider={qwen.provider} model={settings.qwen_model} category={exc.code}")
        return 1

    if isinstance(result, dict) and result.get("ok") is True:
        print(f"PASS: provider={qwen.provider} model={settings.qwen_model} structured_json=true")
        return 0
    print(f"FAIL: provider={qwen.provider} model={settings.qwen_model} structured_json=false")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
