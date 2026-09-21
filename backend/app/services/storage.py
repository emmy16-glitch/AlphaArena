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
        except Exception as exc:
            if settings.require_persistent_storage:
                raise RuntimeError("Persistent storage write failed") from exc
            return

    async def list(self, collection: str, limit: int = 200) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        if self._mongo is not None:
            try:
                mongo_rows = await asyncio.to_thread(lambda: list(self._mongo[collection].find({}).limit(max(limit, 1))))
                for row in mongo_rows:
                    row.pop("_id", None)
                    rows.append(row)
            except Exception as exc:
                if settings.require_persistent_storage:
                    raise RuntimeError("Persistent storage list failed") from exc
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
            except Exception as exc:
                if settings.require_persistent_storage:
                    raise RuntimeError("Persistent storage read failed") from exc
        return None

    async def list_due_decision_evaluations(
        self,
        player_id: str,
        due_before: str,
        limit: int = 500,
    ) -> list[dict[str, Any]]:
        """Return pending Decision Tape jobs by due time, not by creation age."""
        rows: list[dict[str, Any]] = []
        safe_limit = max(1, min(5000, int(limit)))
        if self._mongo is not None:
            try:
                def query() -> list[dict[str, Any]]:
                    cursor = (
                        self._mongo["decision_evaluations"]
                        .find({
                            "player_id": player_id,
                            "status": "pending",
                            "due_at": {"$lte": due_before},
                        })
                        .sort("due_at", 1)
                        .limit(safe_limit)
                    )
                    return list(cursor)

                mongo_rows = await asyncio.to_thread(query)
                for row in mongo_rows:
                    row.pop("_id", None)
                    rows.append(row)
            except Exception as exc:
                if settings.require_persistent_storage:
                    raise RuntimeError("Persistent evaluation queue read failed") from exc

        async with self._lock:
            memory_rows = [
                deepcopy(row)
                for row in self._memory["decision_evaluations"].values()
                if str(row.get("player_id") or "") == player_id
                and row.get("status") == "pending"
                and str(row.get("due_at") or "") <= due_before
            ]
        by_id: dict[str, dict[str, Any]] = {}
        for row in rows + memory_rows:
            key = str(row.get("id") or row.get("decision_id") or "")
            if key:
                by_id[key] = row
        due = list(by_id.values())
        due.sort(key=lambda row: str(row.get("due_at") or ""))
        return due[:safe_limit]

    async def record_decision_metric(
        self,
        *,
        player_id: str,
        lane: str,
        horizon: str,
        decision_id: str,
        correct: bool,
        signed_return_pct: float,
        brier: float,
    ) -> bool:
        """Idempotently accumulate one matured Decision Tape observation."""
        event_id = f"{decision_id}:{horizon}"
        metric_id = f"{player_id}:{lane}:{horizon}"
        now = datetime.now(timezone.utc).isoformat()

        async def record_memory() -> bool:
            async with self._lock:
                if event_id in self._memory["decision_metric_events"]:
                    return False
                self._memory["decision_metric_events"][event_id] = {
                    "id": event_id,
                    "decision_id": decision_id,
                    "horizon": horizon,
                    "created_at": now,
                }
                row = self._memory["decision_metrics"].setdefault(
                    metric_id,
                    {
                        "id": metric_id,
                        "player_id": player_id,
                        "lane": lane,
                        "horizon": horizon,
                        "n": 0,
                        "hits": 0,
                        "signed_return_sum": 0.0,
                        "brier_sum": 0.0,
                        "updated_at": now,
                    },
                )
                row["n"] = int(row.get("n") or 0) + 1
                row["hits"] = int(row.get("hits") or 0) + (1 if correct else 0)
                row["signed_return_sum"] = float(row.get("signed_return_sum") or 0) + float(signed_return_pct)
                row["brier_sum"] = float(row.get("brier_sum") or 0) + float(brier)
                row["updated_at"] = now
                return True

        if self._mongo is None:
            return await record_memory()

        events = self._mongo["decision_metric_events"]
        metrics = self._mongo["decision_metrics"]
        inserted_remote = False
        try:
            await asyncio.to_thread(
                events.insert_one,
                {
                    "_id": event_id,
                    "id": event_id,
                    "decision_id": decision_id,
                    "horizon": horizon,
                    "created_at": now,
                },
            )
            inserted_remote = True
            await asyncio.to_thread(
                metrics.update_one,
                {"_id": metric_id},
                {
                    "$setOnInsert": {
                        "id": metric_id,
                        "player_id": player_id,
                        "lane": lane,
                        "horizon": horizon,
                    },
                    "$inc": {
                        "n": 1,
                        "hits": 1 if correct else 0,
                        "signed_return_sum": float(signed_return_pct),
                        "brier_sum": float(brier),
                    },
                    "$set": {"updated_at": now},
                },
                upsert=True,
            )
        except DuplicateKeyError:
            return False
        except Exception as exc:
            if inserted_remote:
                try:
                    await asyncio.to_thread(events.delete_one, {"_id": event_id})
                except Exception:
                    pass
            if settings.require_persistent_storage:
                raise RuntimeError("Persistent decision-metric update failed") from exc
            return await record_memory()

        # Mongo is authoritative for cumulative counters. Do not mirror a
        # partial process-local count over the durable aggregate because the
        # generic repository merge intentionally prefers local values for
        # ordinary write-through documents.
        return True

    async def clear_memory(self) -> None:
        """Test helper; does not delete persistent MongoDB data."""
        async with self._lock:
            self._memory.clear()


store = AlphaStore()
