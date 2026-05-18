# Screener Data Contract

## Purpose

Define the canonical backend fields, provider lineage, formatting rules, nullability, and update cadence for every user-facing screener column.

Current reality:

- The live simplified screener-service maps a subset of columns directly from `cleanassets`
- Several client-side expectations already exist in the fallback metadata and frontend contracts
- The contract below is the target promotion contract for restored parity and scale-up

## Must-Have Minimum Row Contract

Every promoted screener row must include:

- symbol
- fullSymbol
- name
- assetType / type
- exchange
- country
- currency where applicable
- logo reference and quality band
- price or explicit non-quote applicability flag
- screener key-fields availability flag

## Column Contract

| Column | Backend Field | Source / Provider | Transform | Nullability | Update Cadence | Class |
|---|---|---|---|---|---|---|
| Symbol | `symbol` | canonical listing record | uppercase symbol | never null | listing refresh | must-have |
| Full symbol | `fullSymbol` | canonical listing record | `EXCHANGE:SYMBOL` normalized | never null | listing refresh | must-have |
| Name | `name` | canonical listing record | trimmed display name | never null | listing refresh | must-have |
| Exchange | `exchange` | canonical listing record | uppercase exchange code | never null | listing refresh | must-have |
| Country | `country` | canonical listing record | ISO country code | never null | listing refresh | must-have |
| Currency | `currency` | canonical listing record | ISO currency code | nullable only for non-price assets | listing refresh | must-have |
| Price | `currentPrice` -> `price` | quote feed / Yahoo chart fallback | numeric display price | nullable only if quote truly unavailable or not applicable | intraday / EOD | must-have |
| Change | `change` or derived from `price - previousClose` | quote feed | numeric delta | nullable if previous close unavailable | intraday / EOD | must-have |
| Change % | `changePercent` or derived | quote feed | percentage x100 | nullable if previous close unavailable | intraday / EOD | must-have |
| Volume | `volume` | quote feed | raw numeric | nullable for non-volume assets | intraday / EOD | must-have |
| Rel Volume | derived from `volume / avgVolume` | quote + average volume feed | computed numeric | nullable if avg volume missing | daily / intraday | optional |
| Market cap | `marketCap` | fundamentals / shares x price | raw numeric | nullable only when unavailable | daily | must-have |
| P/E | `pe` | fundamentals | raw numeric | nullable if EPS unavailable or invalid | daily | must-have |
| EPS dil TTM | `eps` -> `epsDilTtm` | fundamentals | direct alias | nullable if unavailable | daily | must-have |
| EPS dil growth | `earningsGrowth` -> `epsDilGrowth` | fundamentals | percentage normalization | nullable if unavailable | daily / weekly | optional |
| Div yield % | `dividendYield` -> `divYieldPercent` | fundamentals | normalize to percent display contract | nullable if non-dividend payer | daily / weekly | optional |
| Sector | `sector` | normalized issuer metadata | title-case category | nullable for unclassified assets | listing refresh / enrichment | must-have |
| Analyst rating | `analystRating` | provider / derived mapping | normalized ladder value | nullable if unavailable | daily / weekly | optional |
| Perf % | `perfPercent` | derived from price history | time-window specific return | nullable until history available | intraday / daily | optional |
| Revenue growth | `revenueGrowth` | fundamentals | percentage normalization | nullable if unavailable | quarterly / daily cache | optional |
| PEG | `peg` | fundamentals / derived | numeric | nullable if growth unavailable | daily | optional |
| ROE | `roe` | fundamentals | percentage normalization | nullable if unavailable | quarterly / daily cache | optional |
| Beta | `beta` | fundamentals / risk feed | numeric | nullable if unavailable | weekly / monthly | optional |
| Recent earnings date | `recentEarningsDate` | calendar / fundamentals | ISO date | nullable if unavailable | daily | optional |
| Upcoming earnings date | `upcomingEarningsDate` | calendar / provider | ISO date | nullable if unavailable | daily | optional |
| Net income | `netIncome` | fundamentals | raw numeric | nullable if unavailable | quarterly / daily cache | optional |
| Revenue | `revenue` | fundamentals | raw numeric | nullable if unavailable | quarterly / daily cache | optional |
| Shares float | `sharesFloat` | fundamentals | raw numeric | nullable if unavailable | weekly / monthly | optional |
| Logo path | `iconUrl` / `s3Icon` | logo-service / CDN | resolved URL | never null for stocks and ETFs after promotion | daily audit | must-have |
| Logo quality band | `logoConfidence` / derived band | logo audit | high/medium/low/fallback | never null | daily audit | must-have |

## Nullability Rules

- `—` may appear only when the upstream provider truly lacks the field or the asset class does not support it.
- Frontend mapping failures must never produce `—`.
- Cache staleness must not zero-out existing values.
- For priority India and US stocks and ETFs, `price`, `marketCap`, `pe`, `epsDilTtm`, `sector`, and logo reference are required for promotion into premium screener cohorts.

## Backend Mapping Rules

- Frontend key `price` maps to backend `currentPrice`
- Frontend key `epsDilTtm` maps to backend `eps`
- Frontend key `epsDilGrowth` maps to backend `earningsGrowth`
- Frontend key `divYieldPercent` maps to backend `dividendYield`
- `change` and `changePercent` are derived if absent but `previousClose` exists
- `relVolume` is derived only when both `volume` and `avgVolume` are valid

## Contract Compliance Metrics

Track these per asset class, country, and exchange:

- coverage percentage per column
- null-rate per column
- source-provider population share
- mapping error count
- stale-cache mismatch count

## Promotion Rule

No ingestion wave is promoted to the main screener unless the must-have set passes the cohort threshold for that wave.