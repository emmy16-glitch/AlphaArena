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
    """Canonical string for tamper-evident settlement hashing."""
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
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)


def battle_hash(battle: dict[str, Any]) -> str:
    return hashlib.sha256(battle_canonical_payload(battle).encode("utf-8")).hexdigest()


def verify_battle_hash(battle: dict[str, Any]) -> bool:
    stored = battle.get("settlement_hash")
    if not stored or battle.get("status") != "settled":
        return False
    try:
        return str(stored) == battle_hash(battle)
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
        # Prevent two simultaneous paper-battle requests from both seeing the
        # same free capital and oversubscribing the virtual portfolio.
        self._create_lock = asyncio.Lock()

    async def create_battle(self, request: Any, player_id: str = "guest_default") -> dict[str, Any]:
        async with self._create_lock:
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
            battle = {
                "id": f"battle_{uuid4().hex[:12]}",
                "player_id": player_id,
                "symbol": request.symbol,
                "thesis": request.thesis,
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
                "status": "live",
                "source": "bitget",
            }
            await store.save("battles", battle["id"], battle)
            return battle

    async def _refresh(self, battle: dict[str, Any], price_by_symbol: dict[str, float]) -> dict[str, Any]:
        if battle.get("status") == "settled" and battle.get("settled_price") is not None:
            settled = float(battle["settled_price"])
            battle["current_price"] = settled
            battle["user_pnl_pct"] = _pnl(str(battle["user_side"]), float(battle["entry_price"]), settled)
            battle["ai_pnl_pct"] = _pnl(str(battle["ai_side"]), float(battle["entry_price"]), settled)
            # Backfill tamper-evident hash for battles settled before hashing existed.
            if not battle.get("settlement_hash"):
                try:
                    battle["settlement_hash"] = battle_hash(battle)
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
            battle["status"] = "settled"
            battle["settled_price"] = current
            battle["settled_at"] = datetime.now(timezone.utc).isoformat()
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
        pnl_dollars = sum(
            float(b["stake"]) * float(b["user_pnl_pct"]) / 100
            for b in battles
            if b["user_side"] != "WAIT"
        )
        net = starting + pnl_dollars
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
            "free_capital": round(max(0.0, starting - deployed), 2),
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
