# Vibe-Trading Research Layer

AlphaArena integrates Vibe-Trading as a **research-only MCP sidecar**. The goal is not to delegate the product to another agent; the goal is to retrieve auditable U.S.-equity evidence and let AlphaArena calculate transparent market statistics from that evidence.

Upstream project:

- Repository: https://github.com/HKUDS/Vibe-Trading
- PyPI release used by AlphaArena: https://pypi.org/project/vibe-trading-ai/0.1.15/

The hackathon deployment pins:

```text
vibe-trading-ai==0.1.15
```

Version pinning prevents an upstream release from silently changing MCP tools or behavior immediately before judging.

## Isolation model

The sidecar is defined by `backend/Dockerfile.vibe` and launched as a Streamable HTTP MCP service on port `8900`.

```text
FastAPI ──HTTP MCP──> Vibe-Trading sidecar
```

The container sets:

```text
VIBE_TRADING_ENABLE_SHELL_TOOLS=0
```

AlphaArena does not configure Vibe broker/execution channels. Its integration is limited to research requests.

## Research requested per symbol

`backend/app/services/vibe.py` maps the display Reality symbol to the U.S. underlying:

```text
rNVDA -> NVDA
rTSLA -> TSLA
rAAPL -> AAPL
rMSFT -> MSFT
rAMD  -> AMD
rQQQ  -> QQQ
```

The research snapshot can request the following MCP tools when available:

- `get_market_data`
- `technical_indicators`
- `get_fundamentals`
- `get_stock_news`
- `get_sec_filings`
- `get_financial_statements`

The historical request retrieves the underlying plus QQQ benchmark over a bounded lookback. Raw evidence is clipped before it is passed deeper into the product so a very large provider response cannot explode context size.

## Statistics AlphaArena calculates itself

Vibe supplies observations. AlphaArena calculates the decision metrics locally.

### Daily return

For aligned closing prices:

```text
return_t = (close_t / close_(t-1) - 1) * 100
```

### 20-day momentum

When at least 21 closes exist:

```text
momentum_20d = (latest_close / close_20_sessions_ago - 1) * 100
```

### Annualized historical volatility

```text
population_std(daily_returns) * sqrt(252)
```

### Maximum drawdown

AlphaArena walks the closing-price series, keeps the running peak and records the worst percentage decline from that peak.

### QQQ beta and correlation

Asset and QQQ daily returns are paired by the date key returned in the historical data. AlphaArena refuses to calculate usable calibration until at least **20 paired observations** are available.

Beta is computed as:

```text
cov(asset_returns, qqq_returns) / var(qqq_returns)
```

Correlation is calculated from the same aligned pairs.

This matters because MarketTwin may use a measured beta for a Nasdaq shock only when the calibration has enough observations. If the requirement is not met, it falls back to a clearly labelled transparent sensitivity prior.

## Historical analogues

AlphaArena does not ask an LLM to invent “similar historical events.”

For the retrieved daily return series it:

1. measures the latest daily move,
2. filters older moves to the same direction,
3. ranks them by absolute distance from the latest move size,
4. returns the closest observations,
5. reports the actually observed next daily move.

Every analogue includes language stating that it is an observation and **not a prediction**.

This is intentionally less cinematic than fabricated historical storytelling and much more defensible to judges.

## How NightWatch uses Vibe

NightWatch uses verified Vibe fields as evidence, not as automatic trade instructions. Examples include:

- 20-day underlying momentum,
- historical volatility and return-tail context,
- QQQ beta/correlation,
- mechanically selected analogues,
- retrieved technical/fundamental/news evidence available to the reasoning layer.

If Vibe is unavailable, NightWatch still produces a deterministic market/risk analysis and explicitly reports that verified historical context is unavailable.

## How MarketTwin uses Vibe

For a Nasdaq-class shock, MarketTwin checks the Vibe calibration for each asset. If measured beta and at least 20 observations are available, that beta enters the deterministic stress engine. Current Bitget volatility widens the uncertainty range.

The resulting numeric impacts are calculated before Qwen is called. Qwen may explain the supplied numbers but its system prompt explicitly says never to replace or invent them.

For non-Nasdaq shock categories, AlphaArena currently uses documented transparent sensitivity priors instead of pretending that every narrative event has a historically estimated causal coefficient.

## Caching and resource discipline

Historical/fundamental research is much more expensive than a live ticker fetch. AlphaArena therefore caches each Vibe symbol/lookback snapshot for `VIBE_CACHE_SECONDS`, default `900` seconds.

The cache key includes the underlying ticker and lookback period. A cached snapshot includes provenance and the derived statistics so repeated NightWatch/MarketTwin actions on the same symbol do not immediately repeat all upstream calls.

## Provenance

When the upstream market-data response contains `_provenance`, AlphaArena carries it into the Vibe snapshot and calibration object. This lets future UI/debugging distinguish measured history from a fallback model.

`GET /api/research/vibe/{symbol}` exposes the normalized research snapshot for development/judging diagnostics. The user-facing product should show concise source labels rather than raw MCP payloads.

## Failure rules

A failed individual Vibe tool call should not collapse the entire research snapshot. Each tool is isolated and the service returns whatever verified evidence succeeded.

A total Vibe failure must result in:

- `connected: false`,
- no fabricated historical statistics,
- no fabricated analogues,
- a readable availability message,
- deterministic AlphaArena fallback behavior.

Raw stack traces, connector URLs and internal MCP errors are not intended for the public UI.

## CI verification

The CI Vibe smoke job installs the exact pinned release, asserts the installed version is `0.1.15`, verifies that the MCP executable starts sufficiently to expose its CLI, and verifies that deployment keeps `VIBE_TRADING_ENABLE_SHELL_TOOLS=0`.

Separately, backend unit tests verify the beta/correlation calculations and require mechanically generated analogues to retain the “not a prediction” contract.
