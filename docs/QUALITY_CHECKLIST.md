# Release Quality Checklist

This checklist is the final gate before the hackathon branch is merged.

## Product truth

- [ ] Every monetary balance shown in Arena is labelled virtual/paper.
- [ ] No wallet, deposit, withdrawal or Bitget order action exists.
- [ ] Live data is never shown when the application is using preview/fallback data.
- [ ] Historical analogues are described as observations, not predictions.
- [ ] MarketTwin numbers are deterministic outputs; generated text cannot overwrite them.
- [ ] A live battle is never described as settled.

## Budget

- [ ] `/api/budget/status` reports real-money trading false and background LLM calls zero.
- [ ] Qwen user requests have one attempt by default.
- [ ] Qwen maximum output and timeout are bounded.
- [ ] Pulse watcher has no model dependency.
- [ ] Vibe shell tools remain disabled.
- [ ] Vibe and Signal caches are enabled.

## Reliability

- [ ] Concurrent paper battle creation cannot oversubscribe free capital.
- [ ] Settled battles remain immutable.
- [ ] Missing MongoDB degrades to memory mode.
- [ ] Missing Qwen degrades to deterministic reasoning.
- [ ] Missing Vibe/Signal is explicitly labelled and does not create fabricated evidence.
- [ ] API validation/upstream/internal failures return human-readable problem objects.

## Frontend UX

- [ ] No visible dead controls.
- [ ] Browser Back works.
- [ ] Mobile bottom navigation remains usable with safe-area padding.
- [ ] Inputs remain at least 16px on mobile.
- [ ] Keyboard focus is visible.
- [ ] Reduced-motion preference is respected.
- [ ] Core pages have no horizontal overflow at 320px.
- [ ] Typography uses the three-role system consistently.
- [ ] Important errors include a next action and no stack trace/HTTP jargon.

## Automated verification

- [ ] TypeScript strict check passes.
- [ ] Vite production build passes.
- [ ] Production dependency audit has no high-severity findings.
- [ ] Ruff passes.
- [ ] Backend unit/safety tests pass.
- [ ] Python compile/import checks pass.
- [ ] Vibe pinned-package smoke passes.
- [ ] Desktop Chromium passes.
- [ ] Desktop Firefox passes.
- [ ] Desktop WebKit passes.
- [ ] iPhone 13 passes.
- [ ] Pixel 5 passes.
- [ ] iPad profile passes.
- [ ] 320×568 profile passes.

## Submission readiness

- [ ] README explains the product in under one screen before deep technical details.
- [ ] Bitget implementation is easy for a judge to locate.
- [ ] Vibe-Trading implementation is easy for a judge to locate.
- [ ] Budget/safety rules are documented as enforceable contracts, not marketing claims.
- [ ] Three-minute judge demo has been rehearsed against the actual deployed build.
- [ ] Final deployment URLs and repository URL are correct in the submission.
