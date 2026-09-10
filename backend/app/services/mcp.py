from __future__ import annotations

import json
from typing import Any

import httpx

from app.config import settings


class MCPError(RuntimeError):
    pass


class MCPHttpClient:
    """Minimal Streamable HTTP MCP client for Bitget Signal and Vibe-Trading.

    It supports JSON and SSE responses, preserves the MCP session id returned by
    the server and deliberately exposes only tools/list + tools/call.
    """

    def __init__(self, url: str, name: str) -> None:
        self.url = url
        self.name = name
        self.session_id: str | None = None
        self.initialized = False
        self._next_id = 1

    def _id(self) -> int:
        value = self._next_id
        self._next_id += 1
        return value

    @staticmethod
    def _decode_response(response: httpx.Response) -> dict[str, Any]:
        text = response.text.strip()
        if not text:
            return {}
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            return response.json()
        # Streamable HTTP servers may return text/event-stream.
        candidates: list[dict[str, Any]] = []
        for line in text.splitlines():
            if not line.startswith("data:"):
                continue
            raw = line[5:].strip()
            if not raw or raw == "[DONE]":
                continue
            try:
                candidates.append(json.loads(raw))
            except json.JSONDecodeError:
                continue
        if candidates:
            return candidates[-1]
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise MCPError(f"{response.request.url} returned an unreadable MCP response") from exc

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
        }
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id
        async with httpx.AsyncClient(timeout=settings.mcp_timeout_seconds) as client:
            response = await client.post(self.url, headers=headers, json=payload)
        if response.status_code >= 400:
            raise MCPError(f"{self.name} MCP HTTP {response.status_code}: {response.text[:300]}")
        session_id = response.headers.get("mcp-session-id") or response.headers.get("Mcp-Session-Id")
        if session_id:
            self.session_id = session_id
        data = self._decode_response(response)
        if data.get("error"):
            raise MCPError(f"{self.name} MCP error: {data['error']}")
        return data

    async def initialize(self) -> None:
        if self.initialized:
            return
        await self._post({
            "jsonrpc": "2.0",
            "id": self._id(),
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "AlphaArena", "version": "0.2.0"},
            },
        })
        await self._post({
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {},
        })
        self.initialized = True

    async def list_tools(self) -> list[dict[str, Any]]:
        await self.initialize()
        data = await self._post({
            "jsonrpc": "2.0",
            "id": self._id(),
            "method": "tools/list",
            "params": {},
        })
        return ((data.get("result") or {}).get("tools") or [])

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        await self.initialize()
        data = await self._post({
            "jsonrpc": "2.0",
            "id": self._id(),
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments or {}},
        })
        result = data.get("result") or {}
        if result.get("isError"):
            raise MCPError(f"{self.name}.{name} failed: {result}")
        content = result.get("content") or []
        texts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                texts.append(str(item.get("text", "")))
        if texts:
            joined = "\n".join(texts)
            try:
                return json.loads(joined)
            except json.JSONDecodeError:
                return joined
        return result.get("structuredContent", result)
