# Testing and UX Quality Gate

AlphaArena's UI should be understandable before it is impressive. The final hardening pass treats usability, responsive behavior and truthful error states as release blockers.

## Browser matrix

Playwright runs the same product tests on:

- desktop Chromium — 1440×900,
- desktop Firefox — 1440×900,
- desktop WebKit/Safari engine — 1440×900,
- iPhone 13 profile,
- Pixel 5 profile,
- iPad 7th generation profile,
- a deliberately hostile 320×568 mobile viewport.

Each project is a separate GitHub Actions matrix job so one browser failure does not hide the state of the others. On failure, the workflow keeps Playwright traces/screenshots/videos for five days.

## What the browser tests verify

### Navigation

- Landing page's primary action enters the product.
- Hash/history navigation updates the URL.
- Browser Back returns to the previous AlphaArena screen.
- Core product pages render through the same application shell.

### Responsive layout

The suite loads Pulse, Lab, Arena, Portfolio, Ranks and Create at every configured viewport and checks that the document does not require horizontal scrolling.

The narrow 320px profile is intentional: if a UI only works at a modern flagship-phone width, it is not considered responsive.

### Mobile typography and controls

On mobile/narrow profiles:

- text inputs/textarea compute to at least 16px, preventing Safari's automatic form zoom,
- visible buttons must retain usable touch height,
- the global coarse-pointer rule raises button touch targets to 44px,
- the fixed bottom navigation includes safe-area padding.

### Reduced motion

`prefers-reduced-motion: reduce` collapses decorative animation and transitions to effectively zero duration. The ticker marquee also stops moving.

### Product flows

The deterministic browser fixture tests include:

- submitting a NightWatch thesis and receiving a support/objection/invalidation result,
- running a MarketTwin scenario and seeing model provenance,
- seeing the paper-only guardrail before an Arena battle,
- receiving a readable error if the live Pulse upstream request fails,
- recording a Shadow Session battle (commitment sentence + kill level) and seeing the where-the-move-occurred bars on the settled card (`e2e/shadow-session.spec.ts`),
- verifying a settled battle's freeze (`Verify freeze` → `hash matches`),
- opening the Thesis Morgue and confirming a dead-thesis receipt renders,
- asserting Morgue/Arena/Battle have no horizontal overflow at narrow viewports.

The error test also asserts that the rendered page does not leak strings such as `502`, `localhost:8000` or `ECONN`.

## Typography system

The final UI uses three font roles only:

- **Inter** — product UI and body copy,
- **Instrument Serif** — editorial emphasis/display moments,
- **JetBrains Mono** — prices, percentages and tabular numeric values.

System fallbacks are declared for every role. This removes the previous overlap between multiple serif families and makes hierarchy more predictable.

## Interaction design rules

1. A visible control must do something. Decorative Search and Bell controls were removed from the shell rather than left as dead affordances.
2. Every major screen should answer one question:
   - Pulse: what changed?
   - NightWatch: why might I be wrong?
   - Lab: what if one assumption changes?
   - Arena: how does my recorded paper thesis perform?
    - Shadow Session: where did the move occur — Listed or after-hours tape?
    - Morgue: which dead theses have receipts?
3. Product actions use verbs instead of internal engineering terms.
4. Loading states explain what is happening without pretending a specific upstream step has already succeeded.
5. Errors say what happened and what the user can do next.
6. Preview/fallback states must never be labelled as live data.
7. Virtual capital is consistently described as paper/virtual and never as withdrawable funds.

## Backend quality gate

The backend CI job runs:

```bash
ruff check app tests
pytest -q
python -m compileall -q app
python -c "from app.main import app; ..."
```

Unit tests cover:

- shock direction correctness,
- strict JSON numeric output,
- MCP SSE response decoding,
- Vibe beta/correlation and analogue rules,
- LONG/SHORT/WAIT paper PnL,
- immutable settlement,
- concurrent paper-budget allocation,
- conservative model budget configuration,
- human-readable validation responses,
- absence of Bitget trade endpoints,
- absence of background model usage in the watcher.

## Frontend quality gate

The frontend CI job runs:

```bash
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=high
```

Playwright is separate because browser installation is slower and because device/browser failures should remain individually visible.

## Manual judge/demo checklist

Automated tests cannot judge visual quality, clarity of the story or whether the demo feels coherent. Before submission, manually verify:

1. Start at the landing page with no explanation and confirm the first action is obvious.
2. Open Pulse and confirm live vs preview status is truthful.
3. Open one asset and enter NightWatch.
4. Edit the thesis instead of submitting only the default text.
5. Read the strongest support and objection out loud; both should be understandable without code knowledge.
6. Open MarketTwin and run one clear adverse scenario.
7. Point to the model-source line and explain when Vibe beta is measured vs when an AlphaArena prior is used.
8. Enter Arena and explicitly show the “No deposit. No wallet. No real-money execution.” line.
9. Record a paper battle and show the stored live market entry.
10. Show `/api/budget/status` or the sidebar AI budget if a technical judge asks about cost controls.
11. Do not claim a live battle has settled if its horizon has not actually expired.
12. End on the product thesis: **the value is making a decision more falsifiable before the human acts.**

## Release rule

A branch is not “final” because the UI looks good in one screenshot. The release candidate should not merge until frontend checks, backend checks, Vibe smoke and every Playwright project are green.
