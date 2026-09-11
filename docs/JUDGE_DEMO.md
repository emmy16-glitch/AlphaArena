# Judge Demo — 3 Minutes

This script is intentionally truthful to the current product. Do not claim a paper battle settled unless it actually has.

## 0:00–0:25 — Problem

> Most AI trading products try to give you another prediction. AlphaArena does something different: before you act, it tries to make your idea easier to disprove.

Show the landing page and the loop: Watch → Challenge → Simulate → Battle → Review.

## 0:25–0:55 — Pulse

Open Pulse.

> This is the live evidence layer. Prices and short-window market context come from Bitget Reality tokenized U.S. equities. I can choose an asset because something measurable changed, not because an AI generated a headline.

Open an asset/NightWatch.

## 0:55–1:35 — NightWatch

Edit the thesis so the demo is visibly user-driven.

> I tell NightWatch what I believe and the direction I am considering. It does not place a trade. It builds the strongest support and objection, runs deterministic stress cases, and gives me explicit invalidation conditions.

Point to source labels.

> Historical context comes from the Vibe-Trading research sidecar when verified data is available. If that research is missing, AlphaArena says so instead of inventing a historical story.

## 1:35–2:10 — MarketTwin

Open Lab with a simple adverse scenario such as “Nasdaq falls 5%.”

> MarketTwin changes one assumption and shows impact ranges. For Nasdaq shocks it can use measured historical beta from Vibe-Trading, but only after a minimum aligned-history gate. Otherwise it labels the output as an AlphaArena sensitivity prior. Qwen can explain the result, but it is not allowed to rewrite these numbers.

Point to the model-source line.

## 2:10–2:45 — Arena

Open Arena.

> Now I can commit the thesis to a paper battle at the observed Bitget Reality price. There is no deposit, wallet or exchange order endpoint. The $100,000 balance is virtual. When the horizon ends, AlphaArena freezes the observed settlement price and the result cannot be rewritten by a later price.

If a previously settled battle exists, show its review. Otherwise show the live battle and say it is still live.

## 2:45–3:00 — Close

> AlphaArena is not trying to replace the trader. It is trying to make the trader's reasoning falsifiable. Predict less. Test more. Let the market decide.

## Technical questions judges may ask

**Where is Bitget used?**

UTA v3 Reality instrument discovery, ticker data and market candlesticks; those prices also mark/settle paper battles.

**Where is AI used?**

Qwen is optional, user-triggered synthesis. Core metrics, stress numbers, historical statistics, paper PnL and settlement are deterministic.

**Where is Vibe-Trading used?**

Historical underlying/QQQ data, technical/fundamental/news/filing research, then AlphaArena computes beta, correlation, volatility, drawdown and mechanical analogues.

**Can this spend money in the background?**

Pulse's timer uses public market metrics only. The model client has a configurable application-side attempt fuse and no scheduled model calls.

**Can it place a Bitget order?**

No. The current application has no Bitget trade/order path, and CI fails if one is introduced into backend application source.
