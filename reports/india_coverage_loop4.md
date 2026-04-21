# India Coverage — Loop 4

## Pre-wave vs Post-wave (verified against prod MongoDB)

| Slice                      | Pre-wave (Loop 3) | Post-wave (Loop 4) | Delta  | Source                        |
|----------------------------|-------------------|--------------------|--------|-------------------------------|
| India total (all types)    | 80,551            | **85,518**         | +4,967 | `baseline_loop4.json` → `postwave_loop4.json` |
| NSE stock                  | 2,586             | 2,692              | +106   | NSE EQUITY_L.csv (2,364 rows, 106 new) |
| BSE stock                  | 379               | 5,240              | +4,861 | BSE `api/ListofScripData/w` (4,862 rows, 4,861 new, 1 failed ISIN) |
| AMFI mutual funds          | 14,350            | 14,350             | 0      | no change                     |
| Options (weekly + monthly) | 59,861            | 59,861             | 0      | no change                     |
| Futures                    | 3,336             | 3,336              | 0      | no change                     |
| NSE ETF                    | 9                 | 9                  | 0      | no change                     |
| BSE ETF                    | 11                | 11                 | 0      | no change                     |
| NSE Index                  | 7                 | 7                  | 0      | no change                     |
| BSE Index                  | 2                 | 2                  | 0      | no change                     |

## Enrichment quality (post-wave)

| Field         | Covered   | Total  | %       |
|---------------|-----------|--------|---------|
| has_name      | 85,518    | 85,518 | 100.00% |
| has_logo      | 85,518    | 85,518 | 100.00% |
| has_sector    | 85,517    | 85,518 | 99.999% |
| has_industry  | 80,657    | 85,518 | 94.32%  |
| has_mcap      | 85,518    | 85,518 | 100.00% |
| has_pe        | 85,518    | 85,518 | 100.00% |

`has_industry` drop from 100% to 94.32% is expected — 4,861 new BSE records
arrived without industry field (BSE API returns `INDUSTRY:null` for most).
Backfill requires downstream Yahoo/SEBI sector enrichment.

## Audit log integrity

| Metric                  | Pre-wave | Post-wave | Meaning                                    |
|-------------------------|----------|-----------|--------------------------------------------|
| `enrichment_audit_log.total`   | 0        | **32,354**  | merges now produce audit trail (Loop 3 bug) |
| null_overwrite_bug      | 0        | 0         | no nulls overwriting real values           |
| weak_source_bug         | 0        | 0         | no lower-confidence overwrites             |

## De-duplication check

```js
db.symbols.aggregate([
  {$group:{_id:"$fullSymbol",n:{$sum:1}}},
  {$match:{n:{$gt:1}}},
  {$limit:20}
]) => []
```
**0 duplicates on `fullSymbol`** after +4,967 new docs. Composite uniqueness
held under ingestion pressure.

## Gap to 250,000 Target

| Missing                          | Approx count | Source                     |
|----------------------------------|--------------|----------------------------|
| Weekly F&O options (4 expiries)  | ~40,000      | NSE F&O contract file      |
| G-Secs + T-Bills                 | ~2,500       | RBI + SEBI filings         |
| Corporate bonds (listed)         | ~8,000       | BSE CDBM + NSE debt        |
| AIF / PMS / REIT / InvIT         | ~1,500       | SEBI portal scrape         |
| BSE ODD + BSE debt               | ~2,000       | BSE ListofScripData Odd/Debt segments |
| SME IPO + ST series already ingested (above) | — | flagged as SME |
| **Sum of deferred sources**      | **~54,000**  | — none alone gets to 250k  |

Even combining all deferred sources brings India to ~140,000, still **110,000 short** of 250k.
To honestly reach 250,000 India, the scope would need to include intraday F&O contract churn
(~50k/year × 5-year lookback = 250k historical contracts) — which exceeds the "live tradable"
spirit of the spec.

**Recommendation to user:** either (a) revise India target to 140,000 and fund bond/AIF wave,
or (b) explicitly opt into historical F&O contract universe ingestion.
