# Chart Service Investigation — Loop 3 (CHART-001 root cause)

## Finding

**File:** `services/chart-service/src/services/candle.service.ts`
**Lines (pre-fix):** 47, 85, 94

The service had a `syntheticCandles()` generator that was used as both the
fallback when the internal backend returned empty/failed, AND as the silent
wrapper when normalization produced fewer rows than requested. This meant any
symbol for which the internal `/api/live/candles` endpoint returned `[]`
automatically received synthetic OHLCV (open ≈ 90 + hash(symbol)%100, deterministic
drift).

The Loop 2 chart cohort test found 14/21 symbols failing because 14 of the test
tickers (Indian equities, crypto pairs, forex, indices) are not served by the
internal live-candles endpoint — they fell through to the synthetic generator.

## Fix

1. **New service:** `services/chart-service/src/services/yahoo-chart.service.ts`
   - `mapToYahooSymbol(fullSymbol)` converts `NSE:RELIANCE` → `RELIANCE.NS`,
     `CBOE:SPX` → `^GSPC`, `CRYPTO:BTCUSDT` → `BTC-USD`, etc. Handles 16
     exchange prefixes + index aliases (`NIFTY`→`^NSEI`, `BANKNIFTY`→`^NSEBANK`,
     `SPX`→`^GSPC`, `SENSEX`→`^BSESN`, `NDX`, `DJI`, `VIX`, `FTSE`, `DAX`,
     `N225`, `HSI`).
   - `fetchYahooCandles(query)` hits
     `https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=…&range=…`
     with a browser UA and an 8 s abort signal. No API key required.
   - `isSyntheticCandleSeries(candles)` detects the Loop 2 bug signature
     (`open` arithmetic drift near 100, or `volume === 1834` constant) so a
     regression cannot slip through.

2. **Patched:** `candle.service.ts`
   - `fromBackend()` now throws `CANDLE_SOURCE_EMPTY_OR_SYNTHETIC` instead of
     silently falling into the synthetic path.
   - `getCandles()` orders sources: backend → Yahoo → (synthetic only if
     `ALLOW_SYNTHETIC_CANDLES=true`) → `[]`.
   - Production default: **no synthetic data is ever served**. The worst case
     is an empty array, which the frontend already renders as a clear
     "no data" state.

## Verification

- Unit tests: `services/chart-service/tests/yahoo-chart.test.cjs` — 12/12 PASS
  (8 mapping, 4 synthetic-detector).
- Cohort validation (`scripts/_chartCohortValidate.cjs`, run on server against
  real Yahoo): **21/21 PASS**. Last-close values match public sources
  (RELIANCE.NS 1363.30, AAPL 273.05, BTC-USD 75,600.79, ^NSEI 24,364.85,
  USDINR=X 93.09).
- Output: `reports/chart_cohort_loop3.json`.
