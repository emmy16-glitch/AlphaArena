# Decision Tape — measurable Human / NightWatch / Jev / baseline decisions

Decision Tape is AlphaArena's continuous decision-evaluation layer.

The rule is simple:

1. Capture one Bitget Reality market snapshot.
2. Give every decision-maker the same snapshot ID.
3. Record a typed `LONG`, `SHORT`, or `WAIT` decision plus confidence and latency.
4. Score the decision against timestamp-targeted Bitget candles at 5m, 30m, 1h, and 24h.
5. Compare hit rate, signed return, and Brier calibration by lane.

This is deliberately separate from real-money execution. It creates observations, not orders.

## API flow

### 1. Capture one shared snapshot

```http
POST /api/decision-tape/snapshots
Content-Type: application/json

{"symbol":"rNVDA"}
```

The response contains:

- the frozen Bitget price/state,
- a unique `snapshot.id`,
- an automatically generated deterministic baseline decision.

### 2. Submit a lane decision

```http
POST /api/decision-tape/decisions
Content-Type: application/json
X-Player-ID: guest_example

{
  "snapshot_id": "snap_...",
  "lane": "jev",
  "direction": "LONG",
  "confidence": 78,
  "model": "jev",
  "latency_ms": 184,
  "note": "typed decision from Jev bridge",
  "metadata": {
    "provider": "typesafe"
  }
}
```

Allowed externally submitted lanes are `human`, `nightwatch`, `jev`, and `other`. The `baseline` lane is created by AlphaArena itself so callers cannot spoof the benchmark.

## Jev bridge boundary

Jev is currently early access. AlphaArena therefore does **not** hard-code an unofficial TypeSafe request format.

The bridge only needs to do this:

```text
AlphaArena snapshot
       ↓
your Jev early-access client
       ↓
typed decision:
  direction = LONG | SHORT | WAIT
  confidence = 0..100
  latency_ms
       ↓
POST /api/decision-tape/decisions
```

This keeps AlphaArena independent of SDK/API churn while preserving the important scientific property: every lane is evaluated against the **same captured state and the same later market timestamps**.

## Evaluation

`POST /api/decision-tape/evaluate` scores all matured observations.

`GET /api/decision-tape/summary` returns per-lane/per-horizon:

- number of evaluated decisions,
- directional hit rate,
- average signed return,
- Brier score.

`WAIT` is counted as correct when the absolute move stays within the explicit 0.10% deadband. The deadband is returned in the API response so the rule is never hidden.

The summary endpoint also evaluates any decisions that have become due since the previous request.

## Why this exists

The target question is not:

> Which model sounds smartest?

It is:

> Given the same market state, which decision process is best calibrated, at which horizon, and under which conditions?

That makes Jev one measurable lane rather than an oracle, and it lets AlphaArena compare humans, NightWatch, Jev, and deterministic code without changing the paper-only safety boundary.
