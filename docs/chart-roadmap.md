# Chart Roadmap

## Current Status
- Chart engine: Canvas2D runtime only, no TradingView widget or lightweight-charts runtime.
- Chart types implemented: 20 / 20+
- Indicators implemented: 101 / 100+
- UX parity: in progress, starting with price-axis ergonomics

## Performance
- Benchmark command: `npm --prefix packages/tradereplay-charts run bench` after starting the app with `npm run app`.
- Measured on the local dev machine with Chromium headless against `http://localhost:8080`.
- 10k bars: initial setData 3.3 ms, indicator attach 0.3 ms, 1 indicator recompute 57.7 ms, wheel render avg 1.0 ms, pan render avg 1.8 ms.
- 50k bars: initial setData 8.1 ms, indicator attach 0.1 ms, 1 indicator recompute 277.3 ms, wheel render avg 1.2 ms, pan render avg 1.9 ms.
- 100k bars: initial setData 15.6 ms, indicator attach 0.1 ms, 1 indicator recompute 402.9 ms, wheel render avg 1.2 ms, pan render avg 1.8 ms.
- Wheel and pan bursts stay well under the loose regression thresholds used in e2e.

## UX Checklist
- [x] Price-axis drag scale and autoscale reset
- [x] Smooth pan/zoom with cursor-anchored wheel zoom
- [x] Crosshair with coordinate mapping and snap support
- [x] Crosshair labels exposed for deterministic regression checks
- [x] Time-scale "Go to live" affordance when user pans away
- [x] Draw trend lines and shapes
- [x] Select drawings from the object tree
- [x] Delete drawings
- [x] Undo / redo drawing actions
- [x] Drawing overlay persists across pan/zoom
- [x] Ghosting / frame residue fixed
- [x] Whole-object drag move for selected drawing
- [x] Pane resize by divider drag
- [ ] Screenshot export of chart + drawings
- [x] Keyboard Escape cancels active draft/move interactions
- [x] Stable data-testid hooks for drawing object/delete actions
- [x] Endpoint dragging coverage for selected trend lines
- [ ] 60fps interactions on 10k bars
- [ ] Listener duplication / memory leak audit

## Chart Types Checklist
- [x] Candlestick
- [x] Line
- [x] Area
- [x] Baseline
- [x] Histogram
- [x] Bar
- [x] Heikin Ashi
- [x] OHLC
- [x] Hollow Candles
- [x] Step Line
- [x] Range Area
- [x] Mountain Area
- [x] Candles + Volume
- [x] Line + Volume
- [x] Renko
- [x] Range Bars
- [x] Kagi
- [x] Point & Figure
- [x] Three-line break
- [x] Brick

## Indicator Checklist
- [x] sma
- [x] ema
- [x] rsi
- [x] macd
- [x] wma
- [x] vwap
- [x] bbands
- [x] donchian
- [x] keltner
- [x] atr
- [x] supertrend
- [x] psar
- [x] pivot
- [x] stochastic
- [x] cci
- [x] roc
- [x] momentum
- [x] williams_r
- [x] mfi
- [x] obv
- [x] cmf
- [x] adx
- [x] aroon
- [x] trix
- [x] ultimate
- [x] chaikin_osc
- [x] awesome
- [x] dpo
- [x] ichimoku
- [x] hma
- [x] dema
- [x] tema
- [x] zlema
- [x] kama
- [x] alma
- [x] lsma
- [x] stoch_rsi
- [x] rvi
- [x] ppo
- [x] pvo
- [x] tsi
- [x] dx
- [x] crsi
- [x] elder_ray
- [x] cmo
- [x] fisher
- [x] kdj
- [x] bollinger_percent_b
- [x] bollinger_bandwidth
- [x] chaikin_volatility
- [x] stddev
- [x] variance
- [x] adl
- [x] force_index
- [x] eom
- [x] nvi
- [x] pvi
- [x] vpt
- [x] aroon_oscillator
- [x] vortex
- [x] 40+ additional indicators to reach 100+

## Next Milestones
1. Expand indicators beyond 100+ with test coverage per indicator.
2. Add screenshot export of chart + drawings.
3. Keep the benchmark green while continuing to tighten 50k and 100k attach/recompute latency.
4. Add multi-select + grouped drawing operations.
5. Add additional chart types above the 20 baseline.
