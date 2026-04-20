#!/bin/bash
# Run all enrichment phases sequentially with unbuffered output
cd /opt/tradereplay

echo "=== Starting full enrichment pipeline at $(date) ==="

# Phase 1: Profile (marketCap, sector, beta, avgVolume, domain)
echo "--- Phase 1: Profile ---"
node scripts/enrich-smart.cjs --phase=1 2>&1
echo "--- Phase 1 done at $(date) ---"

# Phase 2: Ratios TTM (PE, ROE, dividendYield, PEG)
echo "--- Phase 2: Ratios ---"
node scripts/enrich-smart.cjs --phase=2 2>&1
echo "--- Phase 2 done at $(date) ---"

# Phase 3: Income Statement (EPS, revenue, netIncome)
echo "--- Phase 3: Income ---"
node scripts/enrich-smart.cjs --phase=3 2>&1
echo "--- Phase 3 done at $(date) ---"

# Phase 4: Financial Growth (epsGrowth, revenueGrowth)
echo "--- Phase 4: Growth ---"
node scripts/enrich-smart.cjs --phase=4 2>&1
echo "--- Phase 4 done at $(date) ---"

# Phase 5: Analyst Ratings
echo "--- Phase 5: Ratings ---"
node scripts/enrich-smart.cjs --phase=5 2>&1
echo "--- Phase 5 done at $(date) ---"

echo "=== ALL PHASES COMPLETE at $(date) ==="
