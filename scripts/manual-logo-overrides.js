// scripts/manual-logo-overrides.js
// Curated FMP image-stock URLs for top ~30 Indian + US large caps
// Run: mongosh 'mongodb://10.122.0.2:27017/tradereplay' --quiet --file scripts/manual-logo-overrides.js

const OVERRIDES = [
  // India NSE (FMP .NS format)
  { symbols: ['RELIANCE'], country: 'IN', url: 'https://financialmodelingprep.com/image-stock/RELIANCE.NS.png' },
  { symbols: ['TCS'],       country: 'IN', url: 'https://financialmodelingprep.com/image-stock/TCS.NS.png' },
  { symbols: ['HDFCBANK'],  country: 'IN', url: 'https://financialmodelingprep.com/image-stock/HDFCBANK.NS.png' },
  { symbols: ['INFY'],      country: 'IN', url: 'https://financialmodelingprep.com/image-stock/INFY.NS.png' },
  { symbols: ['ICICIBANK'], country: 'IN', url: 'https://financialmodelingprep.com/image-stock/ICICIBANK.NS.png' },
  { symbols: ['HINDUNILVR'],country: 'IN', url: 'https://financialmodelingprep.com/image-stock/HINDUNILVR.NS.png' },
  { symbols: ['SBIN'],      country: 'IN', url: 'https://financialmodelingprep.com/image-stock/SBIN.NS.png' },
  { symbols: ['BHARTIARTL'],country: 'IN', url: 'https://financialmodelingprep.com/image-stock/BHARTIARTL.NS.png' },
  { symbols: ['ITC'],       country: 'IN', url: 'https://financialmodelingprep.com/image-stock/ITC.NS.png' },
  { symbols: ['KOTAKBANK'], country: 'IN', url: 'https://financialmodelingprep.com/image-stock/KOTAKBANK.NS.png' },
  { symbols: ['LT'],        country: 'IN', url: 'https://financialmodelingprep.com/image-stock/LT.NS.png' },
  { symbols: ['AXISBANK'],  country: 'IN', url: 'https://financialmodelingprep.com/image-stock/AXISBANK.NS.png' },
  { symbols: ['ASIANPAINT'],country: 'IN', url: 'https://financialmodelingprep.com/image-stock/ASIANPAINT.NS.png' },
  { symbols: ['MARUTI'],    country: 'IN', url: 'https://financialmodelingprep.com/image-stock/MARUTI.NS.png' },
  { symbols: ['WIPRO'],     country: 'IN', url: 'https://financialmodelingprep.com/image-stock/WIPRO.NS.png' },
  { symbols: ['HCLTECH'],   country: 'IN', url: 'https://financialmodelingprep.com/image-stock/HCLTECH.NS.png' },
  { symbols: ['SUNPHARMA'], country: 'IN', url: 'https://financialmodelingprep.com/image-stock/SUNPHARMA.NS.png' },
  { symbols: ['TITAN'],     country: 'IN', url: 'https://financialmodelingprep.com/image-stock/TITAN.NS.png' },
  { symbols: ['BAJFINANCE'],country: 'IN', url: 'https://financialmodelingprep.com/image-stock/BAJFINANCE.NS.png' },
  { symbols: ['ULTRACEMCO'],country: 'IN', url: 'https://financialmodelingprep.com/image-stock/ULTRACEMCO.NS.png' },
  { symbols: ['LICI'],      country: 'IN', url: 'https://financialmodelingprep.com/image-stock/LICI.NS.png' },
  { symbols: ['ONGC'],      country: 'IN', url: 'https://financialmodelingprep.com/image-stock/ONGC.NS.png' },
  { symbols: ['NTPC'],      country: 'IN', url: 'https://financialmodelingprep.com/image-stock/NTPC.NS.png' },
  { symbols: ['POWERGRID'], country: 'IN', url: 'https://financialmodelingprep.com/image-stock/POWERGRID.NS.png' },
  { symbols: ['TATAMOTORS'],country: 'IN', url: 'https://financialmodelingprep.com/image-stock/TATAMOTORS.NS.png' },
  { symbols: ['TATASTEEL'], country: 'IN', url: 'https://financialmodelingprep.com/image-stock/TATASTEEL.NS.png' },
  { symbols: ['M&M'],       country: 'IN', url: 'https://financialmodelingprep.com/image-stock/M%26M.NS.png' },
  { symbols: ['ADANIENT'],  country: 'IN', url: 'https://financialmodelingprep.com/image-stock/ADANIENT.NS.png' },
  { symbols: ['HDFCLIFE'],  country: 'IN', url: 'https://financialmodelingprep.com/image-stock/HDFCLIFE.NS.png' },
  { symbols: ['BAJAJFINSV'],country: 'IN', url: 'https://financialmodelingprep.com/image-stock/BAJAJFINSV.NS.png' },
  { symbols: ['NESTLEIND'], country: 'IN', url: 'https://financialmodelingprep.com/image-stock/NESTLEIND.NS.png' },
  { symbols: ['COALINDIA'], country: 'IN', url: 'https://financialmodelingprep.com/image-stock/COALINDIA.NS.png' },
  { symbols: ['IOC'],       country: 'IN', url: 'https://financialmodelingprep.com/image-stock/IOC.NS.png' },
  { symbols: ['GRASIM'],    country: 'IN', url: 'https://financialmodelingprep.com/image-stock/GRASIM.NS.png' },
  { symbols: ['DRREDDY'],   country: 'IN', url: 'https://financialmodelingprep.com/image-stock/DRREDDY.NS.png' },

  // US standard FMP format
  { symbols: ['AAPL'],  country: 'US', url: 'https://financialmodelingprep.com/image-stock/AAPL.png' },
  { symbols: ['MSFT'],  country: 'US', url: 'https://financialmodelingprep.com/image-stock/MSFT.png' },
  { symbols: ['GOOGL'], country: 'US', url: 'https://financialmodelingprep.com/image-stock/GOOGL.png' },
  { symbols: ['GOOG'],  country: 'US', url: 'https://financialmodelingprep.com/image-stock/GOOG.png' },
  { symbols: ['AMZN'],  country: 'US', url: 'https://financialmodelingprep.com/image-stock/AMZN.png' },
  { symbols: ['NVDA'],  country: 'US', url: 'https://financialmodelingprep.com/image-stock/NVDA.png' },
  { symbols: ['META'],  country: 'US', url: 'https://financialmodelingprep.com/image-stock/META.png' },
  { symbols: ['TSLA'],  country: 'US', url: 'https://financialmodelingprep.com/image-stock/TSLA.png' },
  { symbols: ['BRK.B'], country: 'US', url: 'https://financialmodelingprep.com/image-stock/BRK-B.png' },
  { symbols: ['JPM'],   country: 'US', url: 'https://financialmodelingprep.com/image-stock/JPM.png' },
  { symbols: ['V'],     country: 'US', url: 'https://financialmodelingprep.com/image-stock/V.png' },
  { symbols: ['MA'],    country: 'US', url: 'https://financialmodelingprep.com/image-stock/MA.png' },
  { symbols: ['ORCL'],  country: 'US', url: 'https://financialmodelingprep.com/image-stock/ORCL.png' },
  { symbols: ['NFLX'],  country: 'US', url: 'https://financialmodelingprep.com/image-stock/NFLX.png' },
];

let updated = 0, skipped = 0;
OVERRIDES.forEach(function (o) {
  const r = db.cleanassets.updateMany(
    { symbol: { $in: o.symbols }, country: o.country },
    { $set: {
        iconUrl: o.url,
        logoProvider: 'manual_override',
        logoQuality: 10,
        logoVerified: true,
        logoVerifiedAt: new Date()
    } }
  );
  if (r.modifiedCount > 0) { updated += r.modifiedCount; print('  ' + o.symbols.join(',') + '(' + o.country + '): ' + r.modifiedCount); }
  else skipped++;
});
print('\nTotal updated: ' + updated + ' | skipped: ' + skipped);
