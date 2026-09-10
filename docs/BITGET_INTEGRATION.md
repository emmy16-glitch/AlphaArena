# Bitget Reality Integration

AlphaArena uses Bitget UTA v3 Reality market data as the market-of-record for the hackathon experience.

Official references:

- Reality Trading Guide: https://www.bitget.com/docs/uta/reality-trading-guide
- UTA market data catalogue: https://www.bitget.com/docs/catalog/market
- Reality trading catalogue: https://www.bitget.com/docs/catalog/reality/trading

## Reality assets

Bitget's Reality products are tokenized U.S. stock pairs identified by an `r` prefix, for example `rAAPLUSDT`. AlphaArena currently exposes a small deliberate universe:

```text
rNVDA
rTSLA
rAAPL
rMSFT
rAMD
rQQQ
```

Keeping the initial universe small makes the demo understandable and gives Vibe-Trading enough time to retrieve and cache meaningful underlying research instead of pretending to support every symbol equally well.

## Endpoints AlphaArena uses

### 1. Instrument discovery

```http
GET /api/v3/market/instruments?category=SPOT
```

`backend/app/services/bitget.py` filters the returned instruments using `isReality == yes`. The result is cached because the Reality instrument list does not need to be rediscovered on every screen refresh.

### 2. Ticker

```http
GET /api/v3/market/tickers?category=SPOT&symbol=rNVDAUSDT
```

AlphaArena reads the documented ticker fields needed by the product:

- `lastPrice`
- `openPrice24h`
- `price24hPcnt`
- `highPrice24h`
- `lowPrice24h`
- `bid1Price`
- `ask1Price`
- `volume24h`
- `turnover24h`
- `platformTurnover24h`
- `ts`

From those values the adapter derives the display price, absolute/percentage 24-hour move and spread basis points.

### 3. Candlesticks

```http
GET /api/v3/market/candles?category=SPOT&symbol=rNVDAUSDT&interval=1H&limit=24&type=market
```

Bitget's Reality guide states that rToken candlesticks use the `market` candle type and support a limited set of intervals including `1H`. AlphaArena uses the latest 24 hourly closes for the lightweight chart and short-window deterministic risk metrics.

## What AlphaArena deliberately does not use

Bitget documents Reality order placement and regular UTA order routes. Those are intentionally out of scope.

There is no AlphaArena call to:

```text
POST /api/v3/trade/place-reality-order
/api/v3/trade/*
```

There is also no exchange API key, secret, passphrase, wallet or deposit flow in the current product. Arena “stake” values are virtual ledger values only.

A backend safety test scans executable application source and fails CI if a Reality order path or generic UTA trade path is introduced.

## Whitelist/access behavior

Bitget's current Reality guide notes that Reality market-data availability may depend on whitelist/account access. AlphaArena therefore treats live data as an integration that can be unavailable:

- successful market response → UI may label the market as Bitget live,
- unavailable live market → the product can retain clearly identified preview/design data where appropriate,
- failed requests → the user receives a human message rather than a Bitget/HTTP stack trace.

The application must never relabel preview data as live.

## Error and retry behavior

The Bitget adapter uses bounded HTTP timeouts. It validates the Bitget response code and rejects missing/invalid last prices.

The public frontend never receives raw upstream messages for common failures. A 502-class upstream problem is translated to wording such as:

> Live market data or research is taking longer than usual. Try again in a moment.

For paper battle creation, a market-data failure happens before the battle is persisted, so a failed price lookup cannot consume virtual capital.

## Market timestamps and settlement

Every market asset includes Bitget's timestamp. Arena records the observed entry price when a battle is created. While a battle is live, the backend refreshes its mark from Bitget where possible. When the configured horizon expires, the next successful refresh freezes:

- `settled_price`
- `settled_at`
- user paper PnL
- opposing stance paper PnL

Once settled, later market prices cannot modify the battle result.

## Why AlphaArena does not execute trades

The hackathon thesis is decision stress-testing, not exchange automation. Real execution would add wallet/account permissions and financial risk while contributing little to the central product question:

**Can an AI trading desk make a thesis more falsifiable before a human acts?**

Bitget Reality still matters deeply because the paper decisions, live context and settlement are grounded against Bitget's market data rather than arbitrary hard-coded prices.
