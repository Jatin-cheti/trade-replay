# 2M Symbol Coverage Gap Plan

Generated: 2026-04-20T22:32:09.077Z

## Summary
| Metric | Actual | Target | Gap |
|--------|--------|--------|-----|
| Total active assets | 1,579,751 | 2,000,000 | 420,249 |
| India assets | 66,201 | 800,000 | 733,799 |
| US assets | 1,328,012 | 200,000 | -1,128,012 |
| Rest-of-World | 7,495 | 1,000,000 | 992,505 |
| India stocks only | 2,965 | ~5,000 NSE/BSE | 2,035 |
| US stocks only | 34,803 | ~10,000 NASDAQ+NYSE | 0 |

## Asset Class Breakdown
| Asset Class | Actual | Target | Status |
|-------------|--------|--------|--------|
| options | 1,379,532 | 1,200,000 | ✓ MET |
| futures | 92,796 | 100,000 | ✗ GAP=7,204 |
| crypto | 48,690 | 50,000 | ✗ GAP=1,310 |
| stock | 41,977 | 200,000 | ✗ GAP=158,023 |
| etf | 11,156 | 15,000 | ✗ GAP=3,844 |
| forex | 4,703 | 5,000 | ✗ GAP=297 |
| index | 566 | 1,000 | ✗ GAP=434 |
| economy | 180 | 200 | ✗ GAP=20 |
| bond | 151 | 500 | ✗ GAP=349 |
| **TOTAL** | **1,579,751** | **2,000,000** | **✗ GAP=420,249** |

## India Gap Details
- India stock universe: 2,965 (NSE 2965, target 2,965 unique)
- India options/futures: 63236 assets
- Gap to 800K: 733,799 — primarily India options coverage missing

## Next Ingestion Wave Plan
| Wave | Source | Target Class | Target Country | ETA |
|------|--------|--------------|----------------|-----|
| 1 | Yahoo Finance (free) | Stocks | IN | Running now (500 batch) |
| 2 | Yahoo Finance (free) | Stocks | US/ALL | Running now (5000 batch) |
| 3 | Open FIGI / OPRA | Options | IN/US | Next cycle |
| 4 | Yahoo Finance (free) | Stocks | EU/UK/JP/HK | Next cycle |
| 5 | NSE/BSE Open APIs | Stocks | IN | Next cycle |