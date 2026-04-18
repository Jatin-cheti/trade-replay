# Screener Interaction Specification

> TradingView-parity screener system — interaction patterns, architecture, and validation checklist.

---

## 1. TradingView Reference (Researched)

### 1.1 Page Structure
- **Title dropdown** — "Stock Screener" button toggles screener-type selector (Stocks, ETFs, Bonds, Crypto, CEX, DEX)
- **Screen menu** — "All stocks" dropdown with save/share/copy/rename/download/create/open actions
- **Settings gear** — screener settings icon
- **Hide filters toggle** — eye icon to collapse filter bar
- **Column set tabs** — icon-based tablist (list view / compact view) + "Column sets" button
- **Filter bar** — horizontal scrollable row of filter chips with dropdowns
- **Table** — sticky header with sortable columns, virtualized rows, infinite scroll
- **Symbol count** — "7740" badge next to Symbol column header

### 1.2 Default Columns (Overview Tab)
| # | Column | TradingView Label |
|---|--------|-------------------|
| 1 | Symbol | Symbol |
| 2 | Price | Price |
| 3 | Change % | Change % |
| 4 | Volume | Volume |
| 5 | Rel Volume | Rel Volume |
| 6 | Market cap | Market cap (with sort arrow) |
| 7 | P/E | P/E |
| 8 | EPS dil TTM | EPS dil TTM |
| 9 | EPS dil growth TTM YoY | EPS dil growth TTM YoY |
| 10 | Div yield % TTM | Div yield % TTM |
| 11 | Sector | Sector |
| 12 | Analyst Rating | Analyst Rating |

### 1.3 Default Filters (Overview Tab)
| Filter | Type | Behavior |
|--------|------|----------|
| US (Market) | Multi-select dropdown | Country filter with search |
| Watchlist | Multi-select dropdown | User watchlist selection |
| Index | Multi-select dropdown | Market index selection |
| Price | Range (min/max) | Numeric range filter |
| Change % | Range (min/max) | Percent change range |
| Market cap | Range (min/max) | Market cap range |
| P/E | Range (min/max) | Price-to-earnings ratio range |
| EPS dil growth | Range (min/max) | EPS diluted growth range |
| Div yield % | Range (min/max) | Dividend yield range |
| Sector | Multi-select dropdown | Sector selection |
| Analyst Rating | Multi-select dropdown | Rating selection (Strong buy → Strong sell) |
| Perf % | Range (min/max) | Performance percent range |
| Revenue growth | Range (min/max) | Revenue growth range |
| PEG | Range (min/max) | Price/earnings-to-growth range |
| ROE | Range (min/max) | Return on equity range |
| Beta | Range (min/max) | Beta volatility range |
| Recent earnings date | Date range | Past earnings date range |
| Upcoming earnings date | Date range | Future earnings date range |

### 1.4 Interaction Patterns
- **Filter chip click** → opens inline dropdown editor below the chip
- **Outside click** → closes any open dropdown
- **Add filter button** (+) → opens searchable list of all available filters
- **Reset options button** (↺) → clears all filter selections
- **Column header click** → toggles sort direction (asc ↔ desc)
- **Column setup button** (last column header) → opens column configuration panel
- **Row click** → navigates to symbol detail page
- **Infinite scroll** → loads next batch when near bottom
- **URL sync** → all filter/sort/column state persisted in URL params

---

## 2. Implementation Architecture

### 2.1 Backend Service Layer
```
backend/src/
├── controllers/screenerController.ts   — Express handlers + Zod validation
├── routes/screenerRoutes.ts            — GET /meta, /stats, /list, /filters, /search, /symbol/:symbol
├── services/
│   ├── screener/
│   │   ├── screener.constants.ts       — Types, tabs, filters, columns, countries, indices
│   │   ├── screener.types.ts           — TypeScript interfaces
│   │   ├── screener.repository.ts      — MongoDB query layer (CleanAsset + Symbol)
│   │   ├── symbolQuery.service.ts      — Query engine with filter/sort/scan
│   │   └── screenerMeta.service.ts     — Metadata endpoint
│   ├── symbolAggregation.service.ts    — Data aggregation (prices + fundamentals + logos)
│   └── screenerCache.service.ts        — L1 (memory) + L2 (Redis) cache
```

### 2.2 API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/screener/meta` | Screener types, tabs, filters, columns, countries, indices |
| GET | `/api/screener/stats` | Total count + per-type counts |
| GET | `/api/screener/list` | Paginated filtered symbol list |
| GET | `/api/screener/filters` | Dynamic filter options (sectors, exchanges) |
| GET | `/api/screener/search` | Fast trie-based symbol search |
| GET | `/api/screener/symbol/:symbol` | Single symbol detail |

### 2.3 Frontend Components
```
frontend/pages/Screener.tsx — Full screener page
├── Type dropdown (screener type selector)
├── Screen menu (save/share/download actions)
├── Search input (debounced 250ms, URL-synced)
├── Filter bar
│   ├── MultiSelectEditor — for country/exchange/sector/analyst/watchlist/index
│   ├── RangeEditor — for price/marketCap/pe/eps/div/perf/revenue/peg/roe/beta
│   ├── DateRangeEditor — for recent/upcoming earnings dates
│   └── ToggleEditor — for primary listing toggle
├── Tab bar (11 tabs with animated underline)
├── Desktop table (react-virtuoso, sticky header, sortable columns)
└── Mobile card view (react-virtuoso, touch-friendly)
```

### 2.4 Data Flow
```
Frontend                          Backend
────────                          ───────
Screener.tsx
  ↓ api.get("/screener/meta")  →  screenerMeta.service
  ↓ api.get("/screener/list")  →  screenerController.list()
                                    ↓ Zod validate query params
                                    ↓ buildFilters() → ScreenerFiltersInput
                                    ↓ getCachedRaw() (L1 → L2 → compute)
                                    ↓ symbolQuery.getSymbols()
                                      ↓ buildRepositoryQuery()
                                      ↓ screener.repository.listAssets() [MongoDB]
                                      ↓ enrichScreenerBatch() [prices + logos]
                                      ↓ mapRow() [derive display fields]
                                      ↓ applyFilters() [in-memory filter]
                                      ↓ sortRows() [in-memory sort]
                                    ↓ JSON.stringify() → cache → response
```

---

## 3. Filter Completeness Matrix

| Filter | Frontend | Controller | Types | Query Service | Repository |
|--------|----------|------------|-------|---------------|------------|
| Market (country) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exchange | ✅ | ✅ | ✅ | ✅ | ✅ |
| Watchlist | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| Index | ✅ | ✅ | ✅ | ✅ (scope builder) | — |
| Primary listing | ✅ | ✅ | ✅ | ✅ | ✅ |
| Price | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| Change % | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| Market cap | ✅ | ✅ | ✅ | ✅ | ✅ |
| P/E | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| EPS dil growth | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| Div yield % | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| Sector | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analyst Rating | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| Perf % | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| Revenue growth | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| PEG | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| ROE | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| Beta | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| Recent earnings date | ✅ | ✅ | ✅ | ✅ (in-memory) | — |
| Upcoming earnings date | ✅ | ✅ | ✅ | ✅ (in-memory) | — |

---

## 4. Column Completeness Matrix

| Column | Frontend Render | Backend MapRow | Sort Support |
|--------|----------------|----------------|--------------|
| Symbol | ✅ (avatar + name) | ✅ | ✅ |
| Name | ✅ | ✅ | ✅ |
| Price | ✅ (formatted) | ✅ (real price) | ✅ |
| Change % | ✅ (colored +/-) | ✅ (real) | ✅ |
| Volume | ✅ (compact) | ✅ (real) | ✅ |
| Rel Volume | ✅ | ✅ | ✅ |
| Market cap | ✅ (compact) | ✅ (real) | ✅ |
| P/E | ✅ | ✅ (from DB) | ✅ |
| EPS dil TTM | ✅ | ✅ (from DB) | ✅ |
| EPS dil growth | ✅ | ✅ (derived from DB) | ✅ |
| Div yield % | ✅ | ✅ (from DB) | ✅ |
| Sector | ✅ | ✅ (from DB) | — |
| Analyst Rating | ✅ | ✅ (from DB) | ✅ |
| Perf % | ✅ (colored) | ✅ (from change%) | ✅ |
| Revenue growth | ✅ | ✅ (from DB) | ✅ |
| PEG | ✅ | ✅ (derived) | ✅ |
| ROE | ✅ | ✅ (from DB) | ✅ |
| Beta | ✅ | ✅ (from DB) | ✅ |
| Recent earnings date | ✅ (formatted) | ✅ (from DB) | ✅ |
| Upcoming earnings date | ✅ (formatted) | ✅ (from DB) | ✅ |
| Exchange | ✅ | ✅ | — |
| Country | ✅ | ✅ | — |
| Currency | ✅ | ✅ | — |
| Net income | ✅ (compact) | ✅ (from DB) | — |
| Revenue | ✅ (compact) | ✅ (from DB) | — |
| Shares float | ✅ (compact) | ✅ (from DB) | — |

---

## 5. Screener Types

| Route Type | Label | Asset Types | Market Class |
|-----------|-------|-------------|--------------|
| stocks | Stock Screener | stock | all |
| etfs | ETF Screener | etf | all |
| bonds | Bond Screener | bond | all |
| crypto-coins | Crypto Coins Screener | crypto | all |
| cex-pairs | CEX Screener | crypto | cex |
| dex-pairs | DEX Screener | crypto | dex |

---

## 6. Tab Definitions (11 tabs)

| Tab Key | Label | Focus Columns |
|---------|-------|---------------|
| overview | Overview | Standard market overview |
| performance | Performance | Price performance + beta |
| extended-hours | Extended Hours | Pre/post market data |
| valuation | Valuation | P/E, PEG, EPS, market cap |
| dividends | Dividends | Dividend yield focus |
| profitability | Profitability | ROE, revenue growth, EPS |
| income-statement | Income Statement | Revenue, net income, EPS |
| balance-sheet | Balance Sheet | Market cap, shares, beta |
| cash-flow | Cash Flow | Revenue, net income |
| per-share | Per Share | EPS, P/E, dividends |
| technicals | Technicals | Change %, beta, rel volume |

---

## 7. Performance Architecture

| Feature | Implementation |
|---------|---------------|
| Virtual scrolling | react-virtuoso with 450px overscan |
| Batch loading | 50 items per request |
| Prefetch | Next batch fetched after current loads |
| L1 cache | In-memory Map (30s TTL, 200 max entries) |
| L2 cache | Redis (60s TTL) |
| Redis pipeline | Batch mget/set for enrichment (no N+1) |
| Scan limit | MAX_SCAN_ROWS = 25,000 |
| Debounced search | 250ms debounce on search input |
| Request dedup | fetchKeyRef + fetchCounterRef prevent stale updates |

---

## 8. Zero Dummy Data Compliance

### Removed Synthetic Generators
- ❌ `generateFundamentals()` — was using seeded random hash to produce fake PE, EPS, dividend, beta, ROE, revenue growth, net income, revenue, shares float
- ❌ `deriveAnalystRating()` — was computing fake analyst score from change% + growth + ROE + dividend - beta
- ❌ `deriveEarningsDates()` — was generating fake recent/upcoming earnings dates from symbol hash
- ❌ Hash-based `relVolume` — was using `symbolHash()` to create fake average volume
- ❌ Hash-based volume fallback — was generating `100_000 + symbolHash % 900_000` as fake volume

### Current Data Sources
- **Price/Change/Volume**: Real-time from `priceCache.service` → `snapshotEngine.service`
- **Market Cap**: From CleanAsset/Symbol MongoDB documents
- **Fundamentals (PE, EPS, etc.)**: From DB documents — returns 0 if not stored
- **Logos**: `logoResolver.service` with S3/domain/fallback tiers
- **Sector/Exchange/Country**: From CleanAsset/Symbol documents

---

## 9. Navbar Structure

### Products Menu
- **Supercharts** → `/simulation`
- **Screeners** (expandable submenu)
  - Stocks → `/screener/stocks`
  - ETFs → `/screener/etfs`
  - Bonds → `/screener/bonds`
  - Crypto coins → `/screener/crypto-coins`
  - CEX pairs → `/screener/cex-pairs`
  - DEX pairs → `/screener/dex-pairs`
  - Heat Maps: Stocks, ETFs, Crypto coins
- **Portfolio** → `/portfolio/create`
- **Dashboard** → `/dashboard`
- **Live Market** → `/live-market`

### Markets Menu
- 🇮🇳 India: Stocks, Indices, ETFs
- 🇺🇸 United States: Stocks, ETFs, Indices
- Global: Crypto coins, CEX pairs, DEX pairs, Bonds

### Behavior
- Click-toggle menus (not hover)
- Outside-click closes all menus
- Route change closes all menus
- Screener submenu opens to the right of Products
- Auth gate for protected routes (simulation, portfolio, live-market)

---

## 10. Responsive Design

| Breakpoint | Layout |
|-----------|--------|
| Desktop (md+) | Full table with sticky header, grid columns, virtualized |
| Mobile (<md) | Card list with avatar + symbol + price + change% + marketCap |

Both use `react-virtuoso` for virtual scrolling with infinite load.
