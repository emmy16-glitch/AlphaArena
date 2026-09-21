from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from app.services.bitget import bitget_market
from app.services.storage import store


HORIZONS_MINUTES: dict[str, int] = {
    "5m": 5,
    "30m": 30,
    "1h": 60,
    "24h": 24 * 60,
}
WAIT_DEADBAND_PCT = 0.10
GLOBAL_TAPE_PLAYER_ID = "global_market"


def _parse_time(value: Any) -> datetime:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _baseline(asset: dict[str, Any]) -> tuple[str, float, dict[str, float]]:
    """Transparent no-AI benchmark using only observed market movement."""
    change_24h = float(asset.get("changePct") or 0.0)
    spark = [float(v) for v in (asset.get("spark") or []) if isinstance(v, (int, float)) and float(v) > 0]
    short_move = ((spark[-1] / spark[0]) - 1) * 100 if len(spark) >= 2 else 0.0
    score = 0.55 * short_move + 0.45 * change_24h
    threshold = 0.15
    if score > threshold:
        direction = "LONG"
    elif score < -threshold:
        direction = "SHORT"
    else:
        direction = "WAIT"
    confidence = round(max(50.0, min(95.0, 50.0 + abs(score) * 8.0)), 2)
    return direction, confidence, {
        "score": round(score, 6),
        "short_move_pct": round(short_move, 6),
        "change_24h_pct": round(change_24h, 6),
        "threshold_pct": threshold,
    }


def _outcome(direction: str, entry: float, observed: float, confidence: float) -> dict[str, Any]:
    move_pct = ((observed / entry) - 1) * 100 if entry > 0 else 0.0
    if direction == "LONG":
        correct = move_pct > WAIT_DEADBAND_PCT
        signed = move_pct
    elif direction == "SHORT":
        correct = move_pct < -WAIT_DEADBAND_PCT
        signed = -move_pct
    else:
        correct = abs(move_pct) <= WAIT_DEADBAND_PCT
        signed = -abs(move_pct)
    probability = max(0.0, min(1.0, confidence / 100))
    brier = (probability - (1.0 if correct else 0.0)) ** 2
    return {
        "observed_price": round(observed, 8),
        "move_pct": round(move_pct, 6),
        "signed_return_pct": round(signed, 6),
        "correct": correct,
        "confidence": round(confidence, 2),
        "brier": round(brier, 6),
        "wait_deadband_pct": WAIT_DEADBAND_PCT,
    }


class DecisionTapeService:
    async def capture_snapshot(self, symbol: str, player_id: str = "guest_default") -> dict[str, Any]:
        asset = await bitget_market.get_asset(symbol)
        now = datetime.now(timezone.utc)
        snapshot_id = f"snap_{uuid4().hex[:12]}"
        snapshot = {
            "id": snapshot_id,
            "player_id": player_id,
            "symbol": symbol,
            "captured_at": now.isoformat(),
            "market_timestamp": int(asset.get("timestamp") or int(now.timestamp() * 1000)),
            "price": float(asset["price"]),
            "change_pct_24h": float(asset.get("changePct") or 0.0),
            "change_abs_24h": float(asset.get("changeAbs") or 0.0),
            "high24": float(asset.get("high24") or asset["price"]),
            "low24": float(asset.get("low24") or asset["price"]),
            "bid": asset.get("bid"),
            "ask": asset.get("ask"),
            "spread_bps": float(asset.get("spreadBps") or 0.0),
            "turnover24h": float(asset.get("turnover24h") or 0.0),
            "spark": list(asset.get("spark") or [])[-24:],
            "market_data_quality": str(asset.get("marketDataQuality") or "unknown"),
            "source": "bitget",
        }
        await store.save("decision_snapshots", snapshot_id, snapshot)
        direction, confidence, work = _baseline(asset)
        baseline = await self._record(
            snapshot=snapshot,
            lane="baseline",
            direction=direction,
            confidence=confidence,
            model="deterministic-baseline-v1",
            latency_ms=0.0,
            note="Transparent observed-momentum benchmark; not a recommendation.",
            metadata=work,
        )
        return {"snapshot": snapshot, "baseline": baseline}

    async def _record(
        self,
        *,
        snapshot: dict[str, Any],
        lane: str,
        direction: str,
        confidence: float,
        model: str | None,
        latency_ms: float | None,
        note: str | None,
        metadata: dict[str, Any] | None,
    ) -> dict[str, Any]:
        decision_id = f"decision_{uuid4().hex[:12]}"
        decision = {
            "id": decision_id,
            "snapshot_id": snapshot["id"],
            "player_id": snapshot.get("player_id") or "guest_default",
            "scope": "global" if str(snapshot.get("player_id")) == GLOBAL_TAPE_PLAYER_ID else "personal",
            "symbol": snapshot["symbol"],
            "lane": lane,
            "direction": direction,
            "confidence": round(max(0.0, min(100.0, float(confidence))), 2),
            "model": model,
            "latency_ms": None if latency_ms is None else round(max(0.0, float(latency_ms)), 3),
            "note": (note or "")[:500] or None,
            "metadata": metadata or {},
            "entry_price": float(snapshot["price"]),
            "decided_at": datetime.now(timezone.utc).isoformat(),
            "snapshot_captured_at": snapshot["captured_at"],
            "outcomes": {},
        }
        await store.save("decision_tape", decision_id, decision)
        first_label, first_minutes = next(iter(HORIZONS_MINUTES.items()))
        first_due = _parse_time(snapshot["captured_at"]) + timedelta(minutes=first_minutes)
        await store.save(
            "decision_evaluations",
            decision_id,
            {
                "id": decision_id,
                "decision_id": decision_id,
                "player_id": decision["player_id"],
                "next_index": 0,
                "next_horizon": first_label,
                "due_at": first_due.isoformat(),
                "status": "pending",
                "created_at": decision["decided_at"],
                "updated_at": decision["decided_at"],
            },
        )
        return decision

    async def get_snapshot(self, snapshot_id: str, player_id: str = "guest_default") -> dict[str, Any] | None:
        snapshot = await store.get("decision_snapshots", snapshot_id)
        if snapshot is None or str(snapshot.get("player_id") or "guest_default") != player_id:
            return None
        return snapshot

    @staticmethod
    def market_asset(snapshot: dict[str, Any]) -> dict[str, Any]:
        """Rebuild the Bitget-shaped asset view frozen at snapshot capture."""
        price = float(snapshot.get("price") or 0)
        return {
            "symbol": str(snapshot.get("symbol")),
            "price": price,
            "changePct": float(snapshot.get("change_pct_24h") or 0),
            "changeAbs": float(snapshot.get("change_abs_24h") or 0),
            "high24": float(snapshot.get("high24") or price),
            "low24": float(snapshot.get("low24") or price),
            "bid": snapshot.get("bid"),
            "ask": snapshot.get("ask"),
            "spreadBps": float(snapshot.get("spread_bps") or 0),
            "turnover24h": float(snapshot.get("turnover24h") or 0),
            "spark": list(snapshot.get("spark") or []),
            "timestamp": int(snapshot.get("market_timestamp") or 0),
            "source": "bitget-frozen-snapshot",
            "marketDataQuality": str(snapshot.get("market_data_quality") or "unknown"),
        }

    async def submit(
        self,
        snapshot_id: str,
        lane: str,
        direction: str,
        confidence: float,
        *,
        player_id: str = "guest_default",
        model: str | None = None,
        latency_ms: float | None = None,
        note: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        snapshot = await store.get("decision_snapshots", snapshot_id)
        if snapshot is None or str(snapshot.get("player_id") or "guest_default") != player_id:
            raise KeyError("Decision snapshot not found")
        return await self._record(
            snapshot=snapshot,
            lane=lane,
            direction=direction,
            confidence=confidence,
            model=model,
            latency_ms=latency_ms,
            note=note,
            metadata=metadata,
        )

    async def list(
        self,
        player_id: str = "guest_default",
        limit: int = 200,
        *,
        include_global: bool = True,
    ) -> list[dict[str, Any]]:
        rows = []
        for row in await store.list("decision_tape", limit=max(1, min(1000, limit))):
            owner = str(row.get("player_id") or "guest_default")
            if owner == player_id or (include_global and owner == GLOBAL_TAPE_PLAYER_ID):
                rows.append(row)
        rows.sort(key=lambda row: str(row.get("decided_at") or ""), reverse=True)
        return rows

    async def evaluate_due(self, player_id: str = "guest_default") -> list[dict[str, Any]]:
        now = datetime.now(timezone.utc)
        jobs = await store.list_due_decision_evaluations(player_id, now.isoformat(), limit=500)
        updated: list[dict[str, Any]] = []
        horizon_items = list(HORIZONS_MINUTES.items())
        price_cache: dict[tuple[str, int], dict[str, Any]] = {}

        for job in jobs:
            decision = await store.get("decision_tape", str(job.get("decision_id") or job.get("id")))
            if decision is None:
                # Keep the job pending: a transient persistent-read problem
                # should not silently discard an evaluation obligation.
                continue

            captured = _parse_time(decision["snapshot_captured_at"])
            outcomes = dict(decision.get("outcomes") or {})
            index = max(0, int(job.get("next_index") or 0))
            changed = False
            blocked = False

            while index < len(horizon_items):
                label, minutes = horizon_items[index]
                target = captured + timedelta(minutes=minutes)
                if target > now:
                    break

                if label not in outcomes:
                    cache_key = (str(decision["symbol"]), int(target.timestamp() * 1000))
                    observed = price_cache.get(cache_key)
                    if observed is None:
                        try:
                            observed = await bitget_market.get_price_near(cache_key[0], cache_key[1])
                        except Exception:
                            # Leave this horizon queued for a later pass.
                            blocked = True
                            break
                        price_cache[cache_key] = observed

                    result = _outcome(
                        str(decision["direction"]),
                        float(decision["entry_price"]),
                        float(observed["price"]),
                        float(decision["confidence"]),
                    )
                    result.update({
                        "target_at": target.isoformat(),
                        "observed_at": datetime.fromtimestamp(
                            int(observed["timestamp"]) / 1000,
                            tz=timezone.utc,
                        ).isoformat(),
                        "source": observed.get("source"),
                        "granularity": observed.get("granularity"),
                        "selection": observed.get("selection"),
                    })
                    # Metric write is idempotent per decision+horizon. It runs
                    # before the decision/job writes so a retry cannot double
                    # count after a process interruption.
                    await store.record_decision_metric(
                        player_id=str(decision.get("player_id") or "guest_default"),
                        lane=str(decision.get("lane") or "other"),
                        horizon=label,
                        decision_id=str(decision["id"]),
                        correct=bool(result["correct"]),
                        signed_return_pct=float(result["signed_return_pct"]),
                        brier=float(result["brier"]),
                    )
                    outcomes[label] = result
                    changed = True

                index += 1

            if changed:
                decision["outcomes"] = outcomes
                await store.save("decision_tape", str(decision["id"]), decision)
                updated.append(decision)

            job["next_index"] = index
            job["updated_at"] = datetime.now(timezone.utc).isoformat()
            if index >= len(horizon_items):
                job["status"] = "done"
                job["next_horizon"] = None
                job["due_at"] = None
            else:
                next_label, next_minutes = horizon_items[index]
                job["status"] = "pending"
                job["next_horizon"] = next_label
                job["due_at"] = (captured + timedelta(minutes=next_minutes)).isoformat()
                if blocked:
                    # Same due_at is retained, so the next evaluator retries it.
                    pass
            await store.save("decision_evaluations", str(job["id"]), job)

        return updated

    async def summary(self, player_id: str = "guest_default") -> dict[str, Any]:
        await self.evaluate_due(player_id)
        metric_rows = await store.list("decision_metrics", limit=5000)
        owners = {player_id, GLOBAL_TAPE_PLAYER_ID}
        by_lane: dict[str, dict[str, Any]] = {}

        for row in metric_rows:
            if str(row.get("player_id") or "") not in owners:
                continue
            lane = str(row.get("lane") or "other")
            horizon = str(row.get("horizon") or "")
            if horizon not in HORIZONS_MINUTES:
                continue
            lane_row = by_lane.setdefault(lane, {"decisions": 0, "horizons": {}})
            stats = lane_row["horizons"].setdefault(
                horizon,
                {"n": 0, "hits": 0, "signed_return_sum": 0.0, "brier_sum": 0.0},
            )
            stats["n"] += int(row.get("n") or 0)
            stats["hits"] += int(row.get("hits") or 0)
            stats["signed_return_sum"] += float(row.get("signed_return_sum") or 0)
            stats["brier_sum"] += float(row.get("brier_sum") or 0)

        for lane_row in by_lane.values():
            evaluated_counts: list[int] = []
            for stats in lane_row["horizons"].values():
                n = int(stats["n"])
                evaluated_counts.append(n)
                stats["hit_rate_pct"] = round(stats.pop("hits") / n * 100, 2) if n else 0.0
                stats["avg_signed_return_pct"] = round(stats.pop("signed_return_sum") / n, 6) if n else 0.0
                stats["brier_score"] = round(stats.pop("brier_sum") / n, 6) if n else None
            # This means evaluated observations, not total raw calls. It stays
            # truthful even when the continuous tape contains millions of rows.
            lane_row["decisions"] = max(evaluated_counts, default=0)

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "horizons": HORIZONS_MINUTES,
            "wait_deadband_pct": WAIT_DEADBAND_PCT,
            "lanes": by_lane,
            "method": (
                "Cumulative idempotent metrics. Every lane is evaluated against "
                "timestamp-targeted Bitget candles from its frozen market snapshot."
            ),
        }


decision_tape = DecisionTapeService()
