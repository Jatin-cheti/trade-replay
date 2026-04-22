## Summary
Full Symbol Page redesign with premium UI/UX, chart improvements, snapshot export, saved time periods, upcoming earnings, extended about section, sticky sub-header, and market icons.

## What changed
- Premium responsive layout across all breakpoints (mobile → ultrawide)
- Chart type dropdown with live switching
- Snapshot menu: download, copy image, copy link, open in new tab, tweet
- Custom range picker: date / time / datetime modes with validation
- Saved periods: create, edit, delete, select with persistence
- Quick period chips with active state and performance %
- Upcoming Earnings section: next report date, period, EPS, revenue estimate
- About section: industry, CEO, HQ, founded, IPO date, identifiers, CFI code
- HelpTooltip (?) on all financial data labels
- Sticky sub-header on scroll with hero intersection
- MarketClosedIcon + PrimaryListingIcon with full accessibility
- FAQ always-visible minimum items
- Full ARIA + keyboard nav across all new components
- Lint / bundle hardening: added lint script, fixed 43 lint issues, implemented code-splitting with manualChunks + React.lazy

## Validation
| Check | Result |
|---|---|
| lint | ✅ 0 errors / 0 warnings |
| typecheck | ✅ 0 errors |
| build | ✅ main chunk 251 KB (−86% from 1,775 KB) |
| symbol-page e2e (desktop-1920) | ✅ 24/24 |

## Bundle reduction
- Before: 1,775 KB main chunk
- After: 251 KB main chunk + vendor splits
  - vendor-motion 128 KB, vendor-router 155 KB, vendor-radix 104 KB
  - vendor-date 45 KB, vendor-lucide 45 KB, vendor-query 36 KB

## ESLint pragma cleanup
- 7 pragmas removed via proper typing (tailwind ESM import, type aliases for shadcn empty-interface extends, `LucideIcon` for icon maps, `SavedScreen` type, `Record<string, unknown>` for dev diagnostics)
- 9 pragmas narrowed from file-level to line-level with TODO comments
- 3 kept file-level with documented rationale (multi-line exports / 10 const-typed icon exports)

## Known remaining e2e failures (addressed in follow-up commits on this PR)
- screener ETF tests (3): were failing due to empty in-memory DB — fixed with static ETF fixtures
- simulation-flow: was failing due to missing candle/chart endpoint mocks — fixed by extending Playwright mocks
- mobile WebKit tool-rail: pre-existing Safari-specific CSS/timing issues — investigated and improved

## Secrets / credentials
- ✅ No .env, keys, tokens, or secrets in changeset
- ✅ .gitignore correctly excludes all secret file patterns
- ✅ packages/tradereplay-charts/package-lock.json not included

## Deployment
Run from a machine with SSH access to the DigitalOcean droplet:
```bash
./deploy/deploy.sh <droplet-ip> chart-surgical-recovery jatin
```
