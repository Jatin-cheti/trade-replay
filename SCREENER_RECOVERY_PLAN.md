# Screener Recovery Plan

## Objective

Restore screener functionality to previous parity or better, then harden it for scale-up.

## Current Production Snapshot

- Simplified screener-service is active in production
- Search compatibility for both `q` and `query` has been fixed
- India dedup and `change/changePercent` computation are restored
- Live service currently exposes only 5 tabs and 10 filter fields from `/screener/meta`
- Frontend contract and fallback metadata already define a richer surface with 18+ filters and 8 tabs
- Normal UI still contains misleading total-universe language

## Regression Audit Scope

Git forensic tasks:

1. Compare the simplified `services/screener-service` against the richer `backend/src/services/screener` implementation and previous docs
2. Map every UI control to query param, controller validation, service logic, cache key, and Mongo field
3. Identify which filters were removed entirely versus hidden by metadata regression

## Recovery Workstreams

### 1. Metadata Parity

- Expand `/screener/meta` to match the frontend contract shape
- Restore at least these filters for live use:
  - marketCountries
  - exchanges
  - watchlists
  - indices
  - primaryListingOnly
  - price
  - changePercent
  - volume
  - relVolume
  - marketCap
  - pe
  - peg
  - epsDilTtm
  - epsDilGrowth
  - divYieldPercent
  - sector
  - analystRating
  - perfPercent
  - revenueGrowth
  - roe
  - beta
  - recentEarningsDate
  - upcomingEarningsDate

### 2. Query and Filter Correctness

- Fix key mismatches between `sector` and `sectors`, plus other multi-filter naming contracts
- Support `q` and `query`
- Define and enforce null-sort behavior consistently
- Ensure country filtering is explicit and stable with URL state

### 3. Count Semantics

- Remove misleading “Showing X of Y total symbols” copy for standard users
- Show only result count in normal mode
- Keep global totals only for admin/debug flag paths

### 4. Data Completeness

- Extend completeness audits by country and asset class
- Fix columns that are empty due to mapping or stale cache
- Ensure priority cohorts do not show blanket `—`

### 5. UX and Responsiveness

- Keep sticky header, infinite load, and URL-synced filters
- Improve mobile/tablet filter interaction and desktop density

## Acceptance Matrix

Each permutation must pass in local dev, local prod build, and production:

- single filter
- multi-filter
- filter + sort
- filter + search
- filter + country
- filter + pagination
- clear/reset all
- back/forward navigation

## Immediate Recovery Priorities

1. Restore accurate meta contract and exposed filter set
2. Remove misleading totals from normal UI
3. Add automated screener E2E coverage because there are currently no dedicated screener E2E specs in the active test tree
4. Normalize type taxonomy in stats and list paths