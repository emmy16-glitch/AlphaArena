from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from app.config import settings
from app.services.bitget import bitget_market
from app.services.storage import store


class ArenaError(RuntimeError):
    pass


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

    async def create_battle(self, request: Any) -> dict[str, Any]:
        async with self._create_lock:
            if request.user_side != "WAIT":
                portfolio = await self.portfolio()
                free = float(portfolio["free_capital"])
                if free <= 0:
                    raise ArenaError("Virtual stake exceeds free virtual capital $0")
                if float(request.stake) > free + 1e-6:
                    raise ArenaError(
                        f"Virtual stake ${float(request.stake):,.0f} exceeds free virtual capital ${free:,.0f}"
                    )

            asset = await bitget_market.get_asset(request.symbol)
            now = datetime.now(timezone.utc)
            battle = {
                "id": f"battle_{uuid4().hex[:12]}",
                "symbol": request.symbol,
                "thesis": request.thesis,
                "user_side": request.user_side,
                "ai_side": request.ai_side,
                "opponent": request.opponent,
                "stake": float(request.stake),
                "entry_price": float(asset["price"]),
                "current_price": float(asset["price"]),
                "user_pnl_pct": 0.0,
                "ai_pnl_pct": 0.0,
                "created_at": now.isoformat(),
                "expires_at": (now + timedelta(hours=request.duration_hours)).isoformat(),
                "settled_at": None,
                "settled_price": None,
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
        await store.save("battles", str(battle["id"]), battle)
        return battle

    async def list_battles(self) -> list[dict[str, Any]]:
        battles = await store.list("battles")
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

    async def get_battle(self, battle_id: str) -> dict[str, Any] | None:
        battle = await store.get("battles", battle_id)
        if battle is None:
            return None
        price_map: dict[str, float] = {}
        if battle.get("status") != "settled":
            try:
                asset = await bitget_market.get_asset(str(battle["symbol"]))
                price_map[str(battle["symbol"])] = float(asset["price"])
            except Exception:
                pass
        return await self._refresh(dict(battle), price_map)

    async def portfolio(self) -> dict[str, Any]:
        battles = await self.list_battles()
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
        return {
            "starting_capital": round(starting, 2),
            "net_value": round(net, 2),
            "free_capital": round(max(0.0, starting - deployed), 2),
            "deployed_capital": round(deployed, 2),
            "return_pct": round((net / starting - 1) * 100, 4) if starting else 0.0,
            "open_battles": sum(1 for b in battles if b["status"] == "live"),
            "settled_battles": sum(1 for b in battles if b["status"] == "settled"),
        }

    async def leaderboard(self) -> list[dict[str, Any]]:
        battles = await self.list_battles()
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


arena_service = ArenaService()
