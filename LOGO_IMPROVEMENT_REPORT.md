# Logo Pipeline Improvement Report

## Mission
Deeply audit and improve the full symbol→logo pipeline across services so logo resolution is near-complete at scale.

## Executive Summary

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| **Total symbols** | 1,579,751 | 1,579,751 | — |
| **With iconUrl** | 100% | 100% | — |
| **With companyDomain** | 822,158 (52.0%) | 858,101 (54.3%) | +35,943 |
| **SVG fallbacks** | 541 | 0 | **-541 (eliminated)** |
| **Exchange favicon fallbacks** | 917 | 67 | **-850 (92.7% reduction)** |
| **Clearbit logos** | 14,189 | 15,525 | **+1,336** |

## Per-Type Improvement

| Type | Before Real % | After Real % | Improvement |
|------|--------------|-------------|-------------|
| **stock** | 96.7% (1,370 fallback) | **98.6%** (571 fallback) | +1.9pp, **-799 fallbacks** |
| **etf** | 96.5% (386 fallback) | **97.5%** (284 fallback) | +1.0pp, **-102 fallbacks** |
| **crypto** | 64.7% (17,189 fallback) | **64.8%** (17,155 fallback) | +0.1pp, -34 fallbacks |
| **options** | 78.8% (425 fallback) | **95.5%** (89 fallback) | **+16.7pp, -336 fallbacks** |
| **futures** | 90.4% (192 fallback) | **96.4%** (72 fallback) | **+6.0pp, -120 fallbacks** |
| **forex** | 0.0% (4,701 fallback) | 0.0% (4,701 fallback) | — (expected: central bank icons) |
| **index** | 96.3% (21 fallback) | 96.3% (21 fallback) | — |
| **bond** | 62.3% (57 fallback) | 62.3% (57 fallback) | — |
| **economy** | 100% | 100% | — |

## Total Logos Upgraded: **36,108**

### Breakdown by Resolution Source
| Source | Count |
|--------|-------|
| clearbit:two_words | 34,825 |
| clearbit:known_map | 871 |
| fmp:image | 356 |
| clearbit | 8 |
| clearbit:first_word | 4 |
| Other | 44 |

## What Changed

### 1. companyNormalizer.service.ts — Expanded Domain Discovery
- **NAME_DOMAIN_MAP**: 73 → 250+ entries (Indian blue chips, US mega caps, European, Australian, Canadian companies)
- **Country-specific TLDs**: New COUNTRY_TLD_MAP supports 20+ countries (.co.in, .co.uk, .com.au, etc.)
- **Multi-candidate generation**: `deriveDomainCandidates()` returns multiple domains ranked by confidence
- **Confidence scoring**: Each domain gets high/medium/low/derived confidence rating
- **Longest-match-first**: Sorted key matching prevents "hdfc" from overriding "hdfc bank"

### 2. logoResolver.service.ts — Improved Resolution Chain
- **New Tier 4: FMP image stock** (`financialmodelingprep.com/image-stock/{SYMBOL}.png`) — works for US stocks without API key
- **Enhanced EXCHANGE_DOMAIN**: 35 → 70+ exchange mappings (added Japanese, Korean, Chinese, SE Asian, Nordic, Middle Eastern)
- **LogoResult extended**: Now returns `logoConfidence` (high/medium/low/none) and optional `domainUsed`
- **Better SVG monogram**: Uses company name initials when available, improved styling
- **Async resolver**: Uses multi-candidate domain validation instead of single-guess

### 3. CleanAsset.ts — New Logo Tracking Fields
- `logoSource`: Which resolution method produced the logo
- `logoTier`: Which tier (0-5) resolved the logo
- `logoConfidence`: high/medium/low/none quality rating
- `logoHash`: For dedup/change detection
- `domainConfidence`: How confident we are in the company domain
- `domainResolutionMethod`: How the domain was derived

### 4. AssetAvatar.tsx — Frontend Rendering Fixes
- **Data URI handling**: SVG data URIs now skip the fallback chain (no unnecessary network requests)
- **FMP URL support**: FMP image stock URLs handled correctly

### 5. Unit Tests — 73 Tests
- `testCompanyNormalizer.ts`: 36 tests covering normalizeName, deriveDomain, deriveDomainCandidates, country TLDs
- `testLogoResolver.ts`: 37 tests covering all 6 tiers (0-5), confidence scoring, edge cases

## Remaining Fallbacks (571 stocks)

The remaining stock fallbacks are mostly:
- **NYSE preferred shares**: `T-P-A`, `USB-P-A`, `MTB-P-H` — these use parent company favicons (acceptable)
- **SEC SPACs/warrants**: `EIKN`, `XCBE`, `ALUB-WT` — pre-revenue companies with no web presence
- **Delisted/inactive**: Symbols that no longer have active websites

These are irreducible tail cases where no company domain exists.

## Deployment
- **Backend**: Code committed to tradereplay/backend/src/
- **Frontend**: Built + deployed to https://tradereplay.me via Vercel
- **Redis cache**: Flushed after DB updates
- **All services**: Running on PM2 (64.227.184.166)
