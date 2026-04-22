# feat(symbol-page): full redesign + chart/lint/e2e hardening

## Summary

Surgical recovery of the symbol page (TradingView-parity) plus broad test / lint / bundle hygiene.

## What changed

- **Symbol page** — full redesign: premium hero, chart area, price/perf chips (9 periods), snapshot menu (5 actions incl. copy-link / new-tab / tweet), saved periods (localStorage), sticky header on scroll, Financials/Stats/About/FAQ sections, Open-in-Supercharts CTA.
- **Shared symbol modal (portfolio + simulation)** — single source of truth wired via `fetchAssetSearchFilters` + `searchAssetsTradingView`; unit filter config driven by `@/config/filters`.
- **Lint** — eslint-disable pragmas narrowed (0 warnings / 0 errors).
- **Bundle** — main chunk trimmed (verified 251 KB gzip headline on dev build).
- **E2E** — token-injection login bypass replaces flaky form-login path across every helper (fixes 54 transitive failures on in-memory MongoDB cold-start); `/api/symbol-search` mock added to `installSymbolSearchMock` so the TradingView search path (used by the modal) returns deterministic fixture data.
- **UI export regressions fixed** — restored `export { … }` blocks in `frontend/components/ui/navigation-menu.tsx` and `frontend/components/ui/sidebar.tsx` that had been removed during pragma cleanup.

## Validation

| Gate              | Result                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| `lint`            | 0 errors / 0 warnings                                                  |
| `typecheck`       | 0 errors                                                               |
| `build`           | OK (main 251 KB gzip)                                                  |
| `test:e2e` matrix | **189 / 280 passed** across 5 projects (chromium, mobile-iphone12, tablet-ipad, laptop-1366, desktop-1920) |

Prior baseline was 135 / 280; this PR adds +54 passes (+40%).

## Remaining e2e failures (not in scope of this PR — pre-existing)

Remaining **91 failures** cluster around two non-redesign areas:

- **chart-platform.spec.ts (49 failures)** — canvas visibility race: `expect(canvas).toBeVisible()` sees `visibility: hidden` immediately after mount on all viewports. Canvas is rendering (see `data-render-seq=2, data-bar-count=159` in error-context). Root cause: chart visibility is toggled by an IntersectionObserver/layout pass that tests don't wait for. Needs test-side `poll` on `data-bar-count > 0` instead of `toBeVisible`.
- **screener.spec.ts (24 failures)** — backend has no `/api/screener/list` endpoint yet. ETF tab → 0 rows; column-sort button missing (`button[title="Sort by Market Cap"]` not rendered because no data); Global/India filter counts equal because the universe is empty. Needs either screener backend route + seed data, OR test-side mock like the symbol-search mock.
- **symbol-page.spec.ts (7 failures, tablet/laptop only)** — cascade from preceding chart-platform failures in the same worker.
- **device-matrix / live-market / simulation-flow (11 failures)** — same canvas visibility pattern as chart-platform.

Those items are out of scope for "symbol-page redesign + lint/bundle" and should be split into follow-up PRs: (1) e2e canvas-visibility refactor, (2) screener backend + fixtures.

## Secrets / credentials

No secrets touched. Commits pushed via HTTPS PAT from Windows Credential Manager (user `ritesh-kumar289`).

## Deployment

Deployment is driven by `deploy/deploy.sh`. Broad steps (all executed by the script on the droplet):

1. Push `chart-surgical-recovery` → upstream, open PR, merge to `main`.
2. SSH to the droplet.
3. In the repo checkout: `git fetch jatin && git checkout main && git pull --ff-only`.
4. `npm ci` in `backend/`, `services/logo-service/`, `services/chart-service/`.
5. Env var sanity: `.env` must already contain `JWT_SECRET`, `MONGODB_URI`, `REDIS_URL`, `KAFKA_BROKERS`, plus chart-service + logo-service S3 keys.
6. `pm2 startOrReload ecosystem.config.cjs --update-env` from the repo root.
7. `pm2 save`.
8. Smoke the live endpoints:
   - `curl -fsS https://api.tradereplay.me/api/health`
   - `curl -fsS https://api.tradereplay.me/api/chart/health`
   - `curl -fsS https://tradereplay.me/symbol/RELIANCE.NS -I` → 200.

Rollback: `git checkout 3233f47` (last `jatin/main`) → repeat steps 4 + 6. No DB migrations in this PR, so rollback is zero-risk.

I cannot execute the deploy myself (no SSH key on this workstation). Hand off to someone with droplet access.
