from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services.qwen import QwenError, qwen
from app.services.storage import store


REVIEW_SYSTEM = """You are AlphaArena's post-battle coach. Review a virtual-capital thesis battle after observing the market-marked outcome. Do not claim that one result proves a strategy is good or bad. Do not give financial advice. Return ONLY JSON with keys lesson, what_worked, what_failed, next_rule. what_worked and what_failed must be short arrays. The next_rule must be a falsifiable process rule the trader can test in future paper battles. Use only the supplied battle facts."""


class ReviewService:
    async def review(self, battle: dict[str, Any]) -> dict[str, Any]:
        user_pnl = float(battle.get("user_pnl_pct") or 0)
        ai_pnl = float(battle.get("ai_pnl_pct") or 0)
        if abs(user_pnl - ai_pnl) < 0.01:
            winner = "draw"
        elif user_pnl > ai_pnl:
            winner = "user"
        else:
            winner = "ai"

        default_lesson = (
            "The user's thesis outperformed the opposing stance in this single paper battle. Treat that as one observation, not proof of a repeatable edge."
            if winner == "user" else
            "The opposing stance outperformed the user's thesis in this single paper battle. The useful question is which assumption failed, not whether the market was simply unpredictable."
            if winner == "ai" else
            "Neither stance created a meaningful advantage in this paper battle. The thesis may have lacked a sufficiently differentiated or time-bounded edge."
        )
        worked = [
            f"The thesis was explicit enough to score against a {battle.get('expires_at', 'defined')} horizon.",
            f"The position was marked from a recorded entry price of {float(battle.get('entry_price') or 0):.2f}, so the result is auditable.",
        ]
        failed = [
            "A single battle does not isolate whether the result came from the thesis, timing, volatility, or luck.",
            "Future reviews should compare the original invalidation conditions with what actually happened during the holding period.",
        ]
        next_rule = "Before the next battle, write one price-based and one evidence-based invalidation condition and do not rewrite them after entry."

        source = "deterministic-review"
        if qwen.enabled:
            try:
                ai = await qwen.complete_json(system=REVIEW_SYSTEM, payload={"battle": battle})
                if ai:
                    default_lesson = str(ai.get("lesson") or default_lesson)[:1200]
                    ai_worked = ai.get("what_worked") if isinstance(ai.get("what_worked"), list) else []
                    ai_failed = ai.get("what_failed") if isinstance(ai.get("what_failed"), list) else []
                    if ai_worked:
                        worked = [str(x)[:300] for x in ai_worked[:5]]
                    if ai_failed:
                        failed = [str(x)[:300] for x in ai_failed[:5]]
                    next_rule = str(ai.get("next_rule") or next_rule)[:500]
                    source = "qwen-grounded-review"
            except QwenError:
                pass

        result = {
            "battle_id": battle["id"],
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "winner": winner,
            "user_result_pct": round(user_pnl, 4),
            "ai_result_pct": round(ai_pnl, 4),
            "lesson": default_lesson,
            "what_worked": worked,
            "what_failed": failed,
            "next_rule": next_rule,
            "source": source,
        }
        await store.save("reviews", battle["id"], result)
        return result


review_service = ReviewService()
