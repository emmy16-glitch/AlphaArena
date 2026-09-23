# FULL_EDIT — AlphaArena entire-experience redesign plan

> **Trigger phrase:** when the user says **"check full edit and continue"**,
> re-read this file + `docs/reference-full-edit-home.png` (and
> `docs/reference-full-edit-panels.png` if present), check `git status`,
> and continue the unfinished phases below. Do not ask for the screenshots again.

## Reference screenshots (saved in repo)

- `docs/reference-full-edit-home.png` — Home screen (NVDA, thesis, same-snapshot decisions). ✅ implemented
- The 6-panel collage below was provided in chat (not on disk) — its full
  content is transcribed here so resume works without re-upload:

### Panel 1 — Research (NightWatch tab)
Header "Research / Deeper insights. Stronger decisions.", tabs
NightWatch|MarketTwin|Evidence|Stress Test, asset chip NVDA $876.32 +1.44%.
"NightWatch Analysis / Adversarial AI research: strongest case for and against
your thesis." + "View full report →". Two columns: "Key Bullish Arguments"
(green + icon, numbered 1-3 green circles: Expanding AI infrastructure demand /
Improving gross margins / Positive analyst revisions, each title + detail + ›)
vs "Key Bearish Arguments" (red × icon, numbered red: Valuation risk /
Increased competition / Macro uncertainty). Bottom: "AI Summary" card (icon,
summary paragraph) + green badge "Bullish 64% confidence".

### Panel 2 — Arena (live session)
Header "Arena / Same snapshot. Different decisions. Let the market settle it."
+ "← Back to Home". Asset row: NVDA NVIDIA Corporation, price $876.32 +1.44%,
chart, green "Live Session / 24h session" badge. Right card: "Session ID
a9f6…7c2e" + Session Info rows (Snapshot Time Sep 21 2026 19:42 UTC, Horizon
24 hours, Evidence Items 24 (Bitget + Global), Status Live, Time Elapsed 4h
18m, Est. Settlement Sep 22 2026 19:42 UTC). "Participants' Decisions (Frozen)"
4 cards: You (Human) BUY 72% confidence Moderate risk / NightWatch
(AlphaArena) BUY 68% Low risk / Qwen 3.8 HOLD 54% Moderate risk / Baseline
(Technical) SELL 61% Moderate risk — each with avatar, pill, "View reasoning →".

### Panel 3 — MarketTwin
Header "MarketTwin / Test your thesis under different scenarios.", tabs
Scenario Builder|Sensitivity Analysis|What If?. Left: Scenario Parameters
(Price Change slider +5%, Volume Change +20%, Volatility Lower|Normal|Higher,
Time Horizon 24 hours dropdown, black "Run Scenario →" button). Right:
"Scenario Results ⓘ" rows: Thesis Outcome +62% / NightWatch Outcome +48% /
Qwen Outcome +12% / Baseline Outcome −36% (green/red), blue "Insight" box
("Your thesis performs well in higher volatility scenarios…").

### Panel 4 — Evidence
Header "Evidence / Transparent sources. Verifiable data." + Filter. Category
tabs: Live Market|Analyst Reports|News|On-chain|Technical|Macro. Rows (icon
letter, name, desc, badge, timestamp, View →): Bitget Market Data (Live, Sep
21 19:42), Bloomberg Terminal Historical (Verified, Sep 21 18:30), Reuters
News (Live, Sep 21 19:20), TradingView Technicals (Live, Sep 21 19:41), SEC
Filings (Verified, Sep 20 16:00), Alternative Data Sentiment (Processed, Sep
21 19:10).

### Panel 5 — Decision Tape
Header "Decision Tape / From idea to outcome. A complete, verifiable record."
History submenu: Decision Tape|Track Record|Morgue. Filters: All Assets, All
Outcomes, Last 30 Days, search. Table: Date & Time|Asset|Thesis|Participants
|Outcome|P&L (Paper)|Status. Rows: NVDA Stays strong Pending — Live; BTC
Breaks $65K Correct +4.2% Settled; AAPL Bounces from support Incorrect −3.1%
Settled; ETH Sideways Correct +2.8%; TSLA Reclaims $250 Incorrect −5.6%;
SOL Continues uptrend Correct +6.4%.

### Panel 6 — Thesis Details (Morgue detail)
Header "Thesis Details / Learn from what didn't work." + "← Back to Morgue".
TSLA Tesla Inc., "Reclaims $250 within 24 hours", red "Invalidated" badge,
Date Sep 17 2026 16:00, Horizon 24 hours. Participant Decisions mini-cards:
You BUY 66% / NightWatch HOLD 52% / Qwen BUY 56% / Baseline SELL 64%. Market
Outcome card: Entry $348.20, Exit $341.10, Change −2.86% red. Key Learnings
1-2-3 (macro headwinds; $250 resistance; news flow). Evidence at the Time card
with gold "View Original Evidence →".

## Product sentence

"AlphaArena freezes one market moment, lets humans and AI make decisions from
exactly the same evidence, then lets the market settle the argument."

## Design tokens (from reference)

- Sidebar `#121416`, active nav `#2B2517` + gold `#D8B45C / #E8C86A`
- Workspace `#F4F5F6`, cards white, borders `#ECEDEF / #E4E6E9`
- Gold CTA gradient `#E3BA5E → #C69A3F`, ink `#111315 / #1A1D21`
- BUY `#CDEEDB/#0B6B3F`, SELL `#FBDCDC/#E5484D`, HOLD `#E9EBEF` — always with text, never color-alone
- Fonts: Inter UI + JetBrains Mono (`mono-num`) for numbers
- Icons: `lucide-react` only. Info-blue `#1D3DFF` stays OFF Home (deeper screens only).

## Phase status

| # | Work | Status | Files |
|---|------|--------|-------|
| 1 | Audit repo, keep all working logic | ✅ done | — |
| 2 | HOME (asset → snapshot → thesis → decisions → arena entry) | ✅ done, pushed `483659c` | `src/features/HomeScreen.tsx`, `src/product/decisionSessions.ts`, `backend/app/services/decision_sessions.py` |
| 3 | Research hub header + tabs (NightWatch/MarketTwin/Evidence/Stress Test) | ✅ rewritten, NOT yet committed | `src/features/ResearchScreen.tsx` |
| 4 | NightWatch tab: bullish/bearish args + AI summary + verdict badge (real `/api/nightwatch/analyze`) | ✅ rewritten, NOT yet committed | same |
| 5 | MarketTwin tab: scenario builder sliders + run + results + insight (real `/api/twin/simulate`) | ✅ rewritten, NOT yet committed | same |
| 6 | Evidence tab: category tabs + source rows + truth labels | ✅ rewritten, NOT yet committed | same |
| 7 | `riskLabel` prop on ParticipantCard (risk band under confidence) | ✅ done, NOT yet committed | `src/components/ParticipantCard.tsx` |
| 8 | Arena live-session screen (ref panel 2: asset header, Live badge, chart, Session ID + Session Info, frozen decisions with risk, Back to Home) | ✅ rewritten, NOT yet committed | `src/features/ArenaHubScreen.tsx` (reuse `productApi.battle`, `ParticipantCard`, `useMarketData`) |
| 9 | History: Decision Tape table with filters (real `/api/arena/export.json`) | ✅ rewritten, NOT yet committed | `src/features/HistoryScreen.tsx` + `src/features/HistoryTapeTable.tsx` |
| 10 | History: Morgue list + Thesis Details view (Invalidated badge, mini participant cards, Market Outcome, Key Learnings via `reviewBattle`, Evidence at Time) | ✅ rewritten, NOT yet committed | same + `src/features/MorgueScreen.tsx` stays |
| 11 | Track Record stays via legacy `TrackRecordScreen` under its tab | ✅ kept | — |
| 12 | Legacy deep screens stay reachable (`nightwatch`, `lab`, `battle`, `portfolio`, `asset`, `pulse` aliases in `App.tsx`) | ✅ kept | `src/App.tsx` |
| 13 | E2E: add research-nightwatch + history-tape assertions to `thesis-flow.spec.ts` | ✅ added, NOT yet run | `e2e/thesis-flow.spec.ts`, mocks already cover endpoints in `e2e/mockApi.ts` |
| 14 | Verify: `npm run typecheck` + `npm run build` + backend `pytest` + commit + push to main | ✅ done 2026-09-23: typecheck clean, vite build ok, backend 88 passed | — |

## Rules (from user brief)

- No fake frontend mockups — every panel calls a real backend endpoint.
- No feature deletion — removed-from-Home modules relocate to Research/Arena/History.
- Progressive disclosure: decision → View evidence → View reasoning → View scenarios → View settlement.
- Truth labels everywhere: LIVE / VERIFIED HISTORICAL / PAPER / MODEL-GENERATED / DETERMINISTIC. Never mix.
- Mobile: stacked flow Asset → Snapshot → Thesis → Test → Decisions → Arena → Evidence. No horizontal scroll. 16px min inputs, 44px targets.
- Keep `data-testid`: `home-screen`, `research-screen`, `arena-screen`, `history-screen`, `snapshot-card`, `thesis-composer`, `decisions-pending/ready`, `arena-card`, `receipt-hash`, `refusal-card`.

## How to resume ("check full edit and continue")

1. `git status --short` — expect modified: `src/features/ResearchScreen.tsx`, `src/components/ParticipantCard.tsx` (+ this doc + ref image untracked/committed).
2. `npm run typecheck` to confirm the rewritten ResearchScreen compiles.
3. Continue at the first ⏳ row (Phase 8: ArenaHubScreen).
4. Finish with Phase 14 (verify + push).
