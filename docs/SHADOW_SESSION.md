# Shadow Session

> **The market that never sleeps, and the receipts to prove it.**

Bitget Reality tokenized stocks (`rNVDA`, `rAAPL`, …) trade 24/7. The real
NYSE only trades **Mon–Fri 09:30–16:00 America/New_York**. Everything else —
nights, weekends, holidays — is the **Shadow session**: live, tradable tape
while Wall Street is closed.

## Session boundary

- **Listed** = inside NYSE cash hours on a non-holiday weekday (ET).
- **Shadow** = everything else (nights, weekends, full-day US market holidays).
- DST is handled by `zoneinfo("America/New_York")` — 13:30–20:00 UTC in DST,
  14:30–21:00 UTC out of DST — plus a small hardcoded holiday list for demo
  scope (`backend/app/services/shadow.py`).

## What ships

1. **Where-the-move-occurred bars** — every settled/live battle splits its
   entry→now move into Listed vs Shadow from real Bitget `1H` candles
   (step deltas credited to the ending candle's session). No prediction —
   only "occurred in".
2. **Commitment ritual** — `If I am wrong, it will be because…` locked at
   creation, hashed into the same settlement freeze, read back verbatim.
3. **Flatten-before-dark** — counterfactual at the last Listed close:
   observed arithmetic, never a recommendation.
4. **Thesis Morgue** (`#/morgue`) — dead theses only, with verbatim sentence,
   session badge, and frozen hash. Newest first.
5. **Verify-freeze button** — runs `/verify` in front of the judge, shows
   `hash matches`.
6. **Honest granularity** — `1H` candles are labelled `~` estimates
   ("candle-bucket estimates, not exact fills"); only `1m` would show exact.

## Endpoints

- `GET /api/session/now` — current session (for debugging/demo).
- `GET /api/arena/morgue` — settled battles with shadow + sentence + hash.

## Judge script (60s)

1. *"Wall Street closed. Our market didn't."* — show a weekend move.
2. Open a battle → point at two bars → *"−3.1% happened at 03:11 UTC Saturday —
   in Shadow."*
3. Read the user's own sentence back verbatim.
4. Click **Verify freeze** → green `hash matches`.
5. Open **Morgue** → *"Other desks show wins. We show receipts."*
