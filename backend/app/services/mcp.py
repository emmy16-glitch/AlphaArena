from __future__ import annotations

import json
from typing import Any

import httpx

from app.config import settings


class MCPError(RuntimeError):
    pass


class MCPHttpClient:
    """Small, fail-closed Streamable HTTP MCP client.

    AlphaArena only needs initialize, tools/list and tools/call. The client
    supports JSON and SSE responses, preserves MCP session ids, and selects the
    JSON-RPC response matching the request id instead of accidentally consuming
    a progress notification from an SSE stream.
    """

    def __init__(self, url: str, name: str) -> None:
        self.url = url
        self.name = name
        self.session_id: str | None = None
        self.protocol_version: str | None = None
        self.initialized = False
        self._next_id = 1

    def _id(self) -> int:
        value = self._next_id
        self._next_id += 1
        return value

    @staticmethod
    def _decode_response(response: httpx.Response, expected_id: int | None = None) -> dict[str, Any]:
        text = response.text.strip()
        if not text:
            return {}
        content_type = response.headers.get("content-type", "").lower()
        if "application/json" in content_type:
            value = response.json()
            return value if isinstance(value, dict) else {}

        candidates: list[dict[str, Any]] = []
        if "text/event-stream" in content_type or "data:" in text:
            data_lines: list[str] = []
            for raw_line in text.splitlines():
                line = raw_line.rstrip("\r")
                if not line:
                    if data_lines:
                        raw = "\n".join(data_lines)
                        data_lines = []
                        if raw != "[DONE]":
                            try:
                                value = json.loads(raw)
                                if isinstance(value, dict):
                                    candidates.append(value)
                            except json.JSONDecodeError:
                                pass
                    continue
                if line.startswith("data:"):
                    data_lines.append(line[5:].lstrip())
            if data_lines:
                try:
                    value = json.loads("\n".join(data_lines))
                    if isinstance(value, dict):
                        candidates.append(value)
                except json.JSONDecodeError:
                    pass

            if expected_id is not None:
                for item in reversed(candidates):
                    if item.get("id") == expected_id:
                        return item
            for item in reversed(candidates):
                if "result" in item or "error" in item:
                    return item
            return candidates[-1] if candidates else {}

        try:
            value = json.loads(text)
        except json.JSONDecodeError as exc:
            raise MCPError(f"{response.request.url} returned an unreadable MCP response") from exc
        return value if isinstance(value, dict) else {}

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
        }
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id
        if self.protocol_version:
            headers["MCP-Protocol-Version"] = self.protocol_version
        async with httpx.AsyncClient(timeout=settings.mcp_timeout_seconds, follow_redirects=True) as client:
            response = await client.post(self.url, headers=headers, json=payload)
        if response.status_code >= 400:
            snippet = response.text.replace("\n", " ")[:300]
            raise MCPError(f"{self.name} MCP HTTP {response.status_code}: {snippet}")
        session_id = response.headers.get("mcp-session-id")
        if session_id:
            self.session_id = session_id
        expected_id = payload.get("id") if isinstance(payload.get("id"), int) else None
        data = self._decode_response(response, expected_id)
        if data.get("error"):
            raise MCPError(f"{self.name} MCP error: {data['error']}")
        return data

    async def initialize(self) -> None:
        if self.initialized:
            return
        request_id = self._id()
        data = await self._post({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "AlphaArena", "version": "0.4.0"},
            },
        })
        result = data.get("result") or {}
        negotiated_version = result.get("protocolVersion")
        if isinstance(negotiated_version, str) and negotiated_version:
            self.protocol_version = negotiated_version

        if data and data.get("id") not in {None, request_id}:
            raise MCPError(f"{self.name} returned a mismatched initialize response")
        await self._post({
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {},
        })
        self.initialized = True

    async def list_tools(self) -> list[dict[str, Any]]:
        await self.initialize()
        request_id = self._id()
        data = await self._post({
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "tools/list",
            "params": {},
        })
        tools = (data.get("result") or {}).get("tools") or []
        return [tool for tool in tools if isinstance(tool, dict)]

    async def has_tools(self, names: set[str]) -> set[str]:
        tools = await self.list_tools()
        available = {str(tool.get("name")) for tool in tools if tool.get("name")}
        return names & available

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        await self.initialize()
        request_id = self._id()
        data = await self._post({
            "jsonrpc": "2.0",
            "id": request_id,
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
