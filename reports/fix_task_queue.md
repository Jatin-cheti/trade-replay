# Fix Task Queue — Loop 3 → Loop 4

| Task     | Req ID         | Priority | Status    | Action                                                                                  |
|----------|----------------|----------|-----------|-----------------------------------------------------------------------------------------|
| FIX-001  | IND-001        | P0       | OPEN      | Ingest NSE main-board (+~1,900) via `scripts/expand-nse-main.cjs`                       |
| FIX-002  | IND-002        | P0       | OPEN      | Ingest BSE main-board (~5,500) from BSE security master CSV                             |
| FIX-003  | 2M-001/2/3     | P1       | IN PROG   | Continue US wave 2 (Yahoo) and add CA/AU/HK/JP region sweeps                            |
| FIX-004  | SYM-002 / CHART-001..005 | P0 | **DONE**  | Yahoo data source wired; 21/21 cohort PASS                                              |
| FIX-005  | LOGO-002 / LOGO-005 | P1  | **DONE**  | `AssetAvatar.tsx` emits `srcset`; 8/8 unit tests                                        |
| FIX-006  | DATA-004       | P1       | OPEN      | Verify symbol-page parallel fetch; write trace to `reports/symbol_page_waterfall.md`    |
| FIX-007  | UI-002         | P1       | OPEN      | Define design tokens; grep for hardcoded hex/px; replace                                |
| FIX-008  | UI-003         | P1       | OPEN      | Sticky sub-header uses `var(--navbar-height)` offset                                    |
| FIX-009  | UI-004         | P1       | OPEN      | Icon registry audit (no emoji in production UI)                                         |
| FIX-010  | TEST-002/003   | P1       | BLOCKED   | Playwright via Dockerised CI with full browser deps                                     |
| FIX-011  | SEC-002        | P1       | PARTIAL   | gitleaks installed; Loop 4: rotate historical `REDACTED_AV_KEY_LOOP4…` key + filter-repo     |
| FIX-012  | PERF-001/002   | P2       | BLOCKED   | Lighthouse via same Dockerised CI as FIX-010                                            |
| FIX-013  | IND-004        | P0       | **DONE**  | Root cause: "2,965" was stock-only slice; true in_total=80,551                          |
| FIX-014  | IND-005        | P1       | OPEN      | Run `enrich-india-yahoo-v3.cjs` routed through `mergeFieldWithAudit`                    |
| FIX-015  | SCR-002        | P1       | OPEN      | Full 20-scenario × 8-viewport screener matrix (post Playwright unblock)                 |
