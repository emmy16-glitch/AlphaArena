# Demo Mode — Judging Without Bitget Reality Access

Bitget notes that Reality market-data availability can depend on whitelist/account
access. AlphaArena treats live Bitget data as an integration that can be
unavailable, not as a hard requirement for opening the app. This page describes
exactly what a judge sees when Bitget Reality is unreachable, and what still
requires live data.

Related: [Bitget Reality integration](BITGET_INTEGRATION.md),
[Judge demo](JUDGE_DEMO.md), [Architecture](ARCHITECTURE.md).

## The one rule

**Preview data is never relabelled as live.** When Bitget is unreachable the UI
keeps clearly marked preview/design data where appropriate, and live-price
actions fail with a human message before anything is persisted. See
`docs/BITGET_INTEGRATION.md` ("Whitelist/access behavior") and the product truth
rules in the repository `README.md`.

## How to trigger demo mode

Any of these produces the same degraded path — no special flag is needed:

1. Run only the frontend (`npm run dev`) with no API on `VITE_API_BASE_URL`.
2. Run the API with no network route to Bitget
   (`GET /api/market/assets` returns `502` with code `UPSTREAM_UNAVAILABLE`).
3. Open `GET /api/integrations/diagnostics` and confirm
   `bitget.connected: false` ("Bitget public market data unavailable").

The frontend `MarketDataProvider` (`src/market/MarketDataContext.tsx`) attempts a
live fetch on load and every 15s; on failure it keeps the static preview universe
in `src/data.ts` and sets status to `fallback`.

## What the judge sees per screen

| Screen | Without Bitget Reality | Label to look for |
| --- | --- | --- |
| Pulse | Static preview rows from `src/data.ts` (`pulseItems`); refresh shows a human error, preview rows stay | `Preview`, `Design preview`, amber dot, "Live Pulse is unavailable … Preview rows remain clearly marked." (`src/features/PulseScreen.tsx`) |
| Market header / asset lists | Preview prices/sparks from `src/data.ts` (`assets`) | `Limited market data`, `Market prices are temporarily limited`, session stays `Overnight · Live` design string — never `Bitget · Live` (`src/market/MarketDataContext.tsx`, `src/components/ConnectedAsset.tsx`) |
| NightWatch (`POST /api/nightwatch/analyze`) | Fails clearly (`502 Live market data or research is taking longer than usual. Try again in a moment.`) — it needs the observed entry price | Human error via `src/lib/api.ts`, no fabricated thesis |
| MarketTwin (`POST /api/twin/simulate`) | Fails the same way — it needs current Bitget prices before applying beta/priors | Same `502` path; no invented impact range |
| Arena create (`POST /api/arena/battles`) | Fails **before** the battle is persisted, so no virtual capital is consumed (`backend/app/services/bitget.py`, `backend/app/services/arena.py`) | "Live market data or research is taking longer than usual … Your paper balance was not changed." |
| Arena list / Portfolio / export | Still works from already-recorded battles; live marks fall back to last observed prices (`arena.py:_refresh`) | Existing battles remain reviewable; `GET /api/arena/export.json` + `Export CSV` still verify via `python backend/scripts/verify_battles.py` |
| Diagnostics | `GET /api/integrations/diagnostics` shows `bitget.connected: false`; `GET /api/budget/status` still proves paper-only + budget fuse | Use these two endpoints as the "is it live?" check |

## Suggested 60-second offline check

1. Open the app with the API stopped or Bitget blocked. Confirm the header says
   **Limited market data** and Pulse says **Design preview**.
2. Open `GET /api/integrations/diagnostics` (or `/api/budget/status`) and confirm
   the Bitget/Vibe/Qwen truth rather than taking the UI on faith.
3. Try NightWatch or Arena creation and confirm a readable retry message —
   not a traceback, connector URL, or fake success.
4. Run the offline-verifiable evidence:
   `python backend/scripts/verify_battles.py samples/paper-log.json` and
   `python backend/scripts/generate_backtest_report.py --prices 100,101,99,102 --out /tmp/report.json`.

## What demo mode is not

- It is not paper trading against preview prices. Battles are only recorded at
  an observed Bitget Reality price (`arena.py:create_battle` → `bitget_market.get_asset`).
- It is not a mock exchange. There is no order endpoint to fall back to — the
  no-trade boundary in `docs/BITGET_INTEGRATION.md` holds with or without live data.
- Vibe-Trading, Signal and Qwen degrade independently (see
  `docs/ARCHITECTURE.md` failure model). Bitget being down does not imply
  historical research is down, and vice versa.
