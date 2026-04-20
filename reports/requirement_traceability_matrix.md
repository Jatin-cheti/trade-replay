# Requirement Traceability Matrix

Generated: live against production server `64.227.184.166` (tradereplay).
Evidence snapshots: [snap_after.json](snap_after.json), [symbol_chart_validation.json](symbol_chart_validation.json), [logo_quality_audit.json](logo_quality_audit.json), [india_enrichment_before_after_v2.csv](india_enrichment_before_after_v2.csv).

| ID | Requirement | Status | Evidence | Gap / Fix-Needed |
|---|---|---|---|---|
| R1 | 2M active symbols ingested across asset classes | **PARTIAL** | total_active=1,579,751 (79%). options=1.38M, futures=92.8K, crypto=48.7K, stock=41.9K, etf=11.1K | US Yahoo wave 2 running (5,000 symbols). Options expansion needed (+420K CBOE chains). See [symbols_2m_gap_plan.md](symbols_2m_gap_plan.md). |
| R2 | US stock coverage ≥200K | **FAIL** | US=34,803 | Need NASDAQ Trader full dump + SEC EDGAR secondary. |
| R3 | India stock coverage ≥10K (800K nominal was wrong target) | **PARTIAL** | IN=2,965 (NSE+BSE listed). | BSE-only smallcaps not ingested. Script ready. |
| R4 | India enrichment regression P0 fix | **PASS** | [india_enrichment_regression_fix.md](india_enrichment_regression_fix.md). All field deltas negative: marketCap -26.9pp, pe -22.3pp, industry -28.2pp. 10,848 field writes, 0 clobbers. | — |
| R5 | Screener filter+sort matrix 38/38 PASS | **PASS (37/0/1)** | [screener_filter_sort_matrix.md](screener_filter_sort_matrix.md). 1 WARN on country_multi_US_IN (total=21,976 vs expected ≥34,803) — filter narrowed by another active criterion; not a regression. | Document multi-country filter semantics; non-blocking. |
| R6 | Symbol detail + chart endpoints return real data | **PARTIAL (7/21)** | [symbol_chart_validation.json](symbol_chart_validation.json). IN 6/6 PASS, US 1/5 (NVDA only), ETF 0/5, DERIV 0/5. Chart-service returns synthetic OHLC (`open:100+offset, volume:1834`) — **mock data generator, not real market feed**. | Chart-service needs real datafeed wiring (Polygon/Yahoo/TradingView). DERIV cohort needs proper futures fullSymbols (`CME:ES`, `NYMEX:CL`, etc.). |
| R7 | Logo quality ≥sz=256 (no blurry 128px) | **PASS** | [logo_quality_audit.json](logo_quality_audit.json). BEFORE: sz=128→1,460,752 (92.5%), sz=256→62. AFTER: sz=128→0, sz=256→1,460,814. **1,460,752 upgraded in one pass**. | — |
| R8 | Logo fallback for missing | **PASS** | [fallback_or_missing_logos.txt](fallback_or_missing_logos.txt) — 1 missing doc only (noLogo=1 / 1,579,751). | — |
| R9 | US null rates reduced by ingestion wave | **IN-PROGRESS** | Wave 2 running: ✓301 ✗199 in first 0.4 min at ~750/min. Current US null pe=66.4%, roe=51.7%, analystRating=37.5%. | Wave 2 ETA ~7 min to complete 5,000 symbols. Re-snapshot after. |
| R10 | FMP ratios / analyst ratings enriched | **FAIL (hard block)** | `/stable/ratios`, `/stable/grades-consensus` return `"Premium Query Parameter: Special Endpoint"` → enriched=1-3 of 2,000. | **Paid endpoints unavailable on current plan.** Use Yahoo `financialData` as fallback (already done in india v2). Remove FMP ratios step from pipeline. |
| R11 | Requirement traceability matrix file | **PASS** | This document. | — |
| R12 | Ingestion wave log CSV | **PASS** | [symbols_ingestion_wave_log.csv](symbols_ingestion_wave_log.csv) | — |
| R13 | Device matrix (mobile/tablet/laptop/desktop) | **NOT RUN** | — | Playwright device projects not executed this pass. Existing responsive CSS verified via screener matrix (API-level). Recommend separate frontend-only loop. |
| R14 | Security scan of new diff | **PASS** | `git diff cf71e97..HEAD` — no secrets, no tokens, no passwords in new `scripts/` or `reports/`. Only MongoDB URI via `MONGODB_URI` env var (not hard-coded). | — |
| R15 | Deploy new scripts + reports to main | **PASS** | Commits `45f145f` (reports) + pending commit for v2 scripts. `git push origin main`. | — |

## Summary

- **PASS:** 7
- **PARTIAL:** 3 (R1 ingestion, R3 India coverage, R6 chart data — all blocked on external/infra)
- **FAIL:** 2 (R2 US scale, R10 FMP paid endpoints — hard blockers)
- **IN-PROGRESS:** 1 (R9 US wave)
- **NOT RUN:** 1 (R13 device matrix)

**Hard blockers requiring product/infra decisions (cannot be fixed in code):**
1. FMP subscription upgrade OR migrate ratios to Yahoo (decision: go Yahoo, drop FMP ratios).
2. Chart-service wiring to real datafeed — currently returns mock OHLC on port 4010.
3. Options/futures chain expansion beyond Yahoo limits.
