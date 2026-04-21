# Fix Task Queue — Loop 2

Auto-generated from every non-PASS row in `requirement_traceability_matrix.md`.

| Task ID | Req ID | Priority | Description | Root Cause | Assigned Phase | Status | Next Action |
|---|---|---|---|---|---|---|---|
| FIX-001 | 2M-001 | P0 | Grow active symbol count from 1,579,751 → 2,000,000 (+420 K). | No options-chain or global-MF ingestion yet. | Phase 3 (Ingestion) | IN PROGRESS (US wave 2 running ~147/min) | Launch NSE F&O chain wave + Yahoo options for US top 200 tickers. |
| FIX-002 | 2M-002 | P0 | Grow IN stock count from 2,965 → 800,000. | Only NSE equity main-board ingested. | Phase 3 | NOT STARTED | Ingest NSE F&O, BSE SME, mutual funds via AMFI. |
| FIX-003 | 2M-003 | P1 | Grow US stock count from 34,803 → 200,000. | Options/warrants/preferreds not ingested. | Phase 3 | NOT STARTED | Polygon or FMP universe list for options underliers. |
| FIX-004 | DATA-004 | P1 | Re-run India enrichment on 632 regressed symbols with audit pipeline. | v2 used simple null-guard, not `mergeFieldWithAudit`. | Phase 4 | NOT STARTED | Port `enrich-india-yahoo-v2.cjs` → v3 using `scripts/lib/merge-field-audit.cjs`. |
| FIX-005 | LOGO-002 | P2 | `<LogoAvatar>` wrapper emitting `srcset` 1×/2× for Retina. | DB has sz=256 already but DOM serves single-src. | Phase 7 | NOT STARTED | Create `frontend/components/ui/LogoAvatar.tsx` wrapping AssetAvatar; migrate 30 call sites in follow-up PR. |
| FIX-006 | SYM-002 | P0 | Replace synthetic OHLC in `/api/chart/candles` with real datafeed. | Chart service ships mock generator (`open:100+offset, volume:1834`). | Phase Infra | BLOCKED | Decide provider (Polygon paid / Alpha Vantage free 5 rpm / Yahoo chart scrape) and wire into `services/chart-service/`. |
| FIX-007 | UI-002 | P3 | Centralised design-token CSS / TS file. | Magic numbers scattered across stylesheets. | Phase 7 | NOT STARTED | Extract spacing/radius/type-scale into `frontend/styles/tokens.css`. |
| FIX-008 | UI-003 | P2 | LogoAvatar component (duplicate of FIX-005 consolidation). | — | Phase 7 | NOT STARTED | Combine with FIX-005. |
| FIX-009 | UI-004 | P3 | Chart snapshot-to-PNG menu. | — | Phase 7 | NOT STARTED | Use `html2canvas` (already in deps) on chart container. |
| FIX-010 | TEST-002 | P2 | 30 × 8 Playwright matrix. | No Playwright browsers installed in current shell. | Phase 11 | BLOCKED | Run in CI image with `playwright install` pre-baked; stub suites at `e2e/`. |
| FIX-011 | SEC-002 | P2 | Install + run `gitleaks` in 4 stages. | Binary not present locally. | Phase 9 | BLOCKED | Add `gitleaks` to deploy image; integrate into GitHub Actions. |
| FIX-012 | PERF-001 | P2 | Lighthouse ≥ 90 audit. | Needs deployed build. | Phase 10 | BLOCKED | Run via `npx @lhci/cli autorun` in deploy pipeline. |

**Rule:** Every FAIL or PARTIAL row in the matrix maps to exactly one FIX-xxx here. Adding a new regression auto-appends a new row.
