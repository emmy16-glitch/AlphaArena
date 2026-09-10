# Budget and Safety Contract

AlphaArena is intentionally designed so the hackathon demo cannot silently turn into an expensive or real-money trading system.

## Non-negotiable product rules

1. **Paper capital only.** Arena begins with a configurable `$100,000` virtual balance. It is not an exchange balance, cannot be deposited or withdrawn, and never leaves AlphaArena storage.
2. **No trade execution.** The backend may read Bitget Reality market data, but it must not call Bitget trade/order endpoints.
3. **No background model spending.** The always-on Pulse watcher may poll public market data and calculate deterministic metrics only. Model reasoning is user-triggered.
4. **Deterministic numbers remain deterministic.** Qwen may explain or challenge supplied calculations, but MarketTwin's numeric impact ranges are produced by AlphaArena code and cannot be replaced by generated values.
5. **Missing evidence stays missing.** A failed Vibe/Signal/model call must degrade to a clearly labelled fallback; it must never be filled with invented evidence.

## Default resource budget

The current defaults are in `backend/app/config.py` and mirrored in `backend/.env.example` and `compose.yml`.

| Resource | Default | Purpose |
| --- | ---: | --- |
| `ARENA_STARTING_CAPITAL` | `100000` | Fixed paper starting balance |
| `QWEN_DAILY_ATTEMPT_LIMIT` | `12` | Application-side fuse against accidental call loops |
| `QWEN_MAX_ATTEMPTS_PER_REQUEST` | `1` | No hidden model retry multiplication |
| `QWEN_MAX_OUTPUT_TOKENS` | `1400` | Bound response size/cost |
| `QWEN_TIMEOUT_SECONDS` | `35` | Bound user wait time and hanging requests |
| `VIBE_CACHE_SECONDS` | `900` | Reuse expensive historical research for 15 minutes |
| `SIGNAL_CACHE_SECONDS` | `300` | Reuse macro/news context for 5 minutes |
| `WATCHER_INTERVAL_SECONDS` | `60` | Low-cost Pulse market refresh cadence |
| `VIBE_TRADING_ENABLE_SHELL_TOOLS` | `0` | Keep the Vibe sidecar research-only |

## What the Qwen counter means

`QWEN_DAILY_ATTEMPT_LIMIT` is **not** the Groq account quota and is not an estimate of provider billing. It is a local AlphaArena safety fuse.

The current implementation stores that counter in memory and reports its accounting scope through `GET /api/budget/status`. Because the API container intentionally runs one Uvicorn worker, it behaves as a single-process demo fuse. A production deployment with multiple replicas must move the counter to a shared store before anyone describes it as a deployment-wide limit.

If the fuse is exhausted, NightWatch, MarketTwin and post-battle review keep their deterministic fallback paths. The user does not lose access to the paper product.

The current inference path is Groq-hosted Qwen 3.6 27B. AlphaArena requests JSON mode with hidden reasoning for structured production calls, caps each completion, and never exposes model reasoning fields to users. Provider failures are stored as small diagnostic categories without prompts, credentials, authorization headers or full upstream response bodies.

## Paper portfolio invariants

`ArenaService` serializes battle creation with an async lock. This prevents two simultaneous requests from both seeing the same free paper balance and oversubscribing it.

For a non-WAIT paper position:

```text
requested virtual stake <= current free virtual capital
```

Open stakes reduce free capital. PnL changes the marked net value, but settlement freezes the observed settlement price and result. Re-reading an already settled battle cannot rewrite it with a newer market price.

A unit test explicitly races two `$60,000` battle requests against a `$100,000` portfolio and requires exactly one to succeed.

## Real-money execution guard

The Bitget Reality guide documents order endpoints, including `POST /api/v3/trade/place-reality-order`. AlphaArena intentionally does not implement them.

CI scans the backend application source and fails if either of these strings appears in executable application code:

```text
place-reality-order
/api/v3/trade/
```

That static guard complements the product architecture; it is not a substitute for code review.

## Background-cost guard

`PulseWatcher` imports the deterministic Pulse service and storage only. It never imports or invokes the model client. CI checks the watcher source so a model call cannot be quietly added to the timer without breaking tests.

The watcher also stores a friendly retry message rather than raw connector/network exceptions, preventing operational details from leaking into user-visible diagnostics.

## Vibe-Trading isolation

Vibe-Trading runs in a separate sidecar container and is configured with:

```text
VIBE_TRADING_ENABLE_SHELL_TOOLS=0
```

AlphaArena calls the sidecar only for research data. Broker/execution channels are outside the AlphaArena integration. The sidecar version is pinned to `vibe-trading-ai==0.1.15` so an upstream release cannot silently change the hackathon environment.

## Failure behavior

The backend returns a small structured problem object:

```json
{
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "Live market data or research is taking longer than usual.",
    "action": "Try again in a moment. Your paper balance was not changed.",
    "retryable": true
  }
}
```

The frontend centralizes these responses and deliberately removes tracebacks, connector URLs, HTTP 5xx strings and low-level network errors from user-facing copy.

## Before increasing any budget

Do not increase model attempts, output size, watcher frequency or research refresh rate just to make the product feel more “AI.” First verify that the extra call creates visible judge/user value. The core product must remain useful with Qwen unavailable because evidence collection, stress calculations, paper PnL and settlement are not supposed to depend on generated text.
