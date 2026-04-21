# India Coverage Breakdown — Loop 3

## IND-004 Root Cause of "2,965"

Loop 2 reported India at "2,965 / 800,000 (0.37 %)". That was the count of
rows where `country = "IN" AND type = "stock" AND isActive = true`. It was
**not** the India total.

Actual Loop 3 snapshot (`reports/snap_loop3.json`):

| Type        |       Count |
|-------------|------------:|
| options     |      59,861 |
| mutualfund  |  **14,350** (Loop 3 wave IN-03) |
| futures     |       3,336 |
| stock       |       2,965 |
| etf         |          20 |
| index       |           9 |
| economy     |           6 |
| bond        |           4 |
| **TOTAL**   | **80,551** |

So the true India coverage ratio is `80,551 / 800,000 = 10.07 %` — still a
FAIL on 2M-002, but an order of magnitude better than the "0.37 %" figure.

## Wave IN-03 delivered (this loop)

- Source: `https://www.amfiindia.com/spages/NAVAll.txt` (pipe-delimited, public).
- Script: `scripts/ingest-amfi-mf.cjs` — follows 301/302 redirects, parses
  AMC-grouped sections, uses `mergeFieldWithAudit` for updates on existing docs.
- Result: `parsed: 14350, upserted: 14350, errors: 0`
  (`reports/amfi_ingest_report.json`).

## Realistic target breakdown

| Segment             | Exchange     | Est. universe | Wave       | Status     |
|---------------------|--------------|---------------|------------|------------|
| Equity Main Board   | NSE          | ~1,900        | IN-01      | Loop 4     |
| Equity Main Board   | BSE          | ~5,500        | IN-02      | Loop 4     |
| F&O derivatives     | NSE          | ~60,000       | (prior)    | PASS       |
| SME / Emerge        | BSE / NSE    | ~800          | IN-04      | Loop 4     |
| Mutual Funds        | AMFI         | ~14,350       | **IN-03**  | **PASS**   |
| ETFs                | NSE + BSE    | ~200          | IN-05      | Loop 4     |
| Indices             | NSE + BSE    | ~150          | IN-05      | Loop 4     |
| Bonds / NCDs        | NSE + BSE    | ~10,000       | IN-06      | Loop 5     |
| Currency deriv      | NSE          | ~50           | IN-06      | Loop 5     |
| Commodity deriv     | MCX / NCDEX  | ~150          | IN-06      | Loop 5     |
| Index option strike | NSE          | ~600,000      | IN-07      | Loop 5     |

The 800 K target is dominated by index-option strike expansion (NIFTY/BANKNIFTY
weekly + monthly × strike range). Loop 4 prioritises closing the equity gap
(IN-01/02) and bringing sorted ETF / index universes in.
