from __future__ import annotations

import asyncio
import signal

from app.config import settings
from app.services.decision_tape import decision_tape
from app.services.jev_bridge import JevBridgeError, jev_bridge


async def run() -> None:
    """Continuous paper-decision loop.

    This is intentionally a separate worker process, not part of the Vercel
    request lifecycle. It never places orders. Each iteration freezes a Bitget
    market snapshot, records AlphaArena's deterministic baseline, optionally
    asks the configured Jev adapter for a typed decision, then evaluates any
    previously recorded horizons that have matured.
    """
    interval = max(1.0, float(settings.decision_tape_interval_seconds))
    symbols = [
        item.strip()
        for item in settings.decision_tape_symbols.split(",")
        if item.strip()
    ] or ["rNVDA"]
    player_id = "guest_decision_worker"
    stopping = asyncio.Event()
    loop = asyncio.get_running_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stopping.set)
        except NotImplementedError:
            pass

    print(
        f"[decision-worker] interval={interval}s symbols={','.join(symbols)} "
        f"jev={'on' if jev_bridge.enabled else 'off'}"
    )

    while not stopping.is_set():
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
                        print(f"[decision-worker] {symbol} Jev skipped: {exc}")
            except Exception as exc:
                print(f"[decision-worker] {symbol} capture skipped: {exc}")

        try:
            await decision_tape.evaluate_due(player_id)
        except Exception as exc:
            print(f"[decision-worker] evaluation pass skipped: {exc}")

        try:
            await asyncio.wait_for(stopping.wait(), timeout=interval)
        except asyncio.TimeoutError:
            pass


if __name__ == "__main__":
    asyncio.run(run())
