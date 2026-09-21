from __future__ import annotations

import asyncio
import hashlib
import json
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from app.config import settings
from app.services.bitget import bitget_market
from app.services.storage import store


class ArenaError(RuntimeError):
    pass


def battle_canonical_payload(battle: dict[str, Any]) -> str:
    """Canonical v3 freeze for the thesis, risk contract and observed outcome."""
    payload = {
        "id": str(battle.get("id")),
        "player_id": str(battle.get("player_id") or "guest_default"),
        "symbol": str(battle.get("symbol")),
        "thesis": str(battle.get("thesis") or ""),
        "wrong_sentence": str(battle.get("wrong_sentence") or ""),
        "user_side": str(battle.get("user_side")),
        "ai_side": str(battle.get("ai_side")),
        "opponent": str(battle.get("opponent") or ""),
        "stake": round(float(battle.get("stake") or 0), 2),
        "quantity": round(float(battle.get("quantity") or 0), 6),
        "risk_pct": round(float(battle.get("risk_pct") or 0), 6),
        "kill_price": round(float(battle.get("kill_price") or 0), 6),
        "stated_confidence": (
            None if battle.get("stated_confidence") is None else round(float(battle.get("stated_confidence")), 4)
        ),
        "entry_price": float(battle.get("entry_price") or 0),
        "created_at": str(battle.get("created_at")),
        "expires_at": str(battle.get("expires_at")),
        "settled_price": float(battle.get("settled_price") or 0),
        "settled_at": str(battle.get("settled_at")),
        "settlement_source": str(battle.get("settlement_source") or ""),
        "settlement_granularity": str(battle.get("settlement_granularity") or ""),
        "settlement_selection": str(battle.get("settlement_selection") or ""),
        "shadow": battle.get("shadow"),
        "flatten_before_dark": battle.get("flatten_before_dark"),
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)


def battle_hash(battle: dict[str, Any]) -> str:
    return hashlib.sha256(battle_canonical_payload(battle).encode("utf-8")).hexdigest()


def _previous_battle_hash(battle: dict[str, Any], *, include_wrong_sentence: bool) -> str:
    """Compatibility hash for battles frozen before the v3 thesis freeze."""
    payload = {
        "id": str(battle.get("id")),
        "symbol": str(battle.get("symbol")),
        "user_side": str(battle.get("user_side")),
        "ai_side": str(battle.get("ai_side")),
        "stake": round(float(battle.get("stake") or 0), 2),
        "entry_price": float(battle.get("entry_price") or 0),
        "settled_price": float(battle.get("settled_price") or 0),
        "created_at": str(battle.get("created_at")),
        "settled_at": str(battle.get("settled_at")),
    }
    if include_wrong_sentence:
        payload["wrong_sentence"] = str(battle.get("wrong_sentence") or "")
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def verify_battle_hash(battle: dict[str, Any]) -> bool:
    stored = battle.get("settlement_hash")
    if not stored or battle.get("status") != "settled":
        return False
    try:
        candidate = str(stored)
        return candidate in {
            battle_hash(battle),
            _previous_battle_hash(battle, include_wrong_sentence=True),
            _previous_battle_hash(battle, include_wrong_sentence=False),
        }
    except Exception:
        return False


def _pnl(side: str, entry: float, current: float) -> float:
    if side == "WAIT" or entry <= 0 or current <= 0:
        return 0.0
    raw = ((current / entry) - 1) * 100
    return round(raw if side == "LONG" else -raw, 4)


def _parse_time(value: Any) -> datetime:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


class ArenaService:
    def __init__(self) -> None:
        # Capital reservation is serialized by AlphaStore.player_lock. With
        # Mongo configured this is also a short distributed lease, so separate
        # serverless workers cannot both spend the same free paper capital.
        self._create_lock = asyncio.Lock()  # legacy local fallback; store lock is authoritative

    async def create_battle(self, request: Any, player_id: str = "guest_default") -> dict[str, Any]:
        async with store.player_lock(player_id):
            if request.user_side != "WAIT":
                portfolio = await self.portfolio(player_id)
                free = float(portfolio["free_capital"])
                if free <= 0:
                    raise ArenaError("Virtual stake exceeds free virtual capital $0")
                if float(request.stake) > free + 1e-6:
                    raise ArenaError(
                        f"Virtual stake ${float(request.stake):,.0f} exceeds free virtual capital ${free:,.0f}"
                    )

            asset = await bitget_market.get_asset(request.symbol)
            now = datetime.now(timezone.utc)
            entry = float(asset["price"])
            stake_value = float(request.stake)
            raw_confidence = getattr(request, "stated_confidence", None)
            stated_confidence: float | None = None
            if raw_confidence is not None:
                try:
                    stated_confidence = round(max(0.0, min(100.0, float(raw_confidence))), 2)
                except (TypeError, ValueError):
                    stated_confidence = None
            wrong_raw = str(getattr(request, "wrong_sentence", None) or "").strip()
            wrong_sentence = wrong_raw[:500] or None
            risk_pct = 2.0
            try:
                risk_pct = float(getattr(request, "risk_pct", 2.0) or 2.0)
            except (TypeError, ValueError):
                risk_pct = 2.0
            risk_pct = max(0.1, min(25.0, risk_pct))
            # Kill/invalidation level reused from Invalidation-Radar logic:
            # risk_pct of adverse move from entry. LONG kill is below entry,
            # SHORT kill is above entry. Pure arithmetic.
            if request.user_side == "LONG":
                kill_price = round(entry * (1 - risk_pct / 100), 6)
            elif request.user_side == "SHORT":
                kill_price = round(entry * (1 + risk_pct / 100), 6)
            else:
                kill_price = None
            battle = {
                "id": f"battle_{uuid4().hex[:12]}",
                "player_id": player_id,
                "symbol": request.symbol,
                "thesis": request.thesis,
                "wrong_sentence": wrong_sentence,
                "risk_pct": risk_pct,
                "kill_price": kill_price,
                "user_side": request.user_side,
                "ai_side": request.ai_side,
                "opponent": request.opponent,
                "stake": stake_value,
                "stated_confidence": stated_confidence,
                "quantity": round(stake_value / entry, 6) if entry > 0 else 0.0,
                "entry_price": entry,
                "current_price": entry,
                "user_pnl_pct": 0.0,
                "ai_pnl_pct": 0.0,
                "created_at": now.isoformat(),
                "expires_at": (now + timedelta(hours=request.duration_hours)).isoformat(),
                "settled_at": None,
                "settled_price": None,
                "settlement_hash": None,
                "settlement_source": None,
                "settlement_granularity": None,
                "settlement_selection": None,
                "status": "live",
                "source": "bitget",
            }
            await store.save("battles", battle["id"], battle)
            return battle

    async def _attach_shadow(self, battle: dict[str, Any]) -> dict[str, Any]:
        """Attach Listed/Shadow attribution only for this battle's market window."""
        try:
            from app.services.shadow import attribute_moves, flatten_before_dark, kill_check

            start_dt = _parse_time(battle.get("created_at"))
            end_value = battle.get("settled_at") if battle.get("status") == "settled" else datetime.now(timezone.utc).isoformat()
            end_dt = _parse_time(end_value)
            start_ms = int(start_dt.timestamp() * 1000)
            end_ms = int(end_dt.timestamp() * 1000)
            candles = await bitget_market.get_candles(
                str(battle.get("symbol")),
                interval="1H",
                limit=200,
                start_time_ms=start_ms,
                end_time_ms=end_ms,
            )
            # Bitget can return a boundary candle outside the requested range;
            # clip again locally so pre-entry/post-settlement movement can never
            # leak into the attribution.
            candles = [
                candle for candle in candles
                if start_ms <= int(candle.get("ts") or 0) <= end_ms
            ]
            attribution = attribute_moves(
                float(battle.get("entry_price") or 0),
                str(battle.get("user_side") or "LONG"),
                candles,
                granularity_label="1H",
            )
            kill = kill_check(
                float(battle.get("entry_price") or 0),
                str(battle.get("user_side") or "LONG"),
                float(battle.get("kill_price") or 0) or None,
                candles,
            )
            if kill:
                attribution["kill_hit"] = bool(kill.get("kill_hit"))
                attribution["kill_at"] = kill.get("kill_at")
                attribution["kill_session"] = kill.get("kill_session")
                attribution["kill_price_touched"] = kill.get("kill_price_touched")
            battle["shadow"] = attribution
            flat = None
            if battle.get("status") == "settled" and battle.get("settled_price") is not None:
                flat = flatten_before_dark(
                    float(battle.get("entry_price") or 0),
                    str(battle.get("user_side") or "LONG"),
                    float(battle.get("settled_price") or 0),
                    attribution.get("last_listed_price"),
                )
            battle["flatten_before_dark"] = flat
        except Exception:
            pass
        return battle

    async def _refresh(self, battle: dict[str, Any], price_by_symbol: dict[str, float]) -> dict[str, Any]:
        if battle.get("status") == "settled" and battle.get("settled_price") is not None:
            settled = float(battle["settled_price"])
            battle["current_price"] = settled
            battle["user_pnl_pct"] = _pnl(str(battle["user_side"]), float(battle["entry_price"]), settled)
            battle["ai_pnl_pct"] = _pnl(str(battle["ai_side"]), float(battle["entry_price"]), settled)
            if not battle.get("shadow"):
                battle = await self._attach_shadow(battle)
            # Backfill only after optional Shadow/flatten attribution so a new
            # freeze commits to the full settled record. Older stored hashes
            # remain verifiable through the compatibility paths above.
            if not battle.get("settlement_hash"):
                try:
                    battle["settlement_hash"] = battle_hash(battle)
                except Exception:
                    pass
            try:
                await store.save("battles", str(battle["id"]), battle)
            except Exception:
                pass
            return battle

        current = price_by_symbol.get(
            str(battle["symbol"]),
            float(battle.get("current_price") or battle["entry_price"]),
        )
        if current <= 0:
            current = float(battle["entry_price"])
        battle["current_price"] = current
        battle["user_pnl_pct"] = _pnl(str(battle["user_side"]), float(battle["entry_price"]), current)
        battle["ai_pnl_pct"] = _pnl(str(battle["ai_side"]), float(battle["entry_price"]), current)

        if datetime.now(timezone.utc) >= _parse_time(battle["expires_at"]):
            expiry = _parse_time(battle["expires_at"])
            try:
                observed = await bitget_market.get_price_near(
                    str(battle["symbol"]),
                    int(expiry.timestamp() * 1000),
                )
            except Exception:
                # Never turn a 24H battle into a later-horizon battle merely
                # because the historical candle is temporarily unavailable.
                await store.save("battles", str(battle["id"]), battle)
                return battle
            settled = float(observed["price"])
            observed_at = datetime.fromtimestamp(
                int(observed["timestamp"]) / 1000,
                tz=timezone.utc,
            )
            battle["status"] = "settled"
            battle["settled_price"] = settled
            battle["settled_at"] = observed_at.isoformat()
            battle["settlement_source"] = str(observed.get("source") or "bitget-candle")
            battle["settlement_granularity"] = str(observed.get("granularity") or "unknown")
            battle["settlement_selection"] = str(observed.get("selection") or "unknown")
            battle["current_price"] = settled
            battle["user_pnl_pct"] = _pnl(str(battle["user_side"]), float(battle["entry_price"]), settled)
            battle["ai_pnl_pct"] = _pnl(str(battle["ai_side"]), float(battle["entry_price"]), settled)
            battle = await self._attach_shadow(battle)
            try:
                battle["settlement_hash"] = battle_hash(battle)
            except Exception:
                battle["settlement_hash"] = None
        await store.save("battles", str(battle["id"]), battle)
        return battle

    async def list_battles(self, player_id: str = "guest_default") -> list[dict[str, Any]]:
        battles = [battle for battle in await store.list("battles") if str(battle.get("player_id") or "guest_default") == player_id]
        if not battles:
            return []
        live_symbols = {str(b["symbol"]) for b in battles if b.get("status") != "settled"}
        price_by_symbol: dict[str, float] = {}
        if live_symbols:
            results = await asyncio.gather(
                *(bitget_market.get_asset(symbol) for symbol in live_symbols),
                return_exceptions=True,
            )
            for result in results:
                if isinstance(result, dict):
                    price_by_symbol[str(result["symbol"])] = float(result["price"])
        refreshed = [await self._refresh(dict(battle), price_by_symbol) for battle in battles]
        refreshed.sort(key=lambda row: str(row.get("created_at", "")), reverse=True)
        return refreshed

    async def get_battle(self, battle_id: str, player_id: str = "guest_default") -> dict[str, Any] | None:
        battle = await store.get("battles", battle_id)
        if battle is None or str(battle.get("player_id") or "guest_default") != player_id:
            return None
        price_map: dict[str, float] = {}
        if battle.get("status") != "settled":
            try:
                asset = await bitget_market.get_asset(str(battle["symbol"]))
                price_map[str(battle["symbol"])] = float(asset["price"])
            except Exception:
                pass
        return await self._refresh(dict(battle), price_map)

    async def portfolio(self, player_id: str = "guest_default") -> dict[str, Any]:
        battles = await self.list_battles(player_id)
        starting = float(settings.arena_starting_capital)
        deployed = sum(
            float(b["stake"])
            for b in battles
            if b["status"] == "live" and b["user_side"] != "WAIT"
        )
        realized_pnl = sum(
            float(b["stake"]) * float(b["user_pnl_pct"]) / 100
            for b in battles
            if b.get("status") == "settled" and b.get("user_side") != "WAIT"
        )
        unrealized_pnl = sum(
            float(b["stake"]) * float(b["user_pnl_pct"]) / 100
            for b in battles
            if b.get("status") == "live" and b.get("user_side") != "WAIT"
        )
        realized_balance = starting + realized_pnl
        net = realized_balance + unrealized_pnl
        free_capital = max(0.0, realized_balance - deployed)
        settled = [b for b in battles if b.get("status") == "settled" and b.get("user_side") != "WAIT"]
        wins = sum(1 for b in settled if float(b.get("user_pnl_pct") or 0) > 0)
        gross_profit = sum(
            float(b["stake"]) * float(b["user_pnl_pct"]) / 100
            for b in settled
            if float(b.get("user_pnl_pct") or 0) > 0
        )
        gross_loss = sum(
            abs(float(b["stake"]) * float(b["user_pnl_pct"]) / 100)
            for b in settled
            if float(b.get("user_pnl_pct") or 0) < 0
        )
        profit_factor = round(gross_profit / gross_loss, 4) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 0.0)
        # Equity curve in creation order for max drawdown + Sharpe-like stat.
        ordered = sorted(battles, key=lambda row: str(row.get("created_at") or ""))
        equity = starting
        peak = starting
        worst_dd = 0.0
        for row in ordered:
            if row.get("user_side") == "WAIT":
                continue
            equity += float(row["stake"]) * float(row.get("user_pnl_pct") or 0) / 100
            peak = max(peak, equity)
            if peak > 0:
                worst_dd = min(worst_dd, (equity / peak - 1) * 100)
        pnl_pcts = [float(b.get("user_pnl_pct") or 0) for b in settled]
        if len(pnl_pcts) >= 2:
            try:
                sharpe_like = round(statistics.mean(pnl_pcts) / (statistics.stdev(pnl_pcts) or 1.0), 4)
            except statistics.StatisticsError:
                sharpe_like = 0.0
        else:
            sharpe_like = 0.0
        return {
            "starting_capital": round(starting, 2),
            "net_value": round(net, 2),
            "free_capital": round(free_capital, 2),
            "deployed_capital": round(deployed, 2),
            "return_pct": round((net / starting - 1) * 100, 4) if starting else 0.0,
            "open_battles": sum(1 for b in battles if b["status"] == "live"),
            "settled_battles": sum(1 for b in battles if b["status"] == "settled"),
            "win_rate": round(wins / len(settled) * 100, 2) if settled else 0.0,
            "profit_factor": profit_factor,
            "max_drawdown_pct": round(worst_dd, 4),
            "sharpe_like": sharpe_like,
        }

    def _profit_factor(self, rows: list[dict[str, Any]], pnl_key: str) -> float:
        gross_profit = sum(
            float(r["stake"]) * float(r[pnl_key]) / 100
            for r in rows
            if float(r.get(pnl_key) or 0) > 0
        )
        gross_loss = sum(
            abs(float(r["stake"]) * float(r[pnl_key]) / 100)
            for r in rows
            if float(r.get(pnl_key) or 0) < 0
        )
        if gross_loss > 0:
            return round(gross_profit / gross_loss, 4)
        return round(gross_profit, 2) if gross_profit > 0 else 0.0

    async def leaderboard(self, player_id: str = "guest_default") -> list[dict[str, Any]]:
        battles = await self.list_battles(player_id)
        if not battles:
            return []

        def weighted_return(rows: list[dict[str, Any]], side: str) -> float:
            stakes = sum(float(row["stake"]) for row in rows if row.get(side) != "WAIT")
            if stakes <= 0:
                return 0.0
            pnl_key = "user_pnl_pct" if side == "user_side" else "ai_pnl_pct"
            pnl = sum(
                float(row["stake"]) * float(row[pnl_key]) / 100
                for row in rows
                if row.get(side) != "WAIT"
            )
            return round(pnl / stakes * 100, 2)

        decisive = [b for b in battles if b["status"] == "settled"] or battles
        user_wins = sum(
            1 for b in decisive if float(b["user_pnl_pct"]) > float(b["ai_pnl_pct"])
        )
        rows: list[dict[str, Any]] = [
            {
                "name": "You",
                "type": "human",
                "style": "Thesis-driven",
                "return_pct": weighted_return(battles, "user_side"),
                "win_rate": round(user_wins / len(decisive) * 100),
                "profit_factor": self._profit_factor([b for b in battles if b.get("user_side") != "WAIT"], "user_pnl_pct"),
                "battles": len(battles),
            }
        ]

        opponents: dict[str, list[dict[str, Any]]] = {}
        for battle in battles:
            opponents.setdefault(str(battle["opponent"]), []).append(battle)
        for name, agent_battles in opponents.items():
            agent_decisive = [b for b in agent_battles if b["status"] == "settled"] or agent_battles
            wins = sum(
                1
                for b in agent_decisive
                if float(b["ai_pnl_pct"]) >= float(b["user_pnl_pct"])
            )
            rows.append(
                {
                    "name": name,
                    "type": "ai",
                    "style": "Adversarial stress-test",
                    "return_pct": weighted_return(agent_battles, "ai_side"),
                    "win_rate": round(wins / len(agent_decisive) * 100),
                    "profit_factor": self._profit_factor([b for b in agent_battles if b.get("ai_side") != "WAIT"], "ai_pnl_pct"),
                    "battles": len(agent_battles),
                }
            )
        rows.sort(
            key=lambda row: (float(row["return_pct"]), int(row["win_rate"])),
            reverse=True,
        )
        for index, row in enumerate(rows, start=1):
            row["rank"] = index
        return rows

    async def export_rows(self, player_id: str = "guest_default") -> list[dict[str, Any]]:
        """Judge-ready paper-trading log: timestamp, asset, direction, price,
        quantity, balance change. Quantity is virtual units (stake/entry)."""
        battles = await self.list_battles(player_id)
        battles.sort(key=lambda row: str(row.get("created_at") or ""))
        running = float(settings.arena_starting_capital)
        rows: list[dict[str, Any]] = []
        for battle in battles:
            stake = float(battle.get("stake") or 0)
            entry = float(battle.get("entry_price") or 0)
            quantity = float(battle.get("quantity") or (stake / entry if entry > 0 else 0))
            pnl_pct = float(battle.get("user_pnl_pct") or 0)
            pnl_dollars = round(stake * pnl_pct / 100, 2)
            if battle.get("status") == "settled":
                running = round(running + pnl_dollars, 2)
            rows.append(
                {
                    "timestamp": battle.get("created_at"),
                    "battle_id": battle.get("id"),
                    "asset": battle.get("symbol"),
                    "direction": battle.get("user_side"),
                    "opponent_side": battle.get("ai_side"),
                    "entry_price": entry,
                    "exit_price": battle.get("settled_price")
                    if battle.get("status") == "settled"
                    else battle.get("current_price"),
                    "quantity": round(quantity, 6),
                    "stake": round(stake, 2),
                    "status": battle.get("status"),
                    "stated_confidence": battle.get("stated_confidence"),
                    "pnl_pct": round(pnl_pct, 4),
                    "pnl_dollars": pnl_dollars,
                    "account_balance_after": running if battle.get("status") == "settled" else None,
                    "settled_at": battle.get("settled_at"),
                    "settlement_hash": battle.get("settlement_hash"),
                    "hash_verified": verify_battle_hash(battle) if battle.get("status") == "settled" else None,
                    "thesis": battle.get("thesis"),
                    "wrong_sentence": battle.get("wrong_sentence"),
                    "shadow": battle.get("shadow"),
                    "flatten_before_dark": battle.get("flatten_before_dark"),
                }
            )
        return rows

    def export_csv(self, rows: list[dict[str, Any]]) -> str:
        import csv
        import io

        fieldnames = [
            "timestamp", "battle_id", "asset", "direction", "opponent_side",
            "entry_price", "exit_price", "quantity", "stake", "status",
            "stated_confidence",
            "pnl_pct", "pnl_dollars", "account_balance_after",
            "settled_at", "settlement_hash", "hash_verified", "thesis",
            "wrong_sentence",
        ]
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key) for key in fieldnames})
        return buffer.getvalue()

    async def track_record(self, player_id: str = "guest_default") -> dict[str, Any]:
        """Deterministic aggregate over this player's settled battles.

        Read-only over the existing battles collection (MongoDB or memory
        fallback via store); no new persistence needed.
        """
        from app.services.calibration import track_record as compute_record

        battles = await self.list_battles(player_id)
        return compute_record(battles)


arena_service = ArenaService()
