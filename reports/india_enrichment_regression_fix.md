# India Enrichment Regression Fix (P0)

**Status:** RESOLVED. Proof: [india_enrichment_before_after_v2.csv](india_enrichment_before_after_v2.csv)

## Root Cause

The original `scripts/enrich-india-yahoo.cjs` (commit `4da2119`) had two compounding defects:

1. **Unconditional `$set`**: The script issued `updateOne({ symbol }, { $set: <flat object> })` with every Yahoo-returned field in one payload. If Yahoo returned `null`, `0`, or missing for a field that previously had a good value, the good value was overwritten with the degraded value.
2. **Metric pollution**: The `nullRates()` aggregation counts `0` as null (`$in: [null, 0, ""]`). Yahoo routinely returns `0` for `dividendYield`, `beta`, `peg`, `epsGrowth` on Indian small-caps. Writing `0` therefore looked identical to "no improvement" in the before/after CSV, while still degrading the record.

**Evidence (v1 before/after on 500 symbols):** deltas stuck at `0.0%` or slightly *positive* (worse) for `beta +0.2`, `dividendYield +0.1`, `roe +0.1` etc. — the visible "regression".

## Fix

New script: [scripts/enrich-india-yahoo-v2.cjs](../scripts/enrich-india-yahoo-v2.cjs)

Key changes:

| Change | Before | After |
|---|---|---|
| Update strategy | Single `$set` of the whole object | Per-field `noClobberSet(field, value)` loop |
| Guard clause | None | `{ $or: [{ [field]: { $in: [null, 0, ""] } }, { [field]: { $exists: false } }] }` |
| Value gate | Truthy JS (`if(v)`) | Strict `> 0` for numerics; explicit non-zero/non-empty check |
| Audit trail | None | Sets `enrichMeta.{field}.source` and `.updatedAt` on every write |
| Deep fetch | Implicit | Separate Phase B using `quoteSummary` modules `financialData,defaultKeyStatistics,earnings` |

Resulting write function:

```js
async function noClobberSet(coll, baseFilter, field, value, source) {
  const guard = { $or: [
    { [field]: { $in: [null, 0, ""] } },
    { [field]: { $exists: false } }
  ]};
  return coll.updateOne(
    { ...baseFilter, ...guard },
    { $set: {
      [field]: value,
      [`enrichMeta.${field}.source`]: source,
      [`enrichMeta.${field}.updatedAt`]: new Date()
    }}
  );
}
```

## Before / After (v2, 1,500 India stocks, limit=1500)

| field | before_pct | after_pct | delta_pp |
|---|---:|---:|---:|
| marketCap | 72.8 | 45.9 | **-26.9** |
| pe | 78.2 | 55.9 | **-22.3** |
| eps | 72.7 | 45.7 | **-27.0** |
| beta | 76.9 | 52.9 | **-24.0** |
| avgVolume | 72.3 | 45.5 | **-26.8** |
| dividendYield | 85.5 | 72.0 | -13.5 |
| roe | 94.9 | 93.7 | -1.2 |
| revenue | 76.5 | 49.6 | **-26.9** |
| revenueGrowth | 77.6 | 51.3 | **-26.3** |
| epsGrowth | 84.8 | 64.2 | **-20.6** |
| earningsGrowth | 83.4 | 63.9 | **-19.5** |
| analystRating | 77.3 | 68.1 | -9.2 |
| peg | 97.9 | 96.6 | -1.3 |
| volume | 92.3 | 68.4 | **-23.9** |
| price | 92.3 | 68.4 | **-23.9** |
| industry | 77.0 | 48.8 | **-28.2** |

All deltas negative (fewer nulls) — **regression eliminated**. Totals: enriched=868, deep_summaries=957, fields_written=10,848, failed=632 (mostly Yahoo rate-limit or non-listed ISINs).

## Remaining Gaps

- `roe` and `peg` still >93% null — Yahoo `defaultKeyStatistics` doesn't carry them for most Indian names; need `financialData.returnOnEquity` fallback + screener.in scrape or Tijori (out of scope for this pass).
- 632 symbols in [india_failed_symbols_with_reason_v2.csv](india_failed_symbols_with_reason_v2.csv) — most resolve via BSE suffix; next wave will re-try with `.BO` before `.NS`.
