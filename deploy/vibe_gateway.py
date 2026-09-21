from __future__ import annotations

import os

import httpx
from fastapi import FastAPI, Request, Response

app = FastAPI(title="AlphaArena Vibe Gateway", docs_url=None, redoc_url=None)

UPSTREAM = os.getenv("VIBE_UPSTREAM_URL", "http://127.0.0.1:8901/mcp")
TOKEN = os.getenv("VIBE_PROXY_TOKEN", "").strip()


def _authorized(request: Request) -> bool:
    if not TOKEN:
        return False
    return request.headers.get("authorization") == f"Bearer {TOKEN}"


@app.get("/health")
async def health() -> dict[str, object]:
    return {"status": "ok", "protected": bool(TOKEN)}


@app.api_route("/mcp", methods=["GET", "POST", "DELETE"])
async def proxy_mcp(request: Request) -> Response:
    if not _authorized(request):
        return Response(status_code=401, content="Unauthorized")

    headers: dict[str, str] = {
        "accept": request.headers.get("accept", "application/json, text/event-stream"),
        "content-type": request.headers.get("content-type", "application/json"),
    }
    for name in ("mcp-session-id", "mcp-protocol-version", "last-event-id"):
        value = request.headers.get(name)
        if value:
            headers[name] = value

    try:
        async with httpx.AsyncClient(timeout=35.0, follow_redirects=True) as client:
            upstream = await client.request(
                request.method,
                UPSTREAM,
                headers=headers,
                content=await request.body(),
            )
    except httpx.HTTPError:
        return Response(status_code=502, content="Vibe upstream unavailable")

    passthrough: dict[str, str] = {}
    for name in ("content-type", "mcp-session-id", "mcp-protocol-version", "cache-control"):
        value = upstream.headers.get(name)
        if value:
            passthrough[name] = value

    return Response(
        status_code=upstream.status_code,
        content=upstream.content,
        headers=passthrough,
    )
