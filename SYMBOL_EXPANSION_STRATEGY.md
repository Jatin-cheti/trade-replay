# Symbol Expansion Strategy

## Objective

Reach at least 2,000,000 unique, deduped symbols without mass-ingesting empty shells.

Current production baseline as of 2026-04-21:

- Total documents exposed by screener stats: 1,579,758
- India stocks exposed in restored screener path: 2,517
- US stocks exposed in restored screener path: 34,803
- Type taxonomy is inconsistent today: both singular and plural type labels appear in production stats and must be normalized before declaring 2M unique symbols complete.

## Expansion Principles

- No wave proceeds without completeness, dedup, and logo quality gates.
- The canonical record is issuer-aware, not symbol-string-only.
- Regional scale is staged by liquidity and metadata completeness, not just raw count.
- Search-miss ingest is allowed only for minimum viable records that satisfy the data contract.

## Canonical Dedup Key

Primary identity key:

- symbol
- exchange
- assetType
- canonical issuer key

Canonical issuer key preference order:

1. ISIN
2. CIK
3. LEI
4. FIGI / Composite FIGI
5. Provider issuer id
6. Normalized issuer name + country + exchange fallback

Listing preference rules:

1. Preferred primary listing when `isPrimaryListing=true`
2. If multiple Indian listings exist, prefer NSE over BSE for default screener display
3. If US dual records exist, prefer NYSE or NASDAQ primary listing over OTC and synthetic variants
4. Derivatives, CFDs, warrants, and synthetics must not collapse into the underlying equity issuer row

## Source Provider Strategy

### Stocks and ETFs

- Core identity and exchange metadata: existing cleanassets feed + exchange/provider snapshots
- Quote and market data: current normalized quote pipeline
- Fundamentals: existing cleanassets fields, FMP where available, Yahoo chart API only for quote-adjacent fallback, other provider fallback to be added per market
- Logo/domain enrichment: current logo-service chain with domain inference + curated overrides

### Options and Futures

- Keep current high-volume derivatives universe but normalize type taxonomy and completeness flags
- Separate contract-level identity from underlying issuer identity

### Crypto

- Continue existing CoinGecko-style identity model
- Add contract-address-based canonical keys where available

### Forex, Indices, Bonds, Economy

- Retain current universe but mark lower completeness expectations explicitly in the contract
- Do not let these categories inflate perceived equity-quality coverage metrics

## Regional Allocation Plan

| Region / Market | Target Symbols | Priority | Notes |
|---|---:|---|---|
| India | 800,000 | Wave 1 | Equities, ETFs, SME, funds, debt instruments only if completeness contract satisfied |
| United States | 200,000 | Wave 1 | Listed equities, ETFs, ADRs, major funds, preferreds with issuer linkage |
| EU | 250,000 | Wave 2 | Germany, France, Netherlands, Nordics, pan-EU ETPs |
| UK | 120,000 | Wave 2 | LSE main market + AIM + ETFs |
| Japan | 120,000 | Wave 2 | TSE prime/standard/growth plus funds |
| HK | 80,000 | Wave 2 | HKEX main board + ETFs |
| SG | 40,000 | Wave 2 | SGX equities + ETFs + REITs |
| AU | 80,000 | Wave 2 | ASX equities + ETFs + trusts |
| CA | 80,000 | Wave 2 | TSX + TSXV |
| Middle East | 60,000 | Wave 3 | UAE, Saudi, Qatar, Kuwait |
| LATAM | 80,000 | Wave 3 | Brazil, Mexico, Chile, Colombia, Peru |
| Africa | 40,000 | Wave 3 | South Africa, Egypt, Nigeria, Kenya |
| Other | 50,000 | Wave 3 | Remaining major exchanges |

Total target plan: 2,000,000+

## Ingestion Modes

### 1. Full Backfill

- Used only after a region-specific schema mapping and null-rate threshold definition exists
- Writes to staging collections first
- Requires dedup + completeness + logo audit before promotion

### 2. Incremental Refresh

- Daily listing refresh for active universes
- Intraday quote refresh for liquid cohorts
- Slower cadence for fundamentals depending on provider cost and market calendar

### 3. Search-Miss On-Demand Ingest

- Resolver returns minimum viable row immediately
- Insert only if minimum contract fields are available
- Queue asynchronous enrichment for fundamentals, logo quality, and canonical issuer links

## Freshness Schedules

| Data Class | Cadence |
|---|---|
| Quotes / previous close | intraday for liquid markets, end-of-day fallback otherwise |
| Fundamentals | daily to weekly by provider and market |
| Listing metadata | daily |
| Logo quality audit | daily rolling audit for top cohorts, weekly long tail |
| Search negative cache | 5 to 30 minutes depending on provider errors |

## Quality Gates Per Wave

Wave gate must pass all of the following:

- Dedup audit complete with documented key strategy
- Schema validation pass on staged records
- Null-rate audit pass on must-have columns
- Logo audit pass on required cohorts
- Search/sort/filter latency within budget
- Rollback plan documented

Suggested thresholds for progression:

- Identity fields present on 100% of promoted rows
- Country, exchange, assetType, issuer/name present on at least 99.5%
- Logo reference present on at least 99% of promoted stock and ETF rows
- Core quote coverage on applicable liquid assets at least 95%
- Core screener fundamentals for priority India and US cohorts at least 85%

## Immediate Gaps Blocking 2M Declaration

- Mixed type taxonomy in production stats
- No verified 2M deduped unique-symbol count yet
- Screener parity and completeness still below requested platform standard
- Search-miss architecture is not yet fully implemented end to end
- Logo quality metrics exist, but render-quality enforcement is not yet fully verified across screener and symbol page