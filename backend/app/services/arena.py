from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from app.config import settings
from app.services.bitget import bitget_market
from app.services.storage import store


def _pnl(side: str, entry: float, current: float) -> float:
    if side == "WAIT" or entry <= 0:
        return 0.0
    raw = ((current / entry) - 1) * 100
    return round(raw if side == "LONG" else -raw, 4)


class ArenaService:
    async def create_battle(self, request: Any) -> dict[str, Any]:
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
            "status": "live",
            "source": "bitget",
        }
        await store.save("battles", battle["id"], battle)
        return battle

    async def _refresh(self, battle: dict[str, Any], price_by_symbol: dict[str, float]) -> dict[str, Any]:
        current = price_by_symbol.get(battle["symbol"], float(battle["current_price"]))
        battle["current_price"] = current
        battle["user_pnl_pct"] = _pnl(battle["user_side"], float(battle["entry_price"]), current)
        battle["ai_pnl_pct"] = _pnl(battle["ai_side"], float(battle["entry_price"]), current)
        expires = datetime.fromisoformat(str(battle["expires_at"]).replace("Z", "+00:00"))
        if datetime.now(timezone.utc) >= expires:
            battle["status"] = "settled"
        await store.save("battles", battle["id"], battle)
        return battle

    async def list_battles(self) -> list[dict[str, Any]]:
        battles = await store.list("battles")
        if not battles:
            return []
        try:
            assets = await bitget_market.get_assets()
            price_by_symbol = {asset["symbol"]: float(asset["price"]) for asset in assets}
        except Exception:
            price_by_symbol = {}
        refreshed = [await self._refresh(dict(battle), price_by_symbol) for battle in battles]
        refreshed.sort(key=lambda row: row["created_at"], reverse=True)
        return refreshed

    async def get_battle(self, battle_id: str) -> dict[str, Any] | None:
        battle = await store.get("battles", battle_id)
        if battle is None:
            return None
        try:
            asset = await bitget_market.get_asset(battle["symbol"])
            price_map = {battle["symbol"]: float(asset["price"])}
        except Exception:
            price_map = {}
        return await self._refresh(dict(battle), price_map)

    async def portfolio(self) -> dict[str, Any]:
        battles = await self.list_battles()
        starting = float(settings.arena_starting_capital)
        deployed = sum(float(b["stake"]) for b in battles if b["status"] == "live" and b["user_side"] != "WAIT")
        pnl_dollars = sum(float(b["stake"]) * float(b["user_pnl_pct"]) / 100 for b in battles if b["user_side"] != "WAIT")
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

        user_returns = [float(b["user_pnl_pct"]) for b in battles]
        user_wins = sum(1 for b in battles if float(b["user_pnl_pct"]) > float(b["ai_pnl_pct"]))
        rows: list[dict[str, Any]] = [{
            "name": "You",
            "type": "human",
            "style": "Thesis-driven",
            "return_pct": round(sum(user_returns), 2),
            "win_rate": round(user_wins / len(battles) * 100),
            "battles": len(battles),
        }]

        opponents: dict[str, list[dict[str, Any]]] = {}
        for battle in battles:
            opponents.setdefault(str(battle["opponent"]), []).append(battle)
        for name, rows_for_agent in opponents.items():
            wins = sum(1 for b in rows_for_agent if float(b["ai_pnl_pct"]) >= float(b["user_pnl_pct"]))
            rows.append({
                "name": name,
                "type": "ai",
                "style": "Adversarial stress-test",
                "return_pct": round(sum(float(b["ai_pnl_pct"]) for b in rows_for_agent), 2),
                "win_rate": round(wins / len(rows_for_agent) * 100),
                "battles": len(rows_for_agent),
            })
        rows.sort(key=lambda row: row["return_pct"], reverse=True)
        for index, row in enumerate(rows, start=1):
            row["rank"] = index
        return rows


arena_service = ArenaService()
