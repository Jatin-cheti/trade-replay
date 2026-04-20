# TradingView Parity Benchmark Harness

This folder tracks screenshot parity between our chart surfaces and TradingView references.

## Directory layout

- `docs/tradingview-parity/ours/`: screenshots captured from this app.
- `docs/tradingview-parity/tradingview/`: matching screenshots captured from TradingView.
- `docs/tradingview-parity/diffs/`: generated visual diffs (red = changed pixels).
- `docs/tradingview-parity/reports/`: generated JSON reports.

## Filename convention

Use this exact naming pattern in both `ours/` and `tradingview/`:

`<symbol>_<timeframe>_<route>_<view>_<viewport>.png`

Examples:

- `AAPL_1m_simulation_normal_1440x900.png`
- `AAPL_1m_simulation_full_1440x900.png`
- `AAPL_1m_live-market_normal_1440x900.png`

If a file is present in one folder and missing in the other, it is reported as unmatched.

## Capture and compare

1. Capture our screenshots (Chromium):

   `npm run test:parity:capture`

2. Capture TradingView reference screenshots (auto-sized to match files in `ours/`):

   `npm run test:parity:reference`

   Optional overrides:
   - `PARITY_TV_SYMBOL=NASDAQ:AAPL`
   - `PARITY_TV_INTERVAL=1`
   - `PARITY_TV_THEME=dark`
   - `PARITY_TV_WAIT_MS=4500`

3. Run pixel diff with threshold gates:

   `npm run test:parity:diff`

4. Optional custom thresholds:

   `npm run test:parity:diff -- --maxPixelRatio=0.06 --maxAvgChannelDelta=14`

## Report output

`docs/tradingview-parity/reports/parity-report.json` contains:

- per-image `diffPixelRatio`
- per-image `avgChannelDelta`
- pass/fail flags by threshold
- unmatched file lists
- overall pass/fail summary

## Notes

- Treat this as a benchmark harness, not an exact visual identity check. Fonts, anti-aliasing, and watermark differences can raise small pixel deltas.
- Keep viewports and chart state deterministic before capturing (same symbol, timeframe, and full-view mode).
