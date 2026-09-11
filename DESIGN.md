---
version: alpha
name: "AlphaArena"
description: "An evidence-first paper-market laboratory with an editorial, instrument-panel feel."
colors:
  primary: "#141412"
  background: "#FAF9F6"
  surface: "#FFFFFF"
  surfaceMuted: "#F4F3EF"
  line: "#E7E5DE"
  lineStrong: "#D9D7CF"
  textMuted: "#8A8A84"
  accent: "#1D3DFF"
  success: "#0D7A4F"
  warning: "#9A6B00"
  danger: "#C93A3A"
typography:
  sans:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  serif:
    fontFamily: "Instrument Serif, Georgia, serif"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Consolas, monospace"
rounded:
  DEFAULT: "0.75rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1.75rem"
spacing:
  section-gap: "2rem"
  page-max: "80rem"
components:
  button: { backgroundColor: "#141412", textColor: "#FFFFFF", rounded: "9999px", height: "2.75rem" }
  card: { backgroundColor: "#FFFFFF", rounded: "1.75rem" }
  disclosure: { backgroundColor: "#F4F3EF", textColor: "#141412", rounded: "0.75rem" }
  muted-copy: { textColor: "#8A8A84" }
  focus-ring: { backgroundColor: "#1D3DFF" }
  success-status: { backgroundColor: "#0D7A4F" }
  warning-status: { backgroundColor: "#9A6B00" }
  danger-status: { backgroundColor: "#C93A3A" }
---

# AlphaArena Design System

## Overview

### Creative North Star

AlphaArena is a quiet market notebook: the paper, hairlines, monospace measurements, and serif annotations of a research desk translated into a responsive product. The signature is the contrast between calm editorial explanation and precise live-market numbers.

### Product context and register

- **Audience and primary job:** Beginners and curious builders test market hypotheses with paper-only, evidence-first scenarios.
- **Target market(s) and evidence:** Global English product; current repository contracts and the MarketTwin UX specification are the evidence.
- **Locale(s) and language policy:** English UI, locale-aware browser dates and numbers, plain language before finance terminology.
- **Usage scene:** Laptop and phone, exploratory sessions, moderate information density, no real-money urgency.
- **Register:** Hybrid: expressive landing page, disciplined product laboratory.
- **Memorable signature:** Every complex result begins with an “In simple terms” card before technical evidence.
- **Restraint:** Keep model names, beta, symbols, and historical mechanics below the beginner explanation.
- **Anti-references:** Avoid trading-terminal density, neon crypto dashboards, and prediction-market certainty.
- **Token ownership/runtime mapping:** This file mirrors the canonical runtime tokens in `src/index.css`; CSS variables are the implementation source and changes must be updated here in the same changeset.

## Colors

The paper background and white cards create a readable research surface. Black is the primary action and text anchor. Blue is reserved for focus, links, and active explanation. Green, amber, and red are semantic only; they never carry meaning without text.

## Typography

Inter handles controls and explanatory prose, Instrument Serif supplies restrained editorial emphasis, and JetBrains Mono handles prices, ranges, and measured values. Sentence case is preferred; uppercase micro-labels are reserved for navigation and metadata.

## Layout

Product pages use a generous editorial header followed by bounded cards. Desktop uses a two-column working area; mobile stacks controls before results and keeps the document naturally scrollable. The 320px layout must retain readable summaries and keyboard/touch targets.

## Elevation & Depth

Hierarchy comes from tonal surfaces and hairline borders, not persistent shadows. Active or live states may use a restrained accent ring. Technical details never receive more visual weight than the result summary.

## Shapes

Cards use large editorial radii, controls use pill geometry, and disclosure panels use medium rounded corners. Dividers are one-pixel hairlines. Icons are Lucide outline icons with text labels whenever the action is not universally understood.

## Components

### Foundational visual states

Buttons have hover, focus-visible, pressed, disabled, and busy states without changing dimensions. Loading uses named indeterminate stages; errors are inline and actionable. Reduced motion disables decorative transitions.

### Buttons and actions

Primary actions are black, secondary actions are white with a line, ghost actions are text-only, and semantic colors are reserved for statuses. Paper-only guardrails remain visible near actions that move into Arena.

### Navigation and data display

MarketTwin uses progressive disclosure: plain summary, affected assets, uncertainty, historical context, then technical details. Asset cards use accessible buttons for “View why”; historical records use accessible disclosure buttons.

### Forms and overlays

Inputs have visible labels, inline validation, stable busy geometry, and `resize: none` textareas. Short explanations are inline rather than modal so mobile users keep context.

### Iconography

Lucide outline icons are 14–20px in controls and 16–24px in section headers. Icons support, never replace, a visible label.

### Motion

Motion is calm and functional: short fade/height transitions communicate state. Numerical values do not animate as if they were live certainty. `prefers-reduced-motion` is respected globally.

### Content and data visualization

Use “could,” “estimated,” “historical context,” and “stress test.” Never say “will,” “guaranteed,” “expected return,” or “recommendation.” Confidence means evidence strength, not probability.

## Do's and Don'ts

- **Do:** Explain the scenario in common words before showing beta, symbols, or model provenance.
- **Do:** Preserve the original scenario when a user challenges or changes an assumption.
- **Don't:** Present historical daily context as a match for a hypothetical scenario.
- **Don't:** Use color, model names, or dense dashboards as a substitute for explanation.
