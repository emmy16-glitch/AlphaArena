# UX Contract

## Product context

- **Audience:** Beginners and builders exploring market scenarios.
- **Primary jobs:** Observe live context, test a hypothetical shock, inspect evidence, challenge assumptions, and compare paper-only alternatives.
- **Target market(s):** Global English product; no real-money execution.
- **Active locales:** English; browser locale for dates and numbers.
- **Accessibility target:** WCAG 2.2 AA.

## Business-context sources

| Domain / scope | Authoritative source | Source type |
|---|---|---|
| MarketTwin beginner flow | `AlphaArena_MarketTwin_Interactive_UX_Specification.pdf` | Product UX specification |
| API and safety invariants | `docs/ARCHITECTURE.md`, `docs/BUDGET_AND_SAFETY.md` | API and safety documentation |
| Paper-only behavior | `backend/app/services/arena.py`, `docs/BITGET_INTEGRATION.md` | Domain implementation and integration contract |

## Visual contract

- **Project `DESIGN.md`:** `DESIGN.md`
- **Token ownership:** `src/index.css` is runtime canonical; `DESIGN.md` mirrors durable values.
- **Supported themes:** Light paper surface only; semantic contrast must remain readable in forced colors.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Verification |
|---|---|---|---|
| Form | Native labelled controls + `ActionButton` / `SegButton` | `DESIGN.md`, MarketTwin screen | typecheck + Playwright |
| Scrollbar | Global application stylesheet | `src/index.css` | browser matrix |
| Toast/status | Inline `aria-live` status regions | screen-level flow | Playwright |
| CRUD | `productApi` + FastAPI routes | API contract | backend + E2E |

## Component behavior

- Buttons preserve geometry while busy, show focus, and use labels for every icon action.
- Disclosures use `aria-expanded` and `aria-controls`; only one asset explanation is open at a time.
- Textareas use `resize-none`, preserve typed objections, and never replace the original scenario.
- Errors remain inline with a retry path; provider failures use honest deterministic fallback labels.

## Flow ledger

| Operation | Trigger | Pending | Success feedback | Failure recovery |
|---|---|---|---|---|
| Run scenario | Run scenario button or Enter | Named calibration stages | “In simple terms” summary and affected assets | Inline error; preserve prompt and controls |
| Challenge | Challenge this → option → test | Alternative loading state | Alternative assumption card beside original | Original remains visible; retry available |
| View why | View why button | None | Inline accessible explanation | Close by repeating trigger |
| Historical context | View full context | None | Inline current-move disclaimer | No navigation or context loss |
| Change assumption | Change an assumption | Alternative loading state | Original vs alternative comparison | Original remains immutable |

## Navigation and responsive behavior

- Result interactions stay on the same page and preserve scroll position.
- At 320px, controls wrap naturally; no horizontal overflow or hover-only content.
- Technical details are collapsed by default and use native disclosure semantics.

## Async and resilience

- Scenario mutations are pessimistic and duplicate-submit protected.
- External research is bounded; deterministic stress values remain the source of truth.
- AI provider failure never fabricates evidence; the UI labels deterministic fallback honestly.

## Verification

- Static: `npm run typecheck`, `npm run build`, `ruff check`, `pytest -q`.
- Browser: `npx playwright test` across Chromium, Firefox, WebKit, iPhone, Pixel, tablet, and 320px.
- Canonical sibling flow: NightWatch result disclosures and paper-only Arena navigation.
