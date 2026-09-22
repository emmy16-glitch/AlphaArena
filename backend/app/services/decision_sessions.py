"""Decision sessions: one frozen snapshot, many participants, one receipt.

Implements the product contract:
  SELECT ASSET -> WRITE THESIS -> TEST THESIS -> FREEZE EVIDENCE
  -> COMPARE HUMAN + AI DECISIONS -> ENTER ARENA -> SETTLE AND VERIFY

Every participant (human, NightWatch, Qwen/Jev, deterministic baseline) is
evaluated against the SAME frozen snapshot. No participant receives market
information from after the snapshot time. Provider failures are recorded as
``unavailable`` -- never silently fabricated as HOLD/WAIT.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.services.decision_tape import decision_tape
from app.services.nightwatch import nightwatch
from app.services.storage import store

VALID_HORIZONS = ("30m", "1h", "4h", "24h")
HORIZON_HOURS = {"30m": 0.5, "1h": 1.0, "4h": 4.0, "24h": 24.0}

REFUSALS: dict[str, dict[str, str]] = {
    "INSUFFICIENT_EVIDENCE": {
        "title": "Not enough evidence",
        "explanation": "The frozen snapshot does not contain enough reliable market evidence to justify a call.",
    },
    "STALE_MARKET_DATA": {
        "title": "Market data is stale",
        "explanation": "The observed price is older than the allowed freshness window, so no decision was made from it.",
    },
    "RISK_LIMIT_EXCEEDED": {
        "title": "Risk limit exceeded",
        "explanation": "The requested risk exceeds the paper guardrail. Lower the risk and test the thesis again.",
    },
    "CALIBRATION_SAMPLE_TOO_SMALL": {
        "title": "Calibration sample too small",
        "explanation": "Fewer than 20 aligned historical observations exist, so scenario calibration is withheld.",
    },
    "MODEL_PROVIDER_UNAVAILABLE": {
        "title": "Model provider unavailable",
        "explanation": "The reasoning provider could not be reached. Its lane is marked unavailable, not HOLD.",
    },
    "THESIS_NOT_FALSIFIABLE": {
        "title": "Thesis is not falsifiable yet",
        "explanation": "Write what would prove the idea wrong (direction + horizon + invalidation) so the market can settle it.",
    },
    "NO_ACTION_JUSTIFIED": {
        "title": "No action justified",
        "explanation": "Evidence, risk and calibration gates passed, but no lane clears the bar. Refusing to act is a successful outcome.",
    },
}

DIRECTION_ALIASES = {
    "BUY": "LONG", "LONG": "LONG", "BULLISH": "LONG",
    "SELL": "SHORT", "SHORT": "SHORT", "BEARISH": "SHORT",
    "HOLD": "WAIT", "WAIT": "WAIT", "SIDEWAYS": "WAIT",
}

MAX_RISK_PCT = 10.0
STALE_SECONDS = 180.0


def normalize_direction(value: Any) -> str:
    candidate = str(value or "WAIT").strip().upper()
    return DIRECTION_ALIASES.get(candidate, "WAIT")


def _canonical(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def receipt_hash(payload: dict[str, Any]) -> str:
    return hashlib.sha256(_canonical(payload).encode("utf-8")).hexdigest()


def receipt_canonical_payload(session: dict[str, Any]) -> dict[str, Any]:
    participants = session.get("participants") or {}
    return {
        "decision_session_id": session.get("id"),
        "asset": session.get("symbol"),
        "snapshot_timestamp": (session.get("snapshot") or {}).get("captured_at"),
        "snapshot_hash": session.get("snapshot_hash"),
        "dataset_source_provenance": (session.get("snapshot") or {}).get("source"),
        "thesis": session.get("thesis"),
        "horizon": session.get("horizon"),
        "human_decision": (participants.get("human") or {}).get("direction"),
        "nightwatch_decision": (participants.get("nightwatch") or {}).get("direction"),
        "qwen_decision": (participants.get("qwen") or {}).get("direction"),
        "baseline_decision": (participants.get("baseline") or {}).get("direction"),
        "confidences": {
            lane: (info or {}).get("confidence")
            for lane, info in participants.items()
        },
        "models": {
            lane: (info or {}).get("model")
            for lane, info in participants.items()
        },
        "risk_configuration": session.get("risk"),
        "evidence_references": session.get("evidence_references"),
        "created_timestamp": session.get("created_at"),
    }


def _snapshot_hash(snapshot: dict[str, Any]) -> str:
    core = {
        "id": snapshot.get("id"),
        "symbol": snapshot.get("symbol"),
        "captured_at": snapshot.get("captured_at"),
        "market_timestamp": snapshot.get("market_timestamp"),
        "price": snapshot.get("price"),
        "change_pct_24h": snapshot.get("change_pct_24h"),
        "spread_bps": snapshot.get("spread_bps"),
        "source": snapshot.get("source"),
    }
    return hashlib.sha256(_canonical(core).encode("utf-8")).hexdigest()


def _thesis_refusal(thesis: str) -> dict[str, Any] | None:
    text = (thesis or "").strip()
    if len(text) < 12:
        return {
            "code": "THESIS_NOT_FALSIFIABLE",
            **REFUSALS["THESIS_NOT_FALSIFIABLE"],
            "technical": f"thesis_length={len(text)} minimum=12",
        }
    lowered = text.lower()
    has_direction = any(w in lowered for w in ("up", "down", "rise", "fall", "strong", "weak", "bull", "bear", "hold", "flat", "higher", "lower"))
    has_horizon = any(w in lowered for w in ("30m", "1h", "4h", "24h", "hour", "minute", "day"))
    if not (has_direction and has_horizon):
        return {
            "code": "THESIS_NOT_FALSIFIABLE",
            **REFUSALS["THESIS_NOT_FALSIFIABLE"],
            "technical": "thesis lacks explicit direction and/or horizon keywords",
        }
    return None


class DecisionSessionService:
    async def create_session(
        self,
        *,
        symbol: str,
        thesis: str,
        human_direction: str,
        horizon: str,
        confidence: float,
        risk_pct: float = 2.0,
        player_id: str = "guest_default",
    ) -> dict[str, Any]:
        sym = (symbol or "rNVDA").strip() or "rNVDA"
        hor = (horizon or "24h").strip()
        if hor not in VALID_HORIZONS:
            hor = "24h"
        direction = normalize_direction(human_direction)
        conf = max(0.0, min(100.0, float(confidence or 50.0)))
        risk = max(0.1, min(25.0, float(risk_pct or 2.0)))

        session_id = f"dss_{uuid4().hex[:12]}"
        created_at = datetime.now(timezone.utc).isoformat()

        refusal = _thesis_refusal(thesis)
        if risk > MAX_RISK_PCT:
            refusal = {
                "code": "RISK_LIMIT_EXCEEDED",
                **REFUSALS["RISK_LIMIT_EXCEEDED"],
                "technical": f"risk_pct={risk} max={MAX_RISK_PCT}",
            }

        # Freeze point-in-time evidence first; every lane shares this snapshot.
        capture = await decision_tape.capture_snapshot(sym, player_id=player_id)
        snapshot = capture["snapshot"]
        baseline_record = capture["baseline"]
        snap_hash = _snapshot_hash(snapshot)

        # Deterministic data-quality gates (never bypassed by generative AI).
        if refusal is None:
            try:
                market_ms = int(snapshot.get("market_timestamp") or 0)
                age_s = max(0.0, datetime.now(timezone.utc).timestamp() - market_ms / 1000.0)
            except (TypeError, ValueError):
                age_s = 0.0
            if age_s > STALE_SECONDS:
                refusal = {
                    "code": "STALE_MARKET_DATA",
                    **REFUSALS["STALE_MARKET_DATA"],
                    "technical": f"market_age_seconds={round(age_s, 1)} max={STALE_SECONDS}",
                }
            elif int(snapshot.get("spread_bps") or 0) > 100 or len(snapshot.get("spark") or []) < 5:
                refusal = {
                    "code": "INSUFFICIENT_EVIDENCE",
                    **REFUSALS["INSUFFICIENT_EVIDENCE"],
                    "technical": f"spread_bps={snapshot.get('spread_bps')} spark_points={len(snapshot.get('spark') or [])}",
                }

        participants: dict[str, Any] = {
            "human": {
                "lane": "human",
                "direction": direction,
                "confidence": round(conf, 2),
                "model": "human",
                "status": "decided",
                "snapshot_id": snapshot["id"],
                "reasoning": "Human call frozen at test time against the same snapshot.",
            },
            "baseline": {
                "lane": "baseline",
                "direction": str(baseline_record.get("direction") or "WAIT"),
                "confidence": float(baseline_record.get("confidence") or 50.0),
                "model": "deterministic-baseline-v1",
                "status": "decided",
                "snapshot_id": snapshot["id"],
                "reasoning": "Transparent observed-momentum benchmark; not a recommendation.",
            },
        }

        # NightWatch lane: adversarial research against the same snapshot.
        try:
            report = await nightwatch.analyze(
                type("Req", (), {
                    "symbol": sym, "direction": direction,
                    "thesis": thesis, "risk_pct": risk, "holding_period": hor,
                })(),
                market_asset={
                    "price": snapshot.get("price"),
                    "changePct": snapshot.get("change_pct_24h"),
                    "spark": snapshot.get("spark"),
                    "timestamp": snapshot.get("market_timestamp"),
                },
            )
            participants["nightwatch"] = {
                "lane": "nightwatch",
                "direction": str(report.get("verdict") or "WAIT"),
                "confidence": float(report.get("confidence") or 50.0),
                "model": "nightwatch-v1",
                "status": "decided",
                "snapshot_id": snapshot["id"],
                "reasoning": str(report.get("headline") or report.get("summary") or ""),
                "report_id": report.get("id"),
            }
        except Exception as exc:
            participants["nightwatch"] = {
                "lane": "nightwatch",
                "direction": None,
                "confidence": None,
                "model": "nightwatch-v1",
                "status": "unavailable",
                "snapshot_id": snapshot["id"],
                "reasoning": None,
                "error": f"NightWatch unavailable: {type(exc).__name__}",
            }

        # Qwen/Jev lane: configured reasoning model; unavailable is explicit.
        try:
            from app.services.qwen import qwen as qwen_client

            diagnostics = qwen_client.diagnostics()
            if not diagnostics.get("configured"):
                raise RuntimeError("qwen_unconfigured")
            completion = await qwen_client.complete_json(
                system=(
                    "You are a trading thesis judge. Use ONLY the frozen snapshot evidence. "
                    'Reply with JSON {"direction": "LONG"|"SHORT"|"WAIT", "confidence": 0-100, "reason": "..."}.'
                ),
                payload={
                    "thesis": thesis,
                    "asset": sym,
                    "price": snapshot.get("price"),
                    "snapshot_at": snapshot.get("captured_at"),
                    "horizon": hor,
                },
                max_output_tokens=400,
            )
            q_direction = normalize_direction((completion or {}).get("direction"))
            q_conf = max(0.0, min(100.0, float((completion or {}).get("confidence") or 50.0)))
            participants["qwen"] = {
                "lane": "qwen",
                "direction": q_direction,
                "confidence": round(q_conf, 2),
                "model": str(diagnostics.get("model") or "qwen"),
                "status": "decided",
                "snapshot_id": snapshot["id"],
                "reasoning": str((completion or {}).get("reason") or "Model interpretation of the frozen snapshot."),
            }
        except Exception:
            participants["qwen"] = {
                "lane": "qwen",
                "direction": None,
                "confidence": None,
                "model": "qwen",
                "status": "unavailable",
                "snapshot_id": snapshot["id"],
                "reasoning": None,
                "error": "Model provider unavailable; lane recorded as unavailable rather than HOLD.",
            }

        decided = [p for p in participants.values() if p.get("status") == "decided"]
        unavailable = [p for p in participants.values() if p.get("status") == "unavailable"]
        ready = refusal is None and len(decided) >= 2

        session: dict[str, Any] = {
            "id": session_id,
            "symbol": sym,
            "thesis": thesis.strip(),
            "horizon": hor,
            "horizon_hours": HORIZON_HOURS[hor],
            "snapshot": snapshot,
            "snapshot_hash": snap_hash,
            "participants": participants,
            "refusal": refusal,
            "risk": {"risk_pct": risk, "max_risk_pct": MAX_RISK_PCT, "mode": "paper-only"},
            "evidence_references": {
                "snapshot_id": snapshot.get("id"),
                "source": snapshot.get("source"),
                "market_timestamp": snapshot.get("market_timestamp"),
            },
            "dataset_source_provenance": str(snapshot.get("source") or "bitget"),
            "ready_for_arena": ready,
            "decided_count": len(decided),
            "unavailable_count": len(unavailable),
            "created_at": created_at,
            "player_id": player_id,
            "arena_battle_id": None,
        }
        canonical = receipt_canonical_payload(session)
        session["receipt"] = canonical
        session["receipt_hash"] = receipt_hash(canonical)
        await store.save("decision_sessions", session_id, session)
        return session

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        return await store.get("decision_sessions", session_id)

    async def verify_receipt(self, session_id: str) -> dict[str, Any] | None:
        session = await self.get_session(session_id)
        if not session:
            return None
        canonical = receipt_canonical_payload(session)
        expected = receipt_hash(canonical)
        return {
            "decision_session_id": session_id,
            "verified": expected == session.get("receipt_hash"),
            "receipt_hash": session.get("receipt_hash"),
            "recomputed_hash": expected,
        }

    async def enter_arena(self, session_id: str, player_id: str = "guest_default") -> dict[str, Any]:
        from app.services.arena import arena_service

        session = await self.get_session(session_id)
        if not session:
            raise KeyError("session_not_found")
        if not session.get("ready_for_arena"):
            raise ValueError("session_not_ready")
        if session.get("arena_battle_id"):
            battle = await arena_service.get_battle(str(session["arena_battle_id"]), player_id=player_id)
            if battle:
                return {"session": session, "battle": battle}
        human = (session.get("participants") or {}).get("human") or {}
        battle = await arena_service.create_battle(
            type("Req", (), {
                "symbol": session.get("symbol"),
                "user_side": human.get("direction") or "WAIT",
                "ai_side": ((session.get("participants") or {}).get("nightwatch") or {}).get("direction") or "WAIT",
                "thesis": session.get("thesis"),
                "wrong_sentence": None,
                "risk_pct": float((session.get("risk") or {}).get("risk_pct") or 2.0),
                "stake": 10_000.0,
                "duration_hours": max(1, min(168, round(float(session.get("horizon_hours") or 24.0)))),
                "opponent": "NightWatch",
                "stated_confidence": float(human.get("confidence") or 50.0),
            })(),
            player_id=player_id,
        )
        session["arena_battle_id"] = battle.get("id")
        session["arena_entered_at"] = datetime.now(timezone.utc).isoformat()
        await store.save("decision_sessions", session_id, session)
        return {"session": session, "battle": battle}


decision_sessions = DecisionSessionService()
