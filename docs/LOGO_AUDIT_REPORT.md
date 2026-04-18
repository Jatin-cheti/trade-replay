# Logo Audit Report

**Generated**: 2026-04-18  
**Source**: `scripts/logo-audit.cjs` run against production MongoDB

---

## Summary

| Metric | Value |
|--------|-------|
| Total Symbols | 1,587,158 |
| Total Clean Assets | 1,586,698 |
| Symbols with no `iconUrl` | 69 |
| Symbols with S3 icon | 529 |
| Completely missing logo | 69 |
| Logo coverage (iconUrl) | 100.0% |
| S3 coverage | 0.0% |

## Critical Issue: Blocked Domains

**755,489 symbols** reference `img.logo.dev` URLs which are **blocked by browser ORB** (Opaque Response Blocking). This means ~47.6% of all symbols show broken logos in the frontend.

| Blocked Domain | Count |
|----------------|-------|
| img.logo.dev | 755,489 |
| logo.clearbit.com | 12,130 |

### Recommendation

1. **Short term**: Add `onError` fallback to avatar component — show first letter of symbol in a colored circle when image fails
2. **Medium term**: Proxy logo.dev through our API (`/api/logo/:domain`) to avoid ORB blocking
3. **Long term**: Batch-upload all logo.dev images to S3 via the existing `logo-service`

## Missing by Exchange

| Exchange | Missing |
|----------|---------|
| SEC | 34 |
| COINGECKO | 33 |
| BSE | 1 |
| KRAKEN | 1 |

## Missing by Asset Type

| Type | Missing |
|------|---------|
| stock | 35 |
| crypto | 34 |

## Coverage by Asset Type

| Type | Total | Has Icon | Has S3 | Coverage |
|------|-------|----------|--------|----------|
| derivative | 1,480,061 | 1,480,061 | 744,025 | 100% |
| crypto | 48,670 | 48,636 | 45 | 99.9% |
| stock | 40,544 | 40,509 | 13,049 | 99.9% |
| etf | 12,283 | 12,283 | 3,673 | 100% |
| forex | 4,703 | 4,703 | 1,508 | 100% |
| index | 566 | 566 | 414 | 100% |
| economy | 180 | 180 | 34 | 100% |
| bond | 151 | 151 | 1 | 100% |

## Blocked Logo Samples

All use `img.logo.dev` with embedded API token:
- ORCL → `oracle.com`
- OOMA → `ooma.com`
- OPEX → `opex.com`
- Many reference `financialmodelingprep.com` (generic fallback, not real company logo)

## JSON Report

Full machine-readable report at: `/opt/tradereplay/logo-audit-report.json`
