# AlphaArena

**Predict less. Test more. Let the market decide.**

AlphaArena is an evidence-first AI trading desk for tokenized U.S. equities. It helps a trader turn a market idea into a falsifiable thesis, challenge it with opposing evidence, simulate adverse scenarios, and then test the thesis with **virtual capital** against observed Bitget Reality prices.

AlphaArena does **not** place real-money trades. The human remains the decision-maker.

## The 60-second judge flow

1. **Pulse — Watch.** Open the live market feed and choose a Reality asset worth investigating.
2. **NightWatch — Challenge.** State a direction and thesis. AlphaArena builds the strongest support and objection, shows evidence quality, stress scenarios and explicit invalidation conditions.
3. **MarketTwin — Simulate.** Change one market assumption — for example, “Nasdaq falls 5%” — and inspect transparent impact ranges. Historical beta is used only when Vibe-Trading returns enough aligned observations; otherwise the UI says that a transparent AlphaArena prior was used.
4. **Arena — Test.** Record a paper position at the live Bitget Reality market price. The battle is settled from later observed market prices and then frozen, so the result cannot be rewritten after the fact.
5. **Review — Learn.** After settlement, compare the original thesis with the outcome and create a falsifiable rule for the next paper battle.

That produces one connected loop:

**Watch → Challenge → Simulate → Battle → Review → Improve**

## Why this is different

AlphaArena is deliberately not another “AI says BUY” dashboard. It separates facts, models and opinions:

- **Bitget Reality** supplies current rToken market evidence.
- **Vibe-Trading** supplies historical U.S.-equity research and mechanically derived calibration.
- **Bitget Signal** supplies macro and cross-asset context when available.
- **Deterministic AlphaArena code** calculates market metrics, stress impacts, uncertainty and paper PnL.
- **Qwen** is an optional reasoning/synthesis layer. It is not allowed to overwrite deterministic scenario numbers or invent missing evidence.
- **Arena** uses a fixed paper balance. There is no wallet connection, deposit, withdrawal or exchange order endpoint in the product.

## Bitget implementation

AlphaArena uses Bitget UTA v3 Reality market data. Reality pairs are tokenized U.S. stock pairs identified by an `r` prefix such as `rAAPLUSDT`.

The backend adapter uses only market-data routes:

- `GET /api/v3/market/instruments?category=SPOT` — discover instruments and verify the `isReality` flag.
- `GET /api/v3/market/tickers` — live price, 24h change, bid/ask, turnover and range.
- `GET /api/v3/market/candles` — Reality market candlesticks used for the live sparkline and short-window risk metrics.

AlphaArena intentionally contains **no** call to Bitget's Reality order-placement or UTA trade endpoints. CI contains a guard test that fails if a Reality order path or `/api/v3/trade/` path appears in the backend application.

Bitget currently notes that access to some Reality market data can depend on whitelist/account availability. The frontend therefore labels fallback/preview states rather than presenting unavailable data as live.

See [docs/BITGET_INTEGRATION.md](docs/BITGET_INTEGRATION.md).

## Vibe-Trading implementation

Vibe-Trading runs as a separate, pinned, **research-only MCP sidecar**. The deployment pins `vibe-trading-ai==0.1.15` and disables Vibe shell tools.

For a supported underlying, AlphaArena can request:

- historical daily market data for the stock and QQQ benchmark,
- technical indicators,
- fundamentals,
- stock news,
- SEC filings,
- financial statements.

AlphaArena then calculates locally:

- daily returns,
- 20-day momentum,
- annualized historical volatility,
- maximum drawdown,
- return deciles,
- aligned beta and correlation to QQQ,
- mechanically selected same-direction historical analogues.

The analogues are explicitly observations, **not predictions**. Historical beta requires at least 20 paired observations before MarketTwin may use it as calibration. Research responses are cached to protect latency and free resources.

See [docs/VIBE_TRADING.md](docs/VIBE_TRADING.md).

## Budget and safety rules

The default hackathon configuration is intentionally conservative:

| Guardrail | Default |
| --- | ---: |
| Arena starting balance | `$100,000` virtual |
| Real-money trading | Disabled / no execution route |
| Scheduled background LLM calls | `0` |
| Qwen attempts per user request | `1` |
| Qwen application-side attempts/day | `12` per API process |
| Qwen maximum output | `1,400` tokens/attempt |
| Vibe research cache | `900s` |
| Bitget Signal cache | `300s` |
| Vibe shell tools | Disabled |

The Qwen daily counter is an **AlphaArena safety fuse**, not a claim about Alibaba Cloud billing or provider quota. Provider billing remains the source of truth. The default API container runs one worker; if the service is horizontally scaled, the counter must move to shared persistence before it can be treated as a deployment-wide limit.

See [docs/BUDGET_AND_SAFETY.md](docs/BUDGET_AND_SAFETY.md).

## Architecture

```text
React + Vite UI
      │
      ▼
FastAPI application
  │       │        │        │
  │       │        │        └── optional MongoDB persistence
  │       │        └─────────── Qwen reasoning (user-triggered, budget fused)
  │       └──────────────────── Bitget Signal MCP context
  ├──────────────────────────── Vibe-Trading MCP sidecar (research only)
  └──────────────────────────── Bitget UTA v3 Reality market data
```

The deterministic decision engine sits in the FastAPI service. External reasoning/research failures degrade to transparent fallbacks instead of blocking the whole product.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Local development

### Frontend

```bash
npm install
cp .env.example .env
npm run dev
```

The frontend defaults to `http://localhost:8000` for the API. Set `VITE_API_BASE_URL` when deploying separately.

### Backend + Vibe sidecar

The shortest full-stack path is Docker Compose:

```bash
cp backend/.env.example backend/.env
# Put QWEN_API_KEY in your shell/.env only if you want optional Qwen synthesis.
docker compose up --build
```

Or run the API directly:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Without a configured Vibe sidecar, Qwen key or MongoDB URI, AlphaArena still exposes its deterministic/paper functionality and clearly reports which integrations are unavailable.

## Verification

```bash
npm run typecheck
npm run build
npm run test:e2e

cd backend
ruff check app tests
pytest -q
python -m compileall -q app
```

GitHub Actions also runs browser tests across Chromium, Firefox and WebKit plus iPhone, Android, tablet and a 320×568 hostile viewport. The checks cover horizontal overflow, browser navigation, responsive controls, mobile form typography, reduced motion, NightWatch, MarketTwin, paper-only guardrails and human-readable error handling.

See [docs/TESTING_AND_UX.md](docs/TESTING_AND_UX.md).

## API diagnostics

Useful read-only endpoints:

- `GET /api/health`
- `GET /api/integrations/status`
- `GET /api/integrations/diagnostics`
- `GET /api/budget/status`
- `GET /api/market/instruments/reality`
- `GET /api/market/assets`
- `GET /api/pulse/status`

`/api/budget/status` makes the paper-only and model-budget guarantees visible rather than leaving them as README promises.

## Product truth rules

AlphaArena should never claim:

- a simulated impact is a prediction,
- one paper battle proves a repeatable edge,
- a historical analogue predicts the next move,
- unavailable research is live evidence,
- a virtual balance is withdrawable money,
- a Bitget trade was placed.

If evidence is unavailable, the product should say so. If an integration fails, the UI should remain understandable and show an actionable message instead of an HTTP status, traceback or connector error.

## Hackathon track

Built for **Bitget AI Base Camp S2 — AI Trading Desk / Decision Stress-Testing**.

The project is designed to demonstrate a real decision workflow around Bitget Reality market data while keeping financial execution outside the scope of the demo.
