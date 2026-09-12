# AlphaArena Architecture

AlphaArena is intentionally split into a small interactive frontend, a deterministic application backend, and isolated external research/reasoning integrations.

```text
┌───────────────────────────────────────────────────────────────┐
│ React + Vite                                                  │
│ Pulse · NightWatch · MarketTwin · Arena · Review              │
│ friendly errors · responsive shell · paper guardrails         │
└──────────────────────────────┬────────────────────────────────┘
                               │ JSON / HTTPS
                               ▼
┌───────────────────────────────────────────────────────────────┐
│ FastAPI                                                       │
│                                                               │
│ Bitget adapter ───────────────► Reality public market data     │
│ Vibe adapter ─────────────────► research-only MCP sidecar      │
│ Signal adapter ────────────────► Bitget Signal MCP context     │
│ Qwen client ───────────────────► Groq-hosted Qwen 3.8 synthesis│
│                                                               │
│ deterministic analytics · budget fuse · paper ledger          │
│ immutable settlement · Pulse watcher · friendly problem API   │
└──────────────────────────────┬────────────────────────────────┘
                               │ optional
                               ▼
                           MongoDB Atlas
```

## Design rule: evidence before prose

The application should be useful even when Qwen is disabled.

Core calculations live in normal application code:

- market change/range/momentum metrics,
- volatility-based stress values,
- scenario parsing and transparent sensitivity priors,
- Vibe historical return statistics,
- beta/correlation calibration,
- paper PnL,
- free/deployed paper capital,
- settlement and leaderboard values.

Qwen receives those facts only after they exist. Its job is to challenge and explain, not manufacture the numbers the interface later treats as facts.

The hackathon configuration serves Qwen 3.8 27B through Groq with `reasoning_effort=high`, the strongest effort Groq currently accepts for that model. Structured calls use JSON mode with hidden reasoning, so chain-of-thought does not enter application content. Short rate limits honor Groq's `Retry-After` header within strict retry and wait caps. The transport remains OpenAI-compatible and provider-aware rather than claiming that Alibaba Cloud serves the current deployment.

## Frontend

The frontend is React + TypeScript + Vite. Version 4's editorial paper/Swiss visual direction remains the visual source of truth, but the hardening pass removes controls that looked interactive without doing anything.

The navigation hierarchy is deliberately small:

```text
Pulse     = what changed?
NightWatch= why might my thesis be wrong?
Lab       = what if the world changes?
Arena     = how does my paper thesis perform?
Portfolio = what is my virtual exposure?
Ranks     = how have recorded paper battles compared?
```

The app uses hash/history navigation so browser Back works without requiring a server-side SPA rewrite rule.

### Frontend reliability

`src/lib/api.ts` owns request timeouts and user-facing errors. Screens do not need to understand HTTP status codes. A render-level `ErrorBoundary` provides a final recovery screen without exposing stack traces.

Market data is loaded through `MarketDataProvider`. If the live API is unavailable, the interface can retain its clearly marked preview data rather than becoming an empty white screen.

## Backend

The FastAPI service is the trust boundary for product rules.

### Market service

`backend/app/services/bitget.py`

- discovers Reality instruments,
- maps display symbols to Bitget exchange symbols,
- reads tickers and hourly candles,
- validates prices,
- normalizes all market values used by the UI.

No trade endpoint is present.

### Analytics

`backend/app/services/analytics.py`

Contains transparent deterministic metrics and scenario sensitivities. MarketTwin may replace the Nasdaq sensitivity with measured Vibe beta only when the history quality gate passes.

### NightWatch

`backend/app/services/nightwatch.py`

Combines:

1. the user's explicit thesis,
2. live Bitget market evidence,
3. deterministic market/risk metrics,
4. Vibe historical research when available,
5. Bitget Signal context when available,
6. optional Qwen adversarial synthesis.

The deterministic fallback always remains available.

### MarketTwin

`backend/app/services/market_twin.py`

Parses one scenario, retrieves current market values, retrieves Vibe calibration where applicable, then calculates impact ranges before optional Qwen explanation.

The model prompt is explicitly forbidden from changing the numeric output.

### Arena

`backend/app/services/arena.py`

Arena is an internal paper ledger. It records:

- thesis,
- side,
- opponent stance,
- virtual stake,
- observed Bitget entry price,
- expiry,
- current/final mark.

Creation is serialized so concurrent requests cannot oversubscribe free paper capital. Settlement is immutable after the settlement price is captured.

### Review

`backend/app/services/review.py`

Post-battle review is available only after settlement. It frames a single result as one observation rather than proof of a profitable strategy. Qwen is optional; a deterministic review exists when model calls are unavailable or budget-exhausted.

### Pulse watcher

`backend/app/services/watcher.py`

The background watcher calls public market-derived Pulse logic only. It never invokes the LLM client. This lets a deployed backend stay “alive” without silently consuming model credits while no one is using the demo.

### Storage

`backend/app/services/storage.py`

Storage is deliberately abstracted behind a small repository layer:

- MongoDB when configured,
- in-process memory as a demo/development fallback.

The product remains functional without Atlas, while judges can still see how persistence would be wired.

## External integration failure model

Not all integrations have the same importance.

| Dependency | If unavailable |
| --- | --- |
| Bitget live market | live-price actions degrade/fail clearly; preview UI may remain labelled |
| Vibe-Trading | deterministic market analysis remains; historical sections say unavailable |
| Bitget Signal | macro/news context is omitted; core analysis remains |
| Qwen | deterministic NightWatch/MarketTwin/review fallback remains |
| MongoDB | in-memory session persistence remains |

This is intentional graceful degradation, not silent substitution.

### Bitget Signal two-level status

Bitget Signal reports two different statuses that must not be confused:

- `/api/integrations/diagnostics` reports `connected: true` when the Signal
  MCP endpoint answers `tools/list` (a single lightweight call, ~3s).
  This means the endpoint is reachable and tools are advertised.
- NightWatch/MarketTwin responses report `signal: "unavailable"` when the
  full `snapshot()` (one `has_tools` check plus up to seven tool calls)
  does not finish inside the 4s per-request budget
  (`asyncio.wait_for(..., timeout=4)` in `nightwatch.py` / `market_twin.py`).

Measured 2026-09-11 against the public Signal MCP: `tools/list` ~2.6s,
but individual tool calls take ~15-21s each, and the `global_assets`
price tool fails for every symbol (including SPY) after ~16s with an
empty upstream error, so it is excluded from `snapshot()`. Because a
full snapshot takes ~20s, it always exceeds the 4s budget. A background
`SignalWarmer` task (`backend/app/services/signal_warmer.py`, started in
the API lifespan alongside the Pulse watcher) therefore refreshes every
supported symbol in parallel ahead of time, so steady-state requests
serve Signal evidence from cache in milliseconds and report
`signal: connected`. The per-request `unavailable` label then means the
cache is cold (just after startup) or the upstream is down — never a
regression. The warmer performs public MCP reads only; scheduled LLM
calls remain zero. Raising the per-request timeout to ~25s would hold
user requests open and is deliberately not done; the timeout keeps
worst-case latency bounded.

## Security/deployment boundaries

- No Bitget exchange API secret is required for the current public-market product.
- No wallet connection exists.
- No broker channel is configured in Vibe.
- Vibe shell tools are disabled.
- Secrets live only in environment variables.
- `.env` files are ignored by Git.
- The API container runs as a non-root user.
- CORS origins are configurable.
- The API exposes a read-only health endpoint and structured integration diagnostics.

## Deployment shape

A simple hackathon deployment can use:

```text
Vercel/static host  -> frontend
Azure/container host -> FastAPI
Azure/container host -> Vibe sidecar
MongoDB Atlas        -> optional persistence
```

The repository also includes Docker Compose for a local two-service backend/Vibe environment.

## Scale caveats

The current application-side Qwen daily counter is in memory and the default API container intentionally runs one Uvicorn worker. If the API is scaled to multiple workers/replicas, move the model budget counter and any session-critical paper ledger state into shared persistence before describing limits or state as globally consistent.
