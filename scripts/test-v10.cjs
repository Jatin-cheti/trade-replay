/**
 * Test v10 quoteSummary endpoint to verify marketCap data
 */
const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data.slice(0, 500) }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const tickers = ['AAPL', 'RELIANCE.NS', 'TCS.NS', 'MSFT'];
  
  for (const ticker of tickers) {
    const { status, body } = await fetchJSON(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=price`
    );
    console.log(`\n${ticker} (HTTP ${status}):`);
    if (status === 200) {
      const price = body?.quoteSummary?.result?.[0]?.price;
      if (price) {
        console.log('  marketCap:', JSON.stringify(price.marketCap));
        console.log('  volume:', JSON.stringify(price.regularMarketVolume));
        console.log('  price:', JSON.stringify(price.regularMarketPrice));
      } else {
        console.log('  No price data:', JSON.stringify(body).slice(0, 300));
      }
    } else {
      console.log('  Error:', JSON.stringify(body).slice(0, 300));
    }
  }
}

main();
