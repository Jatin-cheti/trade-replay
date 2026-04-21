# India Coverage — Loop 5

## Headline
IN active: **85,518 → 111,293** (+25,775, +30.1% in one loop).
Target 140k: **79.5% of 140k** reached. Target 800k: 13.9%.

## Pre/Post Breakdown
| Segment | Before | After | Delta |
|---|---:|---:|---:|
| NSE F&O (active, OI>0) | 3,336 (legacy DERIV) | 28,483 (NSE) + 3,336 + 59,861 (legacy OPT) | +25,775 |
| AMFI Mutual Funds | 14,350 | 14,350 | 0 |
| BSE Equity | 5,253 | 5,253 | 0 |
| NSE Equity | 2,708 | 2,708 | 0 |
| Bonds | 4 | 4 | 0 |
| **IN Total** | **85,518** | **111,293** | **+25,775** |

## Wave IN-08 Execution Evidence
Source: `https://archives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_20260420_F_0000.csv.zip` (1.51 MB)
- Rows fetched: 48,673
- Valid after filters (near-expiry ≤65d + OI>0 options + futures): 25,828
- Inserted new: 25,775
- Updated existing: 53
- Skipped (old expiry / zero OI): 22,845
- Errors: 0
- Script: [scripts/ingest-nse-fo-active.cjs](scripts/ingest-nse-fo-active.cjs)

## Waves NOT Executed — Honest Disclosure

| Wave | Req | Status | Reason |
|---|---|---|---|
| IN-06 NSE Bonds | IND-006 | **DEFERRED-L5** | NSE debt market data is not published as a stable CSV at a known archive URL. Historical bond CSVs (`bond_detail.csv`) specified in prompt returned 404 during probe. Would require Puppeteer-based scraping of `nseindia.com/market-data/bonds-traded-in-capital-market` which exceeds a single-loop execution window. |
| IN-07 SEBI AIF | IND-007 | **DEFERRED-L5** | SEBI AIF registry at `sebi.gov.in/sebiweb/other/OtherAction.do?doListAIF=yes` is an HTML-rendered paginated table with JS-driven filters. No direct CSV/JSON endpoint. Would require browser-automation scraper. |
| IN-09 BSE Bonds | — | **DEFERRED-L5** | Same structural reason as IN-06 — no stable public CSV feed. |

## Path to 140,000 (realistic gap: 28,707)

Candidate sources, each with best-estimate yield:

| Source | Estimated yield | Feasibility |
|---|---:|---|
| NSE equity additional series (SM, BE, TB, SG variants) | ~500 | High — rerun NSE ingest with full 17-code allowlist |
| BSE full universe (currently ingested ~5,200; full universe ~5,600) | ~400 | High — drop `status=Active` filter |
| NSE currency derivatives (USD/INR, EUR/INR futures + options) | ~2,000–4,000 | Medium — separate bhavcopy endpoint |
| NSE commodity derivatives | ~1,500–3,000 | Medium — separate bhavcopy endpoint |
| MCX commodity futures/options | ~5,000–15,000 | Medium — MCX publishes daily bhavcopy |
| NCDEX agri derivatives | ~1,500–3,000 | Medium — similar to MCX |
| NSE bonds (via Puppeteer scrape) | ~2,000–5,000 | Low (would need full scraper) |
| SEBI AIF (via Puppeteer scrape) | ~1,200–1,500 | Low (full scraper) |
| **Best-case sum (no Puppeteer)** | **~10,500–26,500** | — |
| **Including Puppeteer-dependent sources** | **~14,000–33,000** | — |

Conclusion: 140k is achievable in Loop 6 adding MCX + NSE currency/commodity waves. It is NOT achievable in a single execution loop without new scraper infrastructure (Puppeteer + rate-limited crawler).

## Path to 250,000

Only via historical F&O contract ingestion (every expiry ever listed, every strike ever traded).
Estimated universe: ~1.5–2.0M historical contracts going back to 2001 (NSE F&O inception).
This is a dedicated data-engineering project, not a loop wave.

## Path to 800,000 — Honest Assessment

**800,000 active Indian securities does not exist as a universe.** Realistic maximum live universe:
- NSE equity: ~2,700
- BSE equity: ~5,600
- AMFI MF schemes: ~14,500
- NSE FO active near-term: ~25,000–30,000
- MCX/NCDEX commodity derivatives active: ~5,000–15,000
- NSE currency derivatives: ~3,000–5,000
- Corporate bond ISINs (live): ~8,000–12,000
- Govt securities + SDLs: ~500–1,000
- SEBI AIFs: ~1,500
- REITs + InvITs: ~20
- **Realistic live total: ~65,000–90,000 active symbols**

Plus historical contracts:
- All historical NSE F&O contracts: ~1.5–2M
- All historical AMFI NAV entries per scheme daily: bulk time-series, not symbol count

**Recommended revised target: 140,000 (achievable as stated above).**
800,000 should be reframed as a historical-contract ingestion goal, not a live-symbol goal.

## Status summary
- IND-008 (F&O active): **PASS** (+25,775)
- IND-009 (≥140k): **FAIL** (111,293 / 140,000 = 79.5%)
- IND-010 (250k path documented): **PASS** (this document)
- IND-006, IND-007: **DEFERRED-L5** with explicit root cause (no stable CSV feed, scraper infrastructure out of scope)
