from __future__ import annotations

import asyncio
import signal
from datetime import datetime, timezone

from app.config import settings
from app.services.decision_tape import GLOBAL_TAPE_PLAYER_ID, decision_tape
from app.services.jev_bridge import JevBridgeError, jev_bridge
from app.services.storage import store


async def run() -> None:
    """Continuous paper-decision loop.

    This is intentionally a separate worker process, not part of the Vercel
    request lifecycle. It never places orders. Each iteration freezes a Bitget
    market snapshot, records AlphaArena's deterministic baseline, optionally
    asks the configured Jev adapter for a typed decision, then evaluates any
    previously recorded horizons that have matured.
    """
    if not store.durable:
        raise RuntimeError(
            "Decision Tape worker requires durable MongoDB storage. "
            "Set MONGODB_URI before starting the worker."
        )

    interval = max(1.0, float(settings.decision_tape_interval_seconds))
    symbols = [
        item.strip()
        for item in settings.decision_tape_symbols.split(",")
        if item.strip()
    ] or ["rNVDA"]
    player_id = GLOBAL_TAPE_PLAYER_ID
    stopping = asyncio.Event()
    loop = asyncio.get_running_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stopping.set)
        except NotImplementedError:
            pass

    started_at = datetime.now(timezone.utc).isoformat()
    await store.save(
        "service_status",
        "decision_worker",
        {
            "id": "decision_worker",
            "service": "decision_worker",
            "status": "starting",
            "started_at": started_at,
            "heartbeat_at": started_at,
            "interval_seconds": interval,
            "symbols": symbols,
            "jev_enabled": jev_bridge.enabled,
            "last_error": None,
            "updated_at": started_at,
        },
    )
    print(
        f"[decision-worker] interval={interval}s symbols={','.join(symbols)} "
        f"jev={'on' if jev_bridge.enabled else 'off'}"
    )

    while not stopping.is_set():
        iteration_error: str | None = None
        for symbol in symbols:
            try:
                captured = await decision_tape.capture_snapshot(symbol, player_id)
                snapshot = captured["snapshot"]
                if jev_bridge.enabled:
                    try:
                        jev = await jev_bridge.decide(snapshot)
                        if jev is not None:
                            await decision_tape.submit(
                                str(snapshot["id"]),
                                "jev",
                                str(jev["direction"]),
                                float(jev["confidence"]),
                                player_id=player_id,
                                model=str(jev["model"]),
                                latency_ms=float(jev["latency_ms"]),
                                note=str(jev["note"]),
                                metadata=jev["metadata"],
                            )
                    except JevBridgeError as exc:
                        iteration_error = f"{symbol} Jev skipped: {exc}"
                        print(f"[decision-worker] {iteration_error}")
            except Exception as exc:
                iteration_error = f"{symbol} capture skipped: {exc}"
                print(f"[decision-worker] {iteration_error}")

        try:
            await decision_tape.evaluate_due(player_id)
        except Exception as exc:
            iteration_error = f"evaluation pass skipped: {exc}"
            print(f"[decision-worker] {iteration_error}")

        heartbeat = datetime.now(timezone.utc).isoformat()
        await store.save(
            "service_status",
            "decision_worker",
            {
                "id": "decision_worker",
                "service": "decision_worker",
                "status": "running" if iteration_error is None else "degraded",
                "started_at": started_at,
                "heartbeat_at": heartbeat,
                "interval_seconds": interval,
                "symbols": symbols,
                "jev_enabled": jev_bridge.enabled,
                "last_error": iteration_error,
                "updated_at": heartbeat,
            },
        )

        try:
            await asyncio.wait_for(stopping.wait(), timeout=interval)
        except asyncio.TimeoutError:
            pass

    stopped_at = datetime.now(timezone.utc).isoformat()
    await store.save(
        "service_status",
        "decision_worker",
        {
            "id": "decision_worker",
            "service": "decision_worker",
            "status": "stopped",
            "started_at": started_at,
            "heartbeat_at": stopped_at,
            "interval_seconds": interval,
            "symbols": symbols,
            "jev_enabled": jev_bridge.enabled,
            "last_error": None,
            "updated_at": stopped_at,
        },
    )


if __name__ == "__main__":
    asyncio.run(run())
