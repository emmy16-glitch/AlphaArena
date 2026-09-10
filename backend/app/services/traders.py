from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.services.storage import store


class TraderService:
    async def create(self, request: Any) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        profile = {
            "id": f"trader_{uuid4().hex[:12]}",
            "name": request.name,
            "style": request.style,
            "risk_appetite": request.risk_appetite,
            "holding_period": request.holding_period,
            "assets": list(dict.fromkeys(request.assets))[:12],
            "created_at": now,
            "updated_at": now,
            "mode": "virtual-only",
        }
        await store.save("traders", profile["id"], profile)
        return profile

    async def list(self) -> list[dict[str, Any]]:
        return await store.list("traders", limit=100)


trader_service = TraderService()
