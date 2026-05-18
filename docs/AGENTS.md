# Trade Replay — AI Agent Instructions

> Persistent project context. Read first on every session so the user does not have to re-explain.

## What this product is

**Trade Replay** is a TradingView-style market-replay + charting platform.

- **Production**: https://tradereplay.me
- **Frontend host**: Vercel (auto-deploy on push to `main` of remote `jatin`)
- **Repo root** (this workspace): `c:\Users\mohit\Desktop\trade-replay\harshit-repo`
- **Sibling repo** (legacy / reference, do NOT edit unless explicitly asked): `c:\Users\mohit\Desktop\trade-replay\trade-replay-custom-charts`

## CRITICAL: We build our OWN chart library

**We are NOT using `lightweight-charts`. We have our own chart engine.**

- Library package: `@tradereplay/charts` at [packages/tradereplay-charts/](packages/tradereplay-charts/)
- Engine entry: [packages/tradereplay-charts/src/lib/createChart.ts](packages/tradereplay-charts/src/lib/createChart.ts) (~3900 lines, canvas2D)
- Public API surface: [packages/tradereplay-charts/src/index.ts](packages/tradereplay-charts/src/index.ts)
- Subdirs: `drawing/`, `indicators/`, `transforms/`, `utils/`, `lib/`

**Library philosophy**: it ships reusable primitives so external developers can build a TradingView-like app on top of it. Things like `createChart`, `addSeries`, `subscribeCrosshairMove`, transforms (Renko, Kagi, P&F, Brick, Range bars, Line break), drawing geometry, indicators registry, demo cursor, etc. are **library-level**. Anything that is one app's UI chrome (legends, tooltips, toolbars, modals) lives in the **host app**, not the engine.

When asked to add a chart-engine feature, prefer extending the library and exposing it via `index.ts`. When asked to change a tooltip / popover / panel, edit the host app.

The engine API mimics `lightweight-charts` shape (`IChartApi`, `ISeriesApi`, `subscribeCrosshairMove`, etc.) so prior `lightweight-charts` knowledge applies — but we own and modify the source.

## Repo layout

| Path | Role |
|------|------|
| [packages/tradereplay-charts/](packages/tradereplay-charts/) | Our charting library (`@tradereplay/charts`) — canvas2D engine, transforms, indicators, drawings |
| [frontend/](frontend/) | Vite + React 18 + TS app (Vercel-deployed). Consumes the chart library |
| [backend/](backend/) | Node + TS API. Mongo, Redis, Kafka |
| [services/chart-service/](services/chart-service/) | Microservice for chart data / replay |
| [services/datafeed-service/](services/datafeed-service/) | Live + historical market data |
| [services/logo-service/](services/logo-service/) | Symbol logo CDN (S3 + lifecycle) |
| [services/screener-service/](services/screener-service/) | Stock screener |
| [services/simulation-service/](services/simulation-service/) | Replay simulation |
| [services/alert-service/](services/alert-service/), [services/asset-service/](services/asset-service/), [services/portfolio-service/](services/portfolio-service/) | Self-explanatory |
| [services/shared/](services/shared/) | Shared service helpers |
| [e2e/](e2e/) | Playwright E2E specs |
| [deploy/](deploy/) | Droplet / nginx / cloud-init / TLS |
| [docs/](docs/) | ADRs, parity docs, chart roadmap |

Docker compose orchestrates the full stack; `npm run app` runs backend + chart-service + frontend concurrently for local dev.

## Key files (chart side)

- Library entry: [packages/tradereplay-charts/src/lib/createChart.ts](packages/tradereplay-charts/src/lib/createChart.ts)
- Library exports: [packages/tradereplay-charts/src/index.ts](packages/tradereplay-charts/src/index.ts)
- Host React component (giant): [frontend/components/chart/TradingChart.tsx](frontend/components/chart/TradingChart.tsx)
- Tool rail (left toolbar): [frontend/components/chart/ToolRail.tsx](frontend/components/chart/ToolRail.tsx)
- Top bar (chart-type/timeframe/indicator buttons): [frontend/components/chart/ChartTopBar.tsx](frontend/components/chart/ChartTopBar.tsx)
- Chart-type union + dropdown groups + labels: [frontend/services/chart/dataTransforms.ts](frontend/services/chart/dataTransforms.ts)
- Series creation + visibility map: [frontend/services/chart/seriesManager.ts](frontend/services/chart/seriesManager.ts)
- Tool registry: [frontend/services/tools/toolRegistry.ts](frontend/services/tools/toolRegistry.ts)
- Indicator catalog (right-hand modal): [frontend/services/indicators/indicatorCatalog.ts](frontend/services/indicators/indicatorCatalog.ts)
- Indicator picker UI: [frontend/components/chart/IndicatorsModal.tsx](frontend/components/chart/IndicatorsModal.tsx)

## Product rules / conventions

### Chart-type dropdown (TradingView parity)
- Restricted to **20 types** in 4 groups: Core / Advanced / Premium / Volume.
- Indicators (MA, EMA, VWAP, RSI, MACD, …) live in the **indicator picker**, never as chart types.
- Backtest analytics (equity curve, drawdown, monte carlo, returns histogram) and dashboard widgets (treemap, heatmap, donut, funnel, network graph, scatter, …) are **dedicated panels**, never chart types.
- The internal `ChartType` union, `chartTypeLabels`, and `seriesManager` renderers may still contain extra entries for backwards-compat with internal consumers (`ScreenerChartCard`, `SymbolMiniTradingChart`); they are intentionally not exposed in any picker.

### Tooling / cursor
- Cursor menu has a "Values tooltip on long press" toggle (mobile/touch). Behavior mirrors TradingView: 450 ms hold fires, finger drag updates a floating panel showing Date / OHLC / Volume / Change / Change % / cursor price; auto-flips to stay in viewport.

### 500-test factory (E2E)
- File: [e2e/tv-parity-500-factory.ts](e2e/tv-parity-500-factory.ts)
- Use `register500ToolSuite({ variant, testId, anchorCount?, commitMode?, selectionGeometry? })`.
- `family='fib'` tools (pitchforks, all channel variants) commit on a single drag with auto-anchor-fill — do **not** set `commitMode: 'click-sequence'` for them.

## Workflow

### Branch / deploy
- All work goes on `main`. Push to remote `jatin` triggers Vercel.
- **Always pull before push.** `git pull jatin main --rebase` then `git push jatin main`.
- **Never force-push.** Never `--no-verify`. Never amend published commits.
- Vercel build success = `<old>..<new>  main -> main`. PowerShell may show stderr noise → exit code 1 even on success; check the actual ref update line.

### Commits
- Conventional-commit style: `feat(chart): …`, `fix(engine): …`, `refactor(frontend): …`, `chore(e2e): …`.
- Multi-line commit messages: explain WHY, not just WHAT.

### Secrets / safety
- **NEVER commit credentials**, `.env*`, API keys, signing keys, droplet IPs in plain text, or anything from [deploy/env/](deploy/env/).
- Before staging, sanity-check with `git diff --staged` for `KEY=`, `SECRET=`, `TOKEN=`, `PASSWORD=`, `Bearer `, AWS access patterns.
- Public env vars only (e.g. Vite `VITE_*` prefixed for frontend) may be committed when they are non-sensitive.

### Windows / PowerShell quirks (this machine)
- Use `;` to chain, **not** `&&`.
- ripgrep is often missing → use `Get-ChildItem | Select-String` or the workspace `grep_search` tool.
- `$PID` is reserved — don't use as a loop variable.
- When working from `C:\Users\mohit\Desktop\trade-replay`, prefix npm with `npm.cmd --prefix harshit-repo <script>`.
- Async terminal sessions can drop a leading `Set-Location` — re-send the cd command if the next command fails to find files.

### E2E
- Configured in [e2e/playwright.config.ts](e2e/playwright.config.ts).
- For prod runs: `E2E_USE_EXTERNAL_STACK=true`, `E2E_TARGET_URL=https://tradereplay.me`, single worker, retries=1, chromium, timeout=120000.
- `npm run test:e2e` starts its own backend/frontend via Playwright `webServer` — kill any manually running `npm run app` first or you get port-in-use on `/api/health`.
- Matrix batching: [tests/tooling/run-matrix-batches.mjs](tests/tooling/run-matrix-batches.mjs) supports `MATRIX_RESET=0` and `MATRIX_START_AT=<batchName>` to resume.

### Charts: assertion strategy
- Prefer reading deterministic chart state via canvas dataset attributes over raw pixel-hash equality (live data drifts snapshots).

### Stale containers
- If Docker behaves oddly, stale `tradereplay-*` containers from the sibling repo can hijack ports `4000/4010/4011`. Remove conflicting containers and kill old Node dev servers before relaunching compose.

## Known gotchas

- `backdrop-filter` creates a containing block for `position: fixed` descendants in Chromium. Render fixed overlays via `createPortal(jsx, document.body)`. Portaled overlays may intercept pointer events; in Playwright, `page.keyboard.press('Escape')` or `page.evaluate(el => el.click())` to bypass hit-testing.

## Don't do these

- Don't add features beyond what was asked.
- Don't refactor adjacent code unless required.
- Don't add docstrings/comments/types to code you didn't change.
- Don't create `.md` files documenting changes unless the user asks.
- Don't push without pulling first.
- Don't push secrets. Ever.
