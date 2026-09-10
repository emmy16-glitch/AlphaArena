from __future__ import annotations

import asyncio
from collections import defaultdict
from copy import deepcopy
from typing import Any

from app.config import settings

try:
    from pymongo import MongoClient
except Exception:  # dependency/config problems should not block the hackathon preview
    MongoClient = None  # type: ignore[assignment]


class AlphaStore:
    def __init__(self) -> None:
        self._memory: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
        self._mongo = None
        if settings.mongodb_uri and MongoClient is not None:
            try:
                client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=2500)
                self._mongo = client[settings.mongodb_db]
            except Exception:
                self._mongo = None

    async def save(self, collection: str, key: str, value: dict[str, Any]) -> None:
        self._memory[collection][key] = deepcopy(value)
        if self._mongo is None:
            return
        document = deepcopy(value)
        document["_id"] = key
        try:
            await asyncio.to_thread(self._mongo[collection].replace_one, {"_id": key}, document, True)
        except Exception:
            # Memory remains the availability fallback; a transient Atlas issue
            # should not erase the user's active session.
            return

    async def list(self, collection: str, limit: int = 200) -> list[dict[str, Any]]:
        if self._mongo is not None:
            try:
                rows = await asyncio.to_thread(lambda: list(self._mongo[collection].find({}).sort("created_at", -1).limit(limit)))
                cleaned = []
                for row in rows:
                    row.pop("_id", None)
                    cleaned.append(row)
                # Merge any current-session records not flushed/read from Atlas yet.
                by_id = {str(row.get("id")): row for row in cleaned if row.get("id")}
                for key, value in self._memory[collection].items():
                    by_id[key] = deepcopy(value)
                return list(by_id.values())[:limit]
            except Exception:
                pass
        return [deepcopy(value) for value in list(self._memory[collection].values())[-limit:]][::-1]

    async def get(self, collection: str, key: str) -> dict[str, Any] | None:
        if key in self._memory[collection]:
            return deepcopy(self._memory[collection][key])
        if self._mongo is not None:
            try:
                row = await asyncio.to_thread(self._mongo[collection].find_one, {"_id": key})
                if row:
                    row.pop("_id", None)
                    return row
            except Exception:
                pass
        return None


store = AlphaStore()
