# Screener Chart View — TradingView Parity Checklist

This document tracks feature parity between TradingView's screener chart view and our implementation.

Last updated: <!-- auto-update via CI if desired -->

## Legend
| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and verified |
| 🟡 | Partial / approximate |
| ❌ | Not implemented |

---

## Core View Toggle

| # | Feature | TradingView | Our App | Status | Notes |
|---|---------|------------|---------|--------|-------|
| 1 | Table / Chart view toggle button in toolbar | ✅ Icon buttons (list/grid) | ✅ `LayoutList` / `BarChart2` icons in `ScreenerTabBar` | ✅ | `data-testid`: `screener-view-toggle-table`, `screener-view-toggle-chart` |
| 2 | View mode persists across page refresh (URL state) | ✅ `?view=chart` in URL | ✅ URL param `?view=chart` via `useSearchParams` | ✅ | Falls back to `"table"` if param absent |
| 3 | Switching views preserves all active filters | ✅ | ✅ Filters are URL params — view toggle only adds/removes `view=chart` | ✅ | |

---

## Chart Toolbar

| # | Feature | TradingView | Our App | Status | Notes |
|---|---------|------------|---------|--------|-------|
| 4 | Period pills (1D, 5D, 1M, 3M, 6M, YTD, 1Y, 5Y, All) | ✅ | ✅ All 9 periods in `ScreenerChartToolbar` | ✅ | Default: `5D`; persisted via `?period=` |
| 5 | Chart type selector (Area, Line, Candlestick, Bar) | ✅ | ✅ 4 chart types in dropdown | ✅ | Persisted via `?chartType=`; Candlestick uses ComposedChart approximation |
| 6 | Layout picker — auto responsive columns | ✅ Auto layout | ✅ Auto: 1–5 cols based on viewport width | ✅ | Breakpoints: <640=1, 640–1024=2, 1024–1280=3, 1280–1536=4, 1536+=5 |
| 7 | Layout picker — custom N×M grid selector | ✅ Custom grid (up to 6×6) | ✅ Visual 6×6 grid picker in dropdown | ✅ | Persisted via `?layout=NxM` |
| 8 | Result count display in toolbar | ✅ Shows "X results" | ✅ `screener-chart-total-count` test-id | ✅ | |
| 9 | Refresh / reload data button | ✅ | ✅ `RefreshCw` icon triggers `window.location.reload()` | 🟡 | TV does a soft data refresh; ours does full page reload — acceptable for now |

---

## Chart Cards

| # | Feature | TradingView | Our App | Status | Notes |
|---|---------|------------|---------|--------|-------|
| 10 | Symbol + company name in card header | ✅ | ✅ `AssetAvatar` + `symbol` + `name` | ✅ | |
| 11 | Current price displayed | ✅ | ✅ Top-right price badge | ✅ | |
| 12 | Change % with green/red colour coding | ✅ | ✅ `#26A69A` (positive) / `#EF5350` (negative) | ✅ | Same hex colours as TradingView default theme |
| 13 | Mini area chart in card body | ✅ | ✅ `recharts` AreaChart with volume bars | ✅ | |
| 14 | Mini line chart in card body | ✅ | ✅ `recharts` LineChart | ✅ | |
| 15 | Mini candlestick chart in card body | ✅ | 🟡 `recharts` ComposedChart — no candlestick primitive in recharts | 🟡 | Full candlestick needs `lightweight-charts`; currently bar approximation |
| 16 | Hover tooltip on card (price, volume, time) | ✅ | ✅ Custom `ChartTooltip` component | ✅ | |
| 17 | Loading skeleton while data fetches | ✅ | ✅ Animated pulse skeleton card | ✅ | |
| 18 | "No data" state when OHLCV unavailable | ✅ | ✅ Centred "No data" text | ✅ | |

---

## Virtualized Grid / Scroll

| # | Feature | TradingView | Our App | Status | Notes |
|---|---------|------------|---------|--------|-------|
| 19 | Infinite scroll / lazy-load rows | ✅ | ✅ `react-virtuoso` `Virtuoso` with `useWindowScroll` + `endReached` | ✅ | Loads 10 rows of cards at a time |
| 20 | Grid reflows on window resize | ✅ | ✅ Tailwind responsive breakpoints reflow columns | ✅ | No JS-based resize listener needed |

---

## Context Menu

| # | Feature | TradingView | Our App | Status | Notes |
|---|---------|------------|---------|--------|-------|
| 21 | Right-click on card opens context menu | ✅ | ✅ `ScreenerRowContextMenu` mounted on right-click | ✅ | `data-testid`: `screener-row-context-menu` |
| 22 | "Add to watchlist" in context menu | ✅ | ✅ via `useUserList` | ✅ | |
| 23 | "Flag symbol" with colour picker in context menu | ✅ | ✅ via `useSymbolFlags` | ✅ | |

---

## Accessibility & Responsiveness

| # | Feature | TradingView | Our App | Status | Notes |
|---|---------|------------|---------|--------|-------|
| 24 | Mobile single-column layout | ✅ | ✅ 1 col < 640 px | ✅ | |
| 25 | Keyboard-accessible view toggle | ✅ | 🟡 Buttons are focusable but no explicit `aria-pressed` | 🟡 | Add `aria-pressed` in future iteration |
| 26 | `data-testid` attributes for E2E automation | N/A | ✅ All interactive elements have test IDs | ✅ | |

---

## Known Gaps / Future Work

1. **Candlestick charts** — `recharts` has no native candlestick primitive. True OHLC rendering requires migrating that chart type to `lightweight-charts` (already a dependency). Filed as a future task.
2. **Refresh button** — currently does a full page reload instead of a targeted data refresh. Hook `useScreenerChartData` already supports re-calling via `symbols` change; a manual `key` bump can trigger a soft refresh without reload.
3. **`aria-pressed`** on view toggle — minor accessibility gap; add when A11y sweep is done.
4. **Real OHLCV data** — the backend `GET /screener/chart-data` currently generates deterministic synthetic OHLCV seeded by symbol hash. Replace with a real market-data provider integration (polygon.io, FMP, etc.) when available.
