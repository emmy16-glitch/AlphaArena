# Portfolio-Level Stress Test

A multi-position stress scenario is closer to a real trading desk than a
single-position battle: build several paper positions, run one scenario across
all of them, and inspect the aggregate plus each leg. The single-position
MarketTwin path is untouched — this is additive.

## Backend

`POST /api/twin/portfolio` (`backend/app/services/market_twin.py`,
`simulate_portfolio`) accepts up to 8 paper positions:

```json
{
  "prompt": "Nasdaq falls 5%",
  "positions": [
    { "symbol": "rNVDA", "side": "LONG", "stake": 10000 },
    { "symbol": "rAAPL", "side": "LONG", "stake": 5000 },
    { "symbol": "rTSLA", "side": "SHORT", "stake": 5000 }
  ],
  "severity": 62,
  "duration": "24H"
}
```

Each leg runs through the **same** deterministic engine as the single-position
lab (`_historical_impact` + `market_metrics`), so calibration gate, priors,
volatility widening and per-leg transparency fields are identical. Position
direction adjusts the asset move: `LONG` rides it, `SHORT` mirrors it (bounds
swap on sign flip), `WAIT` carries no exposure.

The aggregate (`aggregate_portfolio_impact`, a pure function) is a
stake-weighted sum of leg dollar impacts with **no diversification benefit
assumed**: bounds are the sum of leg bounds, and `impact_pct` is the dollar
total against total stake. Live prices are required per leg, so without Bitget
Reality the endpoint fails clearly before anything is recorded — same rule as
single-position Arena/MarketTwin (see `docs/DEMO_MODE.md`).

One honest limitation: `parse_shock` reads a **single** driver from the prompt.
A combined prompt such as "Nasdaq -5% AND rates +50bps" is parsed as one
driver, and the response says so (`assumptions.single_driver_note`).

Results persist to the `portfolio_scenarios` store collection. Unit tests:
`backend/tests/test_portfolio_stress.py` (aggregation math, side handling,
work-dict exposure, endpoint aggregate, empty-portfolio rejection).

## Frontend

`src/features/PortfolioStressTest.tsx`, mounted at the bottom of the Lab
(`#/lab`): a position builder (symbol, LONG/SHORT, stake; add/remove up to 8),
a scenario input, and a result view with:

- a portfolio aggregate card (dollar impact, percentage on total paper stake,
  range, aggregation method),
- one card per leg with its dollar impact, range and calibration label,
- a **Show your work** panel reusing the Feature 5 pattern
  (`src/components/ShowYourWork.tsx`) for every leg plus the aggregate,
  including the below-20-observations fallback messaging.

E2E coverage: `e2e/portfolio-stress.spec.ts` builds a 3-position portfolio
(LONG/LONG/SHORT), runs one combined scenario and asserts the aggregate, the
aggregation method and per-leg work.

## Truth rules

- Stress estimates, not forecasts; paper only, no orders.
- SHORT legs gain when the asset falls — the leg card shows the mirrored move,
  not the raw asset move.
- Aggregate bounds are conservative sums, not a diversified risk number.
