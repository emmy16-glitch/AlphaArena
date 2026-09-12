# AlphaArena documentation

> **Live demo:** https://alphaarena.vercel.app · **Product overview:** [repository README](../README.md) · **License:** [MIT](../LICENSE)

Start with the repository [README](../README.md) for the one-screen product overview and demo flow, then use this hub for depth.

## Reading order

| # | Document | Read it for |
| --- | --- | --- |
| 0 | [Judge demo](JUDGE_DEMO.md) | Truthful 3-minute walkthrough + technical Q&A — start here before judging or demoing |
| 1 | [Demo mode](DEMO_MODE.md) | What judges see when Bitget Reality is unreachable |
| 2 | [Architecture](ARCHITECTURE.md) | Trust boundaries, service responsibilities, graceful degradation |
| 3 | [Bitget Reality integration](BITGET_INTEGRATION.md) | Exact UTA v3 market-data routes and the deliberate no-order boundary |
| 4 | [Vibe-Trading research](VIBE_TRADING.md) | Sidecar isolation, retrieved evidence, historical calculations, provenance |
| 5 | [Portfolio stress test](PORTFOLIO_STRESS_TEST.md) | Multi-position scenarios over the same deterministic engine |
| 5b | [Shadow Session](SHADOW_SESSION.md) | Listed/Shadow boundary, kill attribution, commitment mechanic, Thesis Morgue, judge script |
| 6 | [Budget and safety](BUDGET_AND_SAFETY.md) | Paper-capital, model-call, and background-cost invariants |
| 7 | [Deployment](DEPLOYMENT.md) | Vercel + Compose + Atlas runbook for the live build |
| 8 | [Testing and UX](TESTING_AND_UX.md) | Playwright device/browser matrix and release gate |
| 9 | [Release quality checklist](QUALITY_CHECKLIST.md) | Final merge / submission gate |
| 10 | [CI notes](CI_NOTES.md) | CI quirks (npm, Playwright, minimal hosts) |

## Companion contracts

| Document | Contents |
| --- | --- |
| [../DESIGN.md](../DESIGN.md) | Design tokens and visual contract (`src/index.css` is runtime-canonical) |
| [../UX-CONTRACT.md](../UX-CONTRACT.md) | Interaction contract, flow ledger, responsive/async rules |
| [../backend/README.md](../backend/README.md) | Backend responsibilities, configuration, tests, source map |

## Conventions used across these docs

- **Evidence before prose:** deterministic AlphaArena code computes numbers; Qwen only explains them.
- **Missing evidence stays missing:** fallbacks are labelled, never invented.
- **Paper-only:** `$100,000` virtual capital; no wallet, deposit, withdrawal, or Bitget order endpoint.
- **Bounded AI spend:** user-triggered model calls behind an application-side fuse; zero scheduled LLM calls.
