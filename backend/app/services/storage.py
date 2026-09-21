from __future__ import annotations

import asyncio
from collections import defaultdict
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncIterator
from uuid import uuid4

from app.config import settings

try:
    from pymongo import MongoClient, ReturnDocument
    from pymongo.errors import DuplicateKeyError
except Exception:
    MongoClient = None  # type: ignore[assignment]
    ReturnDocument = None  # type: ignore[assignment]
    DuplicateKeyError = Exception  # type: ignore[assignment,misc]


class AlphaStore:
    """Small repository abstraction with MongoDB + in-process fallback.

    Memory keeps the app usable before Atlas is configured. All memory mutations
    are protected by one asyncio lock, and Mongo failures fail over without
    deleting the current session's data.
    """

    def __init__(self) -> None:
        self._memory: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
        self._lock = asyncio.Lock()
        self._player_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._mongo = None
        self._mongo_client = None
        if settings.mongodb_uri and MongoClient is not None:
            try:
                self._mongo_client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=2500)
                self._mongo_client.admin.command("ping")
                self._mongo = self._mongo_client[settings.mongodb_db]
            except Exception:
                self._mongo = None
                self._mongo_client = None

    @property
    def mode(self) -> str:
        return "mongodb+memory" if self._mongo is not None else "memory"

    @property
    def durable(self) -> bool:
        return self._mongo is not None

    @asynccontextmanager
    async def player_lock(self, player_id: str, ttl_seconds: int = 15) -> AsyncIterator[None]:
        """Serialize paper-capital reservations locally and across Mongo workers."""
        local = self._player_locks[player_id]
        await local.acquire()
        token = uuid4().hex
        acquired_remote = False
        try:
            if self._mongo is not None and ReturnDocument is not None:
                collection = self._mongo["_player_locks"]
                deadline = asyncio.get_running_loop().time() + 5.0
                while asyncio.get_running_loop().time() < deadline:
                    now = datetime.now(timezone.utc)
                    expires = now + timedelta(seconds=max(5, ttl_seconds))
                    try:
                        doc = await asyncio.to_thread(
                            collection.find_one_and_update,
                            {
                                "_id": f"player:{player_id}",
                                "$or": [
                                    {"expires_at": {"$lte": now}},
                                    {"owner": token},
                                ],
                            },
                            {"$set": {"owner": token, "expires_at": expires}},
                            upsert=True,
                            return_document=ReturnDocument.AFTER,
                        )
                        if doc and doc.get("owner") == token:
                            acquired_remote = True
                            break
                    except DuplicateKeyError:
                        pass
                    await asyncio.sleep(0.05)
                if not acquired_remote:
                    raise TimeoutError("Could not acquire player capital lock")
            yield
        finally:
            if acquired_remote and self._mongo is not None:
                try:
                    await asyncio.to_thread(
                        self._mongo["_player_locks"].delete_one,
                        {"_id": f"player:{player_id}", "owner": token},
                    )
                except Exception:
                    pass
            local.release()

    async def save(self, collection: str, key: str, value: dict[str, Any]) -> None:
        async with self._lock:
            self._memory[collection][key] = deepcopy(value)
        if self._mongo is None:
            return
        document = deepcopy(value)
        document["_id"] = key
        try:
            await asyncio.to_thread(self._mongo[collection].replace_one, {"_id": key}, document, upsert=True)
        except Exception:
            return

    async def list(self, collection: str, limit: int = 200) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        if self._mongo is not None:
            try:
                mongo_rows = await asyncio.to_thread(lambda: list(self._mongo[collection].find({}).limit(max(limit, 1))))
                for row in mongo_rows:
                    row.pop("_id", None)
                    rows.append(row)
            except Exception:
                rows = []
        async with self._lock:
            memory_rows = [deepcopy(value) for value in self._memory[collection].values()]

        by_id: dict[str, dict[str, Any]] = {}
        for row in rows + memory_rows:
            key = str(row.get("id") or row.get("battle_id") or "")
            if key:
                by_id[key] = row
            else:
                by_id[f"anon-{len(by_id)}"] = row
        merged = list(by_id.values())
        merged.sort(key=lambda row: str(row.get("created_at") or row.get("generated_at") or row.get("updated_at") or ""), reverse=True)
        return merged[: max(0, limit)]

    async def get(self, collection: str, key: str) -> dict[str, Any] | None:
        async with self._lock:
            memory = self._memory[collection].get(key)
            if memory is not None:
                return deepcopy(memory)
        if self._mongo is not None:
            try:
                row = await asyncio.to_thread(self._mongo[collection].find_one, {"_id": key})
                if row:
                    row.pop("_id", None)
                    return row
            except Exception:
                pass
        return None

    async def clear_memory(self) -> None:
        """Test helper; does not delete persistent MongoDB data."""
        async with self._lock:
            self._memory.clear()


store = AlphaStore()
