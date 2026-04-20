#!/bin/bash
# Test Yahoo Finance API with crumb authentication
set -e

echo "Step 1: Get cookies..."
curl -s -c /tmp/yf_cookies.txt -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 'https://fc.yahoo.com/' > /dev/null 2>&1 || true

echo "Step 2: Get crumb..."
CRUMB=$(curl -s -b /tmp/yf_cookies.txt -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 'https://query2.finance.yahoo.com/v1/test/getcrumb')
echo "Crumb: $CRUMB"

echo "Step 3: Test quoteSummary..."
curl -s -b /tmp/yf_cookies.txt -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' "https://query2.finance.yahoo.com/v10/finance/quoteSummary/AAPL?modules=price,summaryDetail,defaultKeyStatistics,financialData,assetProfile&crumb=$CRUMB" | python3 -m json.tool | head -80

echo ""
echo "Step 4: Test batch quote..."
curl -s -b /tmp/yf_cookies.txt -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' "https://query2.finance.yahoo.com/v7/finance/quote?symbols=AAPL,MSFT,GOOGL&crumb=$CRUMB" | python3 -m json.tool | head -40
