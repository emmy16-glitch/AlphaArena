# Evidence

AlphaArena separates what the market showed, what history recorded, what a scenario imagined, what paper capital did, what a model said, and what code verified. These categories are never mixed.

## 1. Live market evidence (`LIVE`)

- Observed Bitget Reality UTA v3 prices, spreads and candles.
- Labelled `LIVE` only while the adapter reports `connected: true`.
- If the feed is unreachable, the UI shows `PREVIEW` / `Market limited` — never live.

## 2. Historical evidence (`VERIFIED HISTORICAL`)

- Vibe-Trading daily bars, indicators, fundamentals, news and filings, plus mechanically derived analogues.
- Analogues are observations, **not predictions**. Historical beta requires ≥ 20 paired observations before MarketTwin may use it.
- Frozen snapshots keep `market_timestamp`, `source` and `snapshot_hash` so later review can prove nothing was rewritten.

## 3. Scenario / counterfactual outputs (`PREVIEW`)

- MarketTwin and Portfolio Stress outputs are hypothetical stress estimates.
- Always labelled as scenarios, with calibration source (`measured` vs `prior`) and uncertainty bands.
- A scenario is never presented as a forecast or recommendation.

## 4. Paper outcomes (`PAPER`)

- Arena battles run on `$100,000` virtual capital. No wallet, deposit, withdrawal or order endpoint exists.
- Settlement uses the deterministic settlement price/time at horizon maturity — never a later refresh price.
- Paper results are virtual and never presented as real-money returns.

## 5. Model interpretation (`MODEL-GENERATED INTERPRETATION`)

- Qwen (via Groq) and NightWatch prose explain results. They **cannot overwrite deterministic numbers or invent missing evidence**.
- A provider outage is recorded as `unavailable` for that lane — never silently fabricated as HOLD.

## 6. Automated verification (`DETERMINISTIC CALCULATION`)

- Decision receipts hash canonical fields (session id, asset, snapshot timestamp/hash, provenance, thesis, horizon, every lane call + confidence, model versions, risk config, evidence refs, created timestamp) with SHA-256.
- Settlement hashes and `verify` endpoints recompute the freeze. `hash matches` means the record is intact.

## What the Research → Evidence tab lists

Only sources AlphaArena actually retrieves:

- Bitget Reality Tape (`LIVE` / `Limited`)
- Frozen Decision Snapshot (`DETERMINISTIC CALCULATION`)
- NightWatch Analysis (`MODEL-GENERATED INTERPRETATION`)
- MarketTwin Scenario (`MODEL-GENERATED INTERPRETATION` / scenario)
- Decision Tape + Settlement Hash (`PAPER`)
- Shadow Session Attribution (`VERIFIED HISTORICAL`)

Conceptual mockups once showed Bloomberg / Reuters / TradingView / SEC.
Those are **not** listed in the product because AlphaArena does not retrieve them.
Never fabricate source availability.

## Known limitations

- Candles are ~1h buckets: kill timestamps are estimates (`~03:11 UTC`), not exact fills.
- The Qwen daily counter is a per-process safety fuse, not provider billing.
- One settled battle never proves edge; Track Record says so explicitly.
- Without MongoDB, persistence falls back to in-memory and production Arena requires durable storage.
