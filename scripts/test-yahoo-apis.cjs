/**
 * Test: Fetch market cap using raw Yahoo Finance APIs
 * Tries multiple endpoints to find one that returns marketCap
 */

const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  const tickers = ['AAPL', 'MSFT', 'RELIANCE.NS', 'TCS.NS'];
  
  for (const ticker of tickers) {
    console.log(`\n--- ${ticker} ---`);
    
    // Try v8 chart
    try {
      const d = await fetchJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`);
      const meta = d?.chart?.result?.[0]?.meta;
      console.log('v8/chart meta keys:', Object.keys(meta || {}));
      console.log('  price:', meta?.regularMarketPrice, 'volume:', meta?.regularMarketVolume);
    } catch(e) { console.log('v8 error:', e.message); }
    
    // Try v10 quoteSummary
    try {
      const d = await fetchJSON(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=price`);
      console.log('v10 status:', d?.quoteSummary?.error?.code || 'OK');
      if (d?.quoteSummary?.result) {
        console.log('  marketCap:', d.quoteSummary.result[0]?.price?.marketCap);
      }
    } catch(e) { console.log('v10 error:', e.message); }
    
    // Try v7 quote
    try {
      const d = await fetchJSON(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`);
      console.log('v7 status:', d?.finance?.error?.code || 'OK');
    } catch(e) { console.log('v7 error:', e.message); }
  }
}

main();
