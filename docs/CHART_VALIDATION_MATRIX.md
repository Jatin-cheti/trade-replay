# Chart Validation Matrix

> Last updated: 2026-04-11 · Branch: `chart-engine`

## A) Chart Types

| Chart Type | Renders | Crosshair | Zoom/Pan | OHLC Updates | Export PNG |
|-----------|---------|-----------|----------|--------------|-----------|
| Candlestick | ✅ | ✅ | ✅ | ✅ | ✅ |
| Line | ✅ | ✅ | ✅ | ✅ | ✅ |
| Area | ✅ | ✅ | ✅ | ✅ | ✅ |
| Baseline | ✅ | ✅ | ✅ | ✅ | ✅ |
| Histogram | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bar | ✅ | ✅ | ✅ | ✅ | ✅ |
| OHLC | ✅ | ✅ | ✅ | ✅ | ✅ |
| Heikin Ashi | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hollow Candles | ✅ | ✅ | ✅ | ✅ | ✅ |
| Step Line | ✅ | ✅ | ✅ | ✅ | ✅ |
| Range Area | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mountain Area | ✅ | ✅ | ✅ | ✅ | ✅ |
| Renko | ✅ | ✅ | ✅ | ✅ | ✅ |
| Range Bars | ✅ | ✅ | ✅ | ✅ | ✅ |
| 3-Line Break | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kagi | ✅ | ✅ | ✅ | ✅ | ✅ |
| Point & Figure | ✅ | ✅ | ✅ | ✅ | ✅ |
| Brick | ✅ | ✅ | ✅ | ✅ | ✅ |
| Candles + Volume | ✅ | ✅ | ✅ | ✅ | ✅ |
| Line + Volume | ✅ | ✅ | ✅ | ✅ | ✅ |

## B) Drawing Tools

### Tier 1 Core Tools

| Tool | Select | Preview | Commits | Object Tree | Move/Edit | Delete | Undo/Redo | Magnet On | Magnet Off | Live Stable | ChartType Switch | Multi-Chart |
|------|--------|---------|---------|-------------|-----------|--------|-----------|-----------|------------|-------------|-----------------|-------------|
| Trend Line | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ray | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Extended Line | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| H-Line | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| V-Line | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rectangle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Circle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Triangle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Anchored Text | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Note | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Measure | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Tier 2 Advanced Tools

| Tool | Select | Preview | Commits | Object Tree | Move/Edit | Delete | Undo/Redo | Magnet |
|------|--------|---------|---------|-------------|-----------|--------|-----------|--------|
| Channel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fib Retracement | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fib Extension | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fib Channel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fib Arcs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fib Fan | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pitchfork (3) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| XABCD | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Long/Short Pos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## C) Indicators

| Indicator | Add | Remove | Legend | Pane | Live Stable | ChartType Switch | Multi-Chart |
|-----------|-----|--------|--------|------|-------------|-----------------|-------------|
| SMA | ✅ | ✅ | ✅ | Overlay | ✅ | ✅ | ✅ |
| EMA | ✅ | ✅ | ✅ | Overlay | ✅ | ✅ | ✅ |
| VWAP | ✅ | ✅ | ✅ | Overlay | ✅ | ✅ | ✅ |
| RSI | ✅ | ✅ | ✅ | Separate | ✅ | ✅ | ✅ |
| MACD | ✅ | ✅ | ✅ | Separate | ✅ | ✅ | ✅ |
| Bollinger Bands | ✅ | ✅ | ✅ | Overlay | ✅ | ✅ | ✅ |
| ATR | ✅ | ✅ | ✅ | Separate | ✅ | ✅ | ✅ |
| ADX | ✅ | ✅ | ✅ | Separate | ✅ | ✅ | ✅ |
| Stochastic | ✅ | ✅ | ✅ | Separate | ✅ | ✅ | ✅ |
| Ichimoku | ✅ | ✅ | ✅ | Overlay | ✅ | ✅ | ✅ |
| OBV | ✅ | ✅ | ✅ | Separate | ✅ | ✅ | ✅ |
| CCI | ✅ | ✅ | ✅ | Separate | ✅ | ✅ | ✅ |

*(101 indicators total — all pass unit tests. Above are representative.)*

## D) Multi-Chart (Super Charts)

| Feature | 1×1 | 1×2 | 2×1 | 2+1 | 2×2 |
|---------|-----|-----|-----|-----|-----|
| Renders | ✅ | ✅ | ✅ | ✅ | ✅ |
| Active pane highlight | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tool in active pane only | ✅ | ✅ | ✅ | ✅ | ✅ |
| Indicators per pane | ✅ | ✅ | ✅ | ✅ | ✅ |
| Resize stable | ✅ | ✅ | ✅ | ✅ | ✅ |

## E) Live / Replay Modes

| Feature | Status |
|---------|--------|
| Pinned live (auto-scroll) | ✅ |
| Unpinned (Go Live button) | ✅ |
| Tools stable during live | ✅ |
| Graceful degradation (no Kafka/Redis) | ✅ |

## F) UI Controls

| Control | Implemented | Accessible | Not Clipped | E2E Test |
|---------|-------------|------------|-------------|----------|
| Top Toolbar | ✅ | ✅ | ✅ | Yes |
| Toolbox Panel | ✅ | ✅ | ⚠️ Scroll needed | Yes |
| OHLC Status Row | ✅ | ✅ | ✅ | Yes |
| Snap Mode Dropdown | ✅ | ✅ | ✅ | No |
| Indicators Panel | ✅ | ✅ | ✅ | Yes |
| Object Tree | ✅ | ✅ | ✅ | Partial |
| Tool Options Panel | ✅ | ✅ | ✅ | No |
| Drawing Badge | ✅ | ✅ | ✅ | Yes |
