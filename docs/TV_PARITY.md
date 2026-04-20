# TradingView Parity Inventory

> Last updated: 2026-04-11 · Branch: `chart-engine`

## Tier Definitions

| Tier | Description |
|------|-------------|
| **Tier 1** | Core features required for a usable charting platform. Must be stable before moving on. |
| **Tier 2** | Advanced tools and features that bring TradingView-like depth. |
| **Tier 3** | Polish, niche tools, and workflow optimizations. |

---

## A) Chart Types (20 total)

| Chart Type | Status | Tier | Notes | E2E Test |
|-----------|--------|------|-------|----------|
| Candlestick | ✅ Supported | 1 | Default type | Yes |
| Line | ✅ Supported | 1 | | Yes |
| Area | ✅ Supported | 1 | | Yes |
| Baseline | ✅ Supported | 2 | | Yes (dropdown) |
| Histogram | ✅ Supported | 2 | | Yes (dropdown) |
| Bar | ✅ Supported | 2 | | Yes (dropdown) |
| OHLC | ✅ Supported | 2 | | Yes (dropdown) |
| Heikin Ashi | ✅ Supported | 2 | | Yes (dropdown) |
| Hollow Candles | ✅ Supported | 2 | | Yes (dropdown) |
| Step Line | ✅ Supported | 2 | | Yes (dropdown) |
| Range Area | ✅ Supported | 2 | | Yes (dropdown) |
| Mountain Area | ✅ Supported | 2 | | Yes (dropdown) |
| Renko | ✅ Supported | 3 | Custom transform | Yes (dropdown) |
| Range Bars | ✅ Supported | 3 | Custom transform | Yes (dropdown) |
| 3-Line Break | ✅ Supported | 3 | Custom transform | Yes (dropdown) |
| Kagi | ✅ Supported | 3 | Custom transform | Yes (dropdown) |
| Point & Figure | ✅ Supported | 3 | Custom transform | Yes (dropdown) |
| Brick | ✅ Supported | 3 | Custom transform | Yes (dropdown) |
| Candles + Volume | ✅ Supported | 2 | | Yes (dropdown) |
| Line + Volume | ✅ Supported | 2 | | Yes (dropdown) |

---

## B) Drawing Tool Menus (TradingView-parity rail layout)

### Cursor Menu (rail-cursor)

| Tool | Status | Tier | Notes |
|------|--------|------|-------|
| Cross | ✅ Supported | 1 | Default cursor mode |
| Dot | ✅ Supported | 1 | UI state change |
| Arrow | ✅ Supported | 1 | UI state change |
| Demonstration | ✅ Supported | 1 | UI state change |
| Eraser | ✅ Supported | 1 | Deletes drawings on click |
| Values tooltip toggle | ✅ Supported | 1 | Persisted to localStorage |

### Lines Menu (rail-lines)

#### Lines section

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| Trendline | ✅ Supported | ✅ | ✅ | ✅ | Yes |
| Ray | ✅ Supported | ✅ | ✅ | ✅ | No |
| Info line | ❌ Missing | — | — | — | No |
| Extended line | ✅ Supported | ✅ | ✅ | ✅ | No |
| Trend angle | ❌ Missing | — | — | — | No |
| Horizontal line | ✅ Supported | ✅ | ✅ | ✅ | No |
| Horizontal ray | ✅ Supported | ✅ | ✅ | ✅ | No |
| Vertical line | ✅ Supported | ✅ | ✅ | ✅ | No |
| Cross line | ❌ Missing | — | — | — | No |

#### Channels section

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| Parallel channel | ✅ Supported | ⚠️ Partial | ✅ | ✅ | No |
| Regression trend | ❌ Missing | — | — | — | No |
| Flat top/bottom | ❌ Missing | — | — | — | No |
| Disjoint channel | ❌ Missing | — | — | — | No |

#### Pitchforks section

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| Pitchfork | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Schiff pitchfork | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Modified Schiff pitchfork | ❌ Missing | — | — | — | No |
| Inside pitchfork | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |

### Fibonacci Menu (rail-fib)

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| Fib retracement | ✅ Supported | ✅ | ✅ | ✅ | No |
| Trend-based fib extension | ✅ Supported | ✅ | ✅ | ✅ | No |
| Fib channel | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Fib time zone | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Fib speed resistance fan | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Trend-based fib time | ❌ Missing | — | — | — | No |
| Fib circles | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Fib spiral | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Fib speed resistance arcs | ❌ Missing | — | — | — | No |
| Fib wedge | ❌ Missing | — | — | — | No |
| Pitchfan | ❌ Missing | — | — | — | No |

### Gann Menu (rail-gann)

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| Gann box | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Gann square fixed | ❌ Missing | — | — | — | No |
| Gann square | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Gann fan | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |

### Patterns Menu (rail-patterns)

#### Chart Patterns section

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| XABCD pattern | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Cypher pattern | ❌ Missing | — | — | — | No |
| Head and shoulders | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| ABCD pattern | ❌ Missing | — | — | — | No |
| Triangle pattern | ✅ Supported | ⚠️ Basic | ✅ | ✅ | Yes |
| Three drives pattern | ❌ Missing | — | — | — | No |

#### Elliott Waves section

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| Elliott impulse wave (1-2-3-4-5) | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Elliott correction wave (A-B-C) | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Elliott triangle wave (A-B-C-D-E) | ❌ Missing | — | — | — | No |
| Elliott double combo wave (W-X-Y) | ❌ Missing | — | — | — | No |
| Elliott triple combo wave (W-X-Y-X-Z) | ❌ Missing | — | — | — | No |

#### Cycles section

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| Cyclic lines | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Time cycles | ❌ Missing | — | — | — | No |
| Sine line | ❌ Missing | — | — | — | No |

### Shapes Menu (rail-shape)

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| Rectangle | ✅ Supported | ✅ | ✅ | ✅ | No |
| Circle | ✅ Supported | ✅ | ✅ | ✅ | No |
| Triangle | ✅ Supported | ✅ | ✅ | ✅ | No |
| Brush | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |

### Text Menu (rail-text)

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| Anchored Text | ✅ Supported | ✅ | ✅ | ✅ | Yes |
| Note | ✅ Supported | ✅ | ✅ | ✅ | No |
| Price Label | ✅ Supported | ✅ | ✅ | ✅ | No |
| Callout | ✅ Supported | ✅ | ✅ | ✅ | No |
| Comment | ✅ Supported | ✅ | ✅ | ✅ | No |
| Pin | ✅ Supported | ✅ | ✅ | ✅ | No |
| Emoji | ✅ Supported | ✅ | ✅ | ✅ | No |
| Icon Up/Down/Flag | ✅ Supported | ✅ | ✅ | ✅ | No |

### Measure Menu (rail-measure)

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| Measure | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Zoom | ✅ Supported | ✅ | ✅ | ✅ | No |

### Position Menu (rail-position)

| Tool | Status | Rendering | Select/Move | Undo/Redo | E2E |
|------|--------|-----------|-------------|-----------|-----|
| Long Position | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |
| Short Position | ✅ Supported | ⚠️ Basic | ✅ | ✅ | No |

---

## C) Indicators (101 total)

| Category | Count | Status | E2E Test |
|----------|-------|--------|----------|
| Moving Averages (SMA, EMA, WMA, VWAP, HMA, DEMA, TEMA, ZLEMA, KAMA, ALMA, LSMA) | 11 | ✅ All pass unit tests | MACD add/remove |
| Momentum (RSI, MACD, Stochastic, etc.) | 15 | ✅ All pass unit tests | MACD search/add |
| Volatility (ATR, Bollinger, Keltner, etc.) | 10 | ✅ All pass unit tests | Bollinger search |
| Trend (ADX, Aroon, PSAR, Ichimoku, etc.) | 15 | ✅ All pass unit tests | ADX add |
| Volume (OBV, MFI, CMF, etc.) | 13 | ✅ All pass unit tests | No |
| Price Action (CCI, Williams %R, etc.) | 17 | ✅ All pass unit tests | No |
| Advanced (Ulcer, Mass Index, etc.) | 12 | ✅ All pass unit tests | No |
| Statistical (SMMA, TRIMA, etc.) | 9 | ✅ All pass unit tests | No |

Searchable dropdown: ✅ Implemented  
Top 5 quick-add: ✅ Implemented (SMA, EMA, VWAP, RSI, MACD)  
Keyboard navigation: ✅ Implemented  

---

## D) Multi-Chart (Super Charts)

| Feature | Status | E2E Test |
|---------|--------|----------|
| 1×1 layout | ✅ Supported | No |
| 1×2 horizontal | ✅ Supported | No |
| 2×1 vertical | ✅ Supported | No |
| 2+1 layout | ✅ Supported | No |
| 2×2 layout | ✅ Supported | No |
| Active pane highlight | ✅ Supported | No |
| Independent drawings per pane | ✅ Supported | No |
| Independent indicators per pane | ✅ Supported | No |

---

## E) Core UX Features

| Feature | Status | E2E Test |
|---------|--------|----------|
| Undo/Redo | ✅ Supported | Yes |
| Object Tree (select/lock/hide/delete) | ✅ Supported | Partial |
| Magnet mode (OHLC snap) | ✅ Supported | Yes |
| Crosshair snap modes (free/time/ohlc) | ✅ Supported | No |
| Cursor modes (cross/dot/arrow/demo/eraser) | ✅ Supported | No |
| Values tooltip on long press | ✅ Supported | No |
| Export PNG | ✅ Supported | Yes |
| Go to Live button | ✅ Supported | No |
| OHLC status row | ✅ Supported | Yes |
| Left tool rail (TradingView-style) | ✅ Supported | Yes |
| Top bar (chart type, undo/redo, magnet, snap, indicators) | ✅ Supported | Yes |
| Anchored popover submenus | ✅ Supported | Yes |
| Sectioned submenus (Lines/Channels/Pitchforks) | ✅ Supported | No |
| Disabled tool "Coming soon" labels | ✅ Supported | No |
| Dropdown styling (contrast/borders/hover) | ✅ Supported | Yes |
| Drawing anchoring (time/price) | ✅ Supported | Yes |
| Drawing visibility during resize | ✅ Supported | Yes |
| Mobile touch modes (pan/zoom/scroll) | ✅ Supported | No |

---

## F) Known Rendering Gaps (Tier 2+ tools)

The following tool families have registrations and basic line/shape rendering, but lack family-specific overlay rendering:

- **Channel**: Renders as 2-point line, should render parallel fill region
- **Fib Arcs / Fan / Spiral**: Render basic fib levels, should render arcs/fan lines/spiral curves
- **Gann tools**: Render as fib levels, should render Gann-specific geometry
- **Pitchforks**: Render as multi-point lines, should render median line + parallels
- **Patterns**: Render as polylines, should render labeled pattern structures
- **Positions**: Render as rectangles, should render entry/SL/TP zones with labels
- **Measure**: Renders as line, should render distance/bars/percentage label

---

## G) Missing Features (not yet implemented)

| Feature | Tier | Priority |
|---------|------|----------|
| Drawing serialization (save/load JSON) | 2 | Medium |
| Drawing templates/presets | 3 | Low |
| Indicator settings UI per instance | 2 | Medium |
| Alert lines | 3 | Low |
| Replay/playback controls | 2 | Medium |
| Timeframe selector | 2 | Medium |
| Symbol search | 2 | Medium |
| Crosshair sync across multi-chart panes | 3 | Low |
| Drawing sync across panes | 3 | Low |
| Right-click context menu on drawings | 2 | Medium |
| Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Del) | 2 | Medium — Del exists |
