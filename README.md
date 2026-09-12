# AlphaArena

> **Predict less. Test more. Let the market decide.**

[![CI](https://github.com/emmy16-glitch/AlphaArena/actions/workflows/ci.yml/badge.svg)](https://github.com/emmy16-glitch/AlphaArena/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node >= 20.19](https://img.shields.io/badge/node-%3E%3D20.19-brightgreen.svg)](package.json)
[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](backend/requirements.txt)

**AlphaArena** is an evidence-first AI trading desk for tokenized U.S. equities, built for **Bitget AI Base Camp S2 — AI Trading Desk / Decision Stress-Testing**.

It turns a market idea into a falsifiable thesis, challenges it with opposing evidence, simulates adverse scenarios, and tests it with **virtual capital** against observed **Bitget Reality** prices.

**AlphaArena never places real-money trades. The human remains the decision-maker.**

| Resource | Link |
| --- | --- |
| 🌐 **Live demo (Vercel)** | **https://alphaarena.vercel.app** |
| 📦 Repository | https://github.com/emmy16-glitch/AlphaArena |
| 📖 Full docs hub | [docs/README.md](docs/README.md) |
| 🎬 3-minute judge script | [docs/JUDGE_DEMO.md](docs/JUDGE_DEMO.md) |
| 🚀 Deployment guide | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

---

## Table of contents

- [The 60-second judge flow](#the-60-second-judge-flow)
  - [Judging without Bitget Reality access](#judging-without-bitget-reality-access)
- [Why this is different](#why-this-is-different)
- [Features](#features)
- [Shadow Session](#shadow-session-the-market-that-never-sleeps)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Bitget implementation](#bitget-implementation)
- [Vibe-Trading implementation](#vibe-trading-implementation)
- [Budget and safety rules](#budget-and-safety-rules)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Verification](#verification)
- [API diagnostics](#api-diagnostics)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Product truth rules](#product-truth-rules)
- [Documentation](#documentation)
- [Hackathon submission](#hackathon-submission-track-3-us-stock-ai-trading)
- [Hackathon track](#hackathon-track)
- [Contributing](#contributing)
- [License](#license)

---

## The 60-second judge flow

1. **Pulse — Watch.** Open the live market feed and choose a Reality asset worth investigating.
2. **NightWatch — Challenge.** State a direction and thesis. AlphaArena builds the strongest support and objection, shows evidence quality, stress scenarios, and explicit invalidation conditions.
3. **MarketTwin — Simulate.** Change one market assumption — e.g. “Nasdaq falls 5%” — and inspect transparent impact ranges. Historical beta is used only when Vibe-Trading returns enough aligned observations; otherwise the UI says a transparent AlphaArena prior was used.
5. **Arena — Test.** Commit the thesis to a paper battle at the live Bitget Reality market price. Enter the **Shadow Session commitment** — *"If I am wrong, it will be because…"* — which is locked, hashed into the freeze, and read back verbatim. Set a kill level. The battle is settled from later observed market prices and frozen so the result cannot be rewritten.
6. **Shadow Session — the tape that never sleeps.** Because Bitget Reality trades 24/7, every battle splits its move into **Listed** (NYSE hours) vs **Shadow** (nights, weekends, holidays) from real candles. You see exactly *where* the move occurred — including a kill at 03:11 UTC on a Saturday — with honest ~1h candle-bucket timestamps.
7. **Morgue — dead theses, with receipts.** Settled battles only, showing the verbatim sentence, the session badge, survival/kill status, and the frozen hash. Verify the freeze with one click: **`hash matches`**.
8. **Review — Learn.** After settlement, compare the original thesis with the outcome and create a falsifiable rule for the next paper battle.

One connected loop:

**Watch → Challenge → Simulate → Battle → Shadow → Review → Improve**

For a rehearsed walkthrough, see [docs/JUDGE_DEMO.md](docs/JUDGE_DEMO.md).

### Judging without Bitget Reality access

Bitget notes that Reality market-data availability can depend on whitelist/account access. If live data is unreachable, AlphaArena stays open in a clearly labelled preview state — it never relabels preview data as live.

- **Still judges:** Pulse preview rows (`Preview` / `Design preview`), the full deterministic/paper surface (`GET /api/budget/status`, existing battles, `GET /api/arena/export.json` + `verify_battles.py`, reproducible backtest script).
- **Fails clearly instead of faking:** NightWatch, MarketTwin and Arena creation need an observed Bitget price, so they return a human retry message (`Live market data or research is taking longer than usual…`) before any virtual capital is consumed.
- **How to tell:** header shows `Limited market data`, `GET /api/integrations/diagnostics` shows `bitget.connected: false`.

See [docs/DEMO_MODE.md](docs/DEMO_MODE.md).

---

## Why this is different

AlphaArena is deliberately **not** another “AI says BUY” dashboard. It separates facts, models, and opinions:

- **Bitget Reality** supplies current rToken market evidence.
- **Vibe-Trading** supplies historical U.S.-equity research and mechanically derived calibration.
- **Bitget Signal** supplies macro and cross-asset context when available.
- **Deterministic AlphaArena code** calculates market metrics, stress impacts, uncertainty, and paper PnL.
- **Qwen 3.8 27B** (via Groq, free hackathon path) is the optional high-reasoning synthesis layer. It may explain results but **cannot overwrite deterministic numbers or invent missing evidence**.
- **Arena** uses a fixed paper balance. There is no wallet connection, deposit, withdrawal, or exchange order endpoint anywhere in the product.
- **Shadow Session** is the differentiator that only makes sense because Bitget Reality is **24/7** while the real NYSE is not. Splitting every battle move into **Listed** vs **Shadow** turns the after-hours gap into *live, tradable tape* — and the settlement card reads your own commitment sentence back to you verbatim.

---

## Shadow Session — the market that never sleeps

Bitget Reality tokenized stocks (`rNVDA`, `rAAPL`, …) trade 24/7. The real NYSE only trades **Mon–Fri 09:30–16:00 America/New_York**. Everything else — nights, weekends, and holidays — is the **Shadow session**: live tape while Wall Street is closed.

### Session boundary

- **Listed** = inside NYSE cash hours on a non-holiday weekday (Eastern Time).
- **Shadow** = everything else (nights, weekends, full-day US market holidays).
- DST is handled by `zoneinfo("America/New_York")` — the open shifts automatically between 13:30–20:00 UTC (DST) and 14:30–21:00 UTC (standard), no manual table needed. A small hardcoded 2025–2026 US holiday list covers full-day Shadow for demo scope.

### Commitment ritual (hashed into the freeze)

At battle creation the user must complete: **"If I am wrong, it will be because ___"**. The sentence is stored in the **same object** as the paper freeze and included in the same `settlement_hash` canonical payload — changing one word changes the hash. At settlement it is read back **verbatim**, never paraphrased by any AI.

### Where-the-move-occurred bars

At settlement (and live), AlphaArena pulls real Bitget candles and splits the entry→now move into Listed vs Shadow:

```text
Listed:  +0.4% █▁
Shadow: −3.1% ██████
Kill hit ~03:11 UTC — in Shadow session.
You said: "If I am wrong, it will be because weekend tape gaps against me."
```

- The **Kill hit** line only appears when the kill level was *actually touched* on the observed candle path (`kill_check`); otherwise the card says **"Thesis survived — kill level was not touched."**
- **Flatten-before-dark** shows the counterfactual: what you would have had if you'd closed at the last Listed close (observed arithmetic, never a recommendation).
- **Honest granularity:** candles are ~1h buckets, so timestamps show `~03:11 UTC` with a `Timestamps are candle-bucket estimates, not exact fills.` disclaimer. If a 1-minute feed is ever available, switch one interval and the `~` disappears automatically.

### Thesis Morgue (`#/morgue`)

Other desks show wins. This wall shows **dead theses with receipts**: the verbatim sentence, a `killed` / `survived` pill, the session badge, and the frozen hash. Use **Verify freeze** on any settled battle to prove it was never rewritten.

Pure data bucketing + string playback. **No new LLM calls for this feature.**

See [docs/SHADOW_SESSION.md](docs/SHADOW_SESSION.md).

---

## Features

| Area | What you get |
| --- | --- |
| 📡 **Pulse** | Live Reality market feed, movers, short-window risk context, background watcher with zero LLM calls |
| ⚖️ **NightWatch** | Adversarial thesis analysis: strongest support vs. strongest objection, evidence quality, deterministic stress cases, invalidation conditions |
| 🧪 **MarketTwin (Lab)** | Single-assumption what-if engine with transparent impact ranges and labelled calibration source (measured Vibe beta vs. AlphaArena prior) |
| 🏟️ **Arena** | Paper battles at observed live prices, LONG / SHORT / WAIT, serialized capital checks, immutable settlement |
| 🌙 **Shadow Session** | Listed vs Shadow move attribution from real candles, "If I am wrong…" commitment hashed into the freeze and read back verbatim, kill/survive receipt, flatten-before-dark counterfactual ([docs/SHADOW_SESSION.md](docs/SHADOW_SESSION.md)) |
| 💀 **Thesis Morgue** | Settled dead theses only — verbatim sentence, session badge, kill/survive status, frozen hash, one-click **Verify freeze** |
| 📊 **Portfolio & Ranks** | Virtual exposure tracking and settled-battle leaderboard (one observation, never “proof of edge”) |
| 📝 **Review** | Post-settlement learning: thesis-vs-outcome comparison with deterministic fallback when the model is unavailable |
| 🛡️ **Guardrails** | Paper-only ledger, model budget fuse, human-readable errors, graceful degradation for every integration |
| 📼 **Demo mode** | Clearly labelled preview state when Bitget Reality is unreachable — judges the deterministic/paper surface, never fakes live data ([docs/DEMO_MODE.md](docs/DEMO_MODE.md)) |
| 🧾 **Evidence export** | Arena export (`export.json` + CSV with `settlement_hash`), `verify_battles.py` checker, reproducible backtest report, portfolio stress test over the same deterministic engine |
| 📱 **Responsive + a11y** | Chromium / Firefox / WebKit + iPhone / Pixel / tablet / 320px matrix, WCAG 2.2 AA target, reduced-motion support |

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4, Lucide icons |
| Backend | FastAPI (Python 3.12), deterministic analytics engine |
| Market data | Bitget UTA v3 Reality public market data |
| Research | Vibe-Trading MCP sidecar (`vibe-trading-ai==0.1.15`, research-only) |
| Macro context | Bitget Signal MCP (cached, time-bounded) |
| Reasoning (optional) | Qwen 3.8 27B via Groq, user-triggered, budget-fused |
| Persistence (optional) | MongoDB Atlas, with in-memory fallback |
| Testing | Playwright (7-project matrix), pytest, ruff, `tsc`, Vite build |
| Deployment | Vercel (frontend + serverless API, see `vercel.json` / `api/index.py`), Docker Compose for backend + Vibe sidecar |

---

## How it works

```text
React + Vite UI  (Pulse · NightWatch · MarketTwin · Arena · Shadow Session · Morgue · Review)
       │
       ▼ JSON / HTTPS
FastAPI application
  │       │        │        │
  │       │        │        └── optional MongoDB persistence
  │       │        └─────────── Qwen 3.8 high reasoning via Groq (user-triggered, budget fused)
  │       └──────────────────── Bitget Signal MCP context
  ├──────────────────────────── Vibe-Trading MCP sidecar (research only)
  └──────────────────────────── Bitget UTA v3 Reality market data (+ candles for Shadow attribution)
```

The deterministic decision engine sits in the FastAPI service (`backend/app/`). External reasoning/research failures degrade to transparent fallbacks instead of blocking the product.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Bitget implementation

AlphaArena uses Bitget **UTA v3 Reality** market data. Reality pairs are tokenized U.S. stock pairs with an `r` prefix, e.g. `rAAPLUSDT`. Supported universe: `rNVDA`, `rTSLA`, `rAAPL`, `rMSFT`, `rAMD`, `rQQQ`.

Market-data routes only:

- `GET /api/v3/market/instruments?category=SPOT` — discover instruments, verify the `isReality` flag.
- `GET /api/v3/market/tickers` — live price, 24h change, bid/ask, turnover, range.
- `GET /api/v3/market/candles` — Reality candlesticks for sparklines, short-window risk metrics, and **Shadow Session Listed/Shadow attribution** (hourly candles by default).

AlphaArena contains **no** call to Bitget Reality order-placement or UTA trade endpoints. CI has a guard test that fails if a Reality order path or `/api/v3/trade/` path appears in backend application source.

> Bitget notes that some Reality market-data access can depend on whitelist/account availability, so the frontend labels fallback/preview states instead of presenting unavailable data as live.

See [docs/BITGET_INTEGRATION.md](docs/BITGET_INTEGRATION.md).

---

## Vibe-Trading implementation

Vibe-Trading runs as a separate, pinned, **research-only MCP sidecar** (`vibe-trading-ai==0.1.15`, shell tools disabled). For a supported underlying, AlphaArena can request historical daily market data (stock + QQQ), technical indicators, fundamentals, stock news, SEC filings, and financial statements.

AlphaArena then calculates locally: daily returns, 20-day momentum, annualized historical volatility, maximum drawdown, return deciles, aligned beta/correlation to QQQ, and mechanically selected same-direction historical analogues.

Analogues are observations, **not predictions**. Historical beta requires ≥ 20 paired observations before MarketTwin may use it as calibration. Research responses are cached to protect latency and free-tier resources.

See [docs/VIBE_TRADING.md](docs/VIBE_TRADING.md).

---

## Budget and safety rules

The default hackathon configuration is intentionally conservative:

| Guardrail | Default |
| --- | ---: |
| Live demo | https://alphaarena.vercel.app |
| Arena starting balance | `$100,000` virtual |
| Real-money trading | Disabled / no execution route |
| Scheduled background LLM calls | `0` |
| Qwen attempts per user request | `2` |
| Qwen application-side attempts/day | `12` per API process |
| Qwen maximum output | `3,000` tokens/attempt |
| Vibe research cache | `900s` |
| Bitget Signal cache | `300s` |
| Vibe shell tools | Disabled |

The Qwen daily counter is an **AlphaArena safety fuse**, not a claim about Groq billing or provider quota. The default API container runs one worker; if horizontally scaled, the counter must move to shared persistence before being treated as deployment-wide.

See [docs/BUDGET_AND_SAFETY.md](docs/BUDGET_AND_SAFETY.md).

---

## Getting started

### Prerequisites

- Node.js `>= 20.19.0` (`package.json → engines`)
- Python `3.12` for the backend
- Docker (optional, for the full backend + Vibe sidecar stack)

### 1. Frontend (Vercel dev parity)

```bash
npm install
cp .env.example .env
npm run dev
```

The frontend defaults to `http://localhost:8000` for the API. Set `VITE_API_BASE_URL` when the API lives elsewhere (e.g. your deployed backend).

### 2. Backend + Vibe sidecar (Docker Compose — shortest full-stack path)

```bash
cp backend/.env.example backend/.env
# Put QWEN_API_KEY in backend/.env only if you want optional Groq-hosted Qwen synthesis.
docker compose up --build
```

This starts `vibe` (research sidecar on `8900`) and `api` (FastAPI on `8000`).

### 3. Backend only (direct Uvicorn)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Then open `http://127.0.0.1:8000/docs` for the interactive API.

> Without a Vibe sidecar, Qwen key, or MongoDB URI, AlphaArena still serves its deterministic/paper functionality and clearly reports which integrations are unavailable.

**Model naming note:** settings keep their historical `QWEN_*` names because the model family is Qwen. `AI_PROVIDER=groq` + `QWEN_BASE_URL=https://api.groq.com/openai/v1` identify the actual inference host. The client keeps a small OpenAI-compatible provider layer so a future Alibaba-hosted deployment can use its own base URL without a Groq-only rewrite.

---

## Environment variables

| Scope | File | Key variables |
| --- | --- | --- |
| Frontend | `.env.example` | `VITE_API_BASE_URL` |
| Backend | `backend/.env.example` | `BITGET_BASE_URL`, `FRONTEND_ORIGINS`, `WATCHER_*`, `AI_PROVIDER`, `QWEN_*`, `BITGET_SIGNAL_MCP_URL`, `SIGNAL_CACHE_SECONDS`, `VIBE_MCP_URL`, `VIBE_CACHE_SECONDS`, `MONGODB_URI`, `MONGODB_DB`, `ARENA_STARTING_CAPITAL` |

See [backend/.env.example](backend/.env.example) and [backend/README.md](backend/README.md) for defaults and semantics.

---

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

GitHub Actions also runs browser tests across Chromium, Firefox, and WebKit plus iPhone, Android, tablet, and a 320×568 hostile viewport — covering horizontal overflow, browser navigation, responsive controls, mobile form typography, reduced motion, NightWatch, MarketTwin, Arena, Shadow Session (commitment lock, where-the-move-occurred bars, verify-freeze, Morgue), paper-only guardrails, and human-readable error handling.

See [docs/TESTING_AND_UX.md](docs/TESTING_AND_UX.md) and [docs/CI_NOTES.md](docs/CI_NOTES.md).

---

## API diagnostics

Useful read-only endpoints (also live on the Vercel deployment under `/api/...`):

- `GET /api/health`
- `GET /api/integrations/status`
- `GET /api/integrations/diagnostics`
- `GET /api/budget/status`
- `GET /api/market/instruments/reality`
- `GET /api/market/assets`
- `GET /api/pulse/status`
- `GET /api/session/now` — current Listed/Shadow session (debug/demo)
- `GET /api/arena/morgue` — settled battles with shadow attribution + commitment sentence
- `GET /api/arena/battles/{id}/verify` — recompute + verify the settlement freeze

`/api/budget/status` makes the paper-only and model-budget guarantees visible rather than leaving them as README promises.

---

## Project structure

```text
AlphaArena/
├── src/                    # React + Vite frontend
│   ├── features/           # Pulse, NightWatch, MarketTwin, Arena, ShadowSession,
│   │                       # Morgue, Landing screens
│   ├── components/         # AppShell, connected data screens, ErrorBoundary, ui kit
│   ├── market/ product/    # market data provider + product API client
│   └── lib/ utils/         # api client, formatting, helpers
├── backend/                # FastAPI service (trust boundary)
│   ├── app/main.py         # routes + friendly problem handlers
│   ├── app/config.py       # env / budget configuration
│   └── app/services/       # bitget, vibe, signal, qwen, analytics,
│                           # nightwatch, market_twin, arena, review, shadow,
│                           # pulse, watcher, storage, budget,
│                           # backtest, playbook, calibration
│   └── scripts/            # verify_battles.py, generate_backtest_report.py
├── api/index.py            # Vercel serverless entry (re-exports backend app)
├── e2e/                    # Playwright product + responsive specs
├── docs/                   # Architecture, integrations, safety, testing, demo
├── DESIGN.md               # Design tokens + product visual contract
├── UX-CONTRACT.md          # UX interaction contract
├── compose.yml             # local backend + Vibe sidecar stack
└── vercel.json             # Vercel build / rewrite configuration
```

Backend source map: see [backend/README.md](backend/README.md).

---

## Deployment

**Live: https://alphaarena.vercel.app**

- Static frontend (`dist/`) + serverless FastAPI (`api/index.py`) via `vercel.json` rewrites (`/api/* → /api/index.py`, everything else → SPA).
- Full-stack local alternative: `docker compose up --build` (FastAPI + Vibe sidecar).
- Optional persistence: MongoDB Atlas (`MONGODB_URI`); empty value = in-memory fallback.

Step-by-step instructions, environment checklist, and troubleshooting: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Product truth rules

AlphaArena must never claim:

- a simulated impact is a prediction,
- one paper battle proves a repeatable edge,
- a historical analogue predicts the next move,
- a move was **"predicted"** or **"detected"** — Shadow Session only ever says a move **occurred in** a Listed/Shadow bucket,
- a kill happened when the level was not actually touched on the observed path,
- unavailable research is live evidence,
- a virtual balance is withdrawable money,
- a Bitget trade was placed.

If evidence is unavailable, the product says so. If an integration fails, the UI stays understandable and shows an actionable message — never an HTTP status, traceback, or connector error.

Enforced by [docs/QUALITY_CHECKLIST.md](docs/QUALITY_CHECKLIST.md).

---

## Documentation

| Document | Contents |
| --- | --- |
| [docs/README.md](docs/README.md) | Docs hub / reading order |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Trust boundaries, services, graceful degradation |
| [docs/BITGET_INTEGRATION.md](docs/BITGET_INTEGRATION.md) | Exact UTA v3 routes + the no-order boundary |
| [docs/SHADOW_SESSION.md](docs/SHADOW_SESSION.md) | Listed/Shadow boundary, kill attribution, commitment mechanic, morgue, judge script |
| [docs/VIBE_TRADING.md](docs/VIBE_TRADING.md) | Sidecar isolation, evidence, calibration math, provenance |
| [docs/BUDGET_AND_SAFETY.md](docs/BUDGET_AND_SAFETY.md) | Paper-capital, model-call, background-cost invariants |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel + Compose + Atlas deployment runbook |
| [docs/TESTING_AND_UX.md](docs/TESTING_AND_UX.md) | Browser matrix, quality gates, manual demo checklist |
| [docs/JUDGE_DEMO.md](docs/JUDGE_DEMO.md) | Truthful 3-minute walkthrough + technical Q&A |
| [docs/DEMO_MODE.md](docs/DEMO_MODE.md) | What judges see when Bitget Reality is unreachable |
| [docs/PORTFOLIO_STRESS_TEST.md](docs/PORTFOLIO_STRESS_TEST.md) | Multi-position scenarios over the same deterministic engine |
| [docs/QUALITY_CHECKLIST.md](docs/QUALITY_CHECKLIST.md) | Final merge / submission gate |
| [docs/CI_NOTES.md](docs/CI_NOTES.md) | CI quirks (npm, Playwright, minimal hosts) |
| [backend/README.md](backend/README.md) | Backend responsibilities, config, tests, source map |
| [DESIGN.md](DESIGN.md) | Design tokens (mirrors `src/index.css`) |
| [UX-CONTRACT.md](UX-CONTRACT.md) | Interaction contract + flow ledger |

---

## Hackathon submission (Track 3: US Stock AI Trading)

1. **Thesis:** traders act on predictions they cannot disprove. AlphaArena makes every thesis falsifiable before capital — real or paper — is risked: explicit invalidation, adversarial objection, deterministic stress ranges, then a frozen paper settlement.
2. **How it works:** Bitget Reality UTA v3 supplies live rToken prices; Vibe-Trading MCP supplies historical research; deterministic code computes metrics/stress/PnL; Qwen explains only.
3. **Evidence:** `GET /api/arena/export.json` + `Export CSV` in Arena/Portfolio downloads `timestamp, asset, direction, price, quantity, balance change` plus `settlement_hash`. Verify with `python backend/scripts/verify_battles.py samples/paper-log.json`. Reproducible backtest: `python backend/scripts/generate_backtest_report.py --prices 100,101,99,102 --out /tmp/report.json` (code is the report: `backend/app/services/backtest.py`).
4. **Take on AI trading:** AI should challenge and monitor, not predict. MarketTwin numbers are code-owned; Playbook export (`Copy Playbook config`) is a pause/review suggestion, never an order.

---

## Hackathon track

Built for **Bitget AI Base Camp S2 — AI Trading Desk / Decision Stress-Testing**.

The project demonstrates a real decision workflow around Bitget Reality market data while keeping financial execution outside the demo scope: no API secrets, no wallet connection, no order placement — just falsifiable reasoning tested with virtual capital.

---

## Contributing

1. Fork the repo and create a feature branch.
2. Keep deterministic logic in `backend/app/services/` and prose/explanation in the UI or Qwen layer — never let generated text overwrite computed numbers.
3. Add or update tests (`pytest`, Playwright) for behavior changes.
4. Run the [Verification](#verification) gates locally before opening a PR.
5. Respect the [Product truth rules](#product-truth-rules) and [docs/QUALITY_CHECKLIST.md](docs/QUALITY_CHECKLIST.md).

---

## License

MIT — see [LICENSE](LICENSE).

Copyright (c) 2026 Emmanuel Okunlola.
