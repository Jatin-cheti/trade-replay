/**
 * Logo Styling Audit — checks quality of all logos in the system.
 * 
 * Checks:
 * 1. No data:image/svg (generated fallbacks)
 * 2. No blank/empty iconUrl
 * 3. Clearbit logos with suspicious domains (e.g., derived domains that are wrong)
 * 4. Google favicons (lower quality, flag count)
 * 5. Key symbols have high-quality logos
 * 6. Logo URL format validity
 */
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/tradereplay').then(async () => {
  const db = mongoose.connection.db;
  const symbols = db.collection('symbols');

  console.log('=== LOGO STYLING AUDIT ===\n');

  // 1. Breakdown by logo source
  const totalDocs = await symbols.countDocuments();
  const clearbitCount = await symbols.countDocuments({ iconUrl: /^https:\/\/logo\.clearbit\.com/ });
  const googleFaviconCount = await symbols.countDocuments({ iconUrl: /^https:\/\/www\.google\.com\/s2\/favicons/ });
  const coingeckoCount = await symbols.countDocuments({ iconUrl: /coingecko/ });
  const fmpCount = await symbols.countDocuments({ iconUrl: /financialmodelingprep/ });
  const s3Count = await symbols.countDocuments({ iconUrl: /amazonaws\.com|s3\./ });
  const svgCount = await symbols.countDocuments({ iconUrl: /^data:image\/svg/ });
  const emptyCount = await symbols.countDocuments({ $or: [{ iconUrl: { $exists: false } }, { iconUrl: '' }] });

  const otherCount = totalDocs - clearbitCount - googleFaviconCount - coingeckoCount - fmpCount - s3Count - svgCount - emptyCount;

  console.log('Logo source breakdown:');
  console.log('  Clearbit logos       :', clearbitCount, '(' + (clearbitCount / totalDocs * 100).toFixed(1) + '%)');
  console.log('  Google favicons      :', googleFaviconCount, '(' + (googleFaviconCount / totalDocs * 100).toFixed(1) + '%)');
  console.log('  CoinGecko            :', coingeckoCount, '(' + (coingeckoCount / totalDocs * 100).toFixed(1) + '%)');
  console.log('  FMP stock images     :', fmpCount, '(' + (fmpCount / totalDocs * 100).toFixed(1) + '%)');
  console.log('  S3/CDN               :', s3Count, '(' + (s3Count / totalDocs * 100).toFixed(1) + '%)');
  console.log('  Other direct URLs    :', otherCount, '(' + (otherCount / totalDocs * 100).toFixed(1) + '%)');
  console.log('  Generated SVGs       :', svgCount);
  console.log('  Empty/missing        :', emptyCount);
  console.log('  Total                :', totalDocs);

  // 2. Check Clearbit domains for suspicious patterns
  console.log('\n--- Clearbit Domain Audit ---');
  const clearbitCursor = symbols.find({ iconUrl: /^https:\/\/logo\.clearbit\.com/ })
    .project({ symbol: 1, iconUrl: 1, _id: 0 })
    .batchSize(10000);

  const domainCounts = {};
  let suspiciousCount = 0;
  const suspiciousSamples = [];

  for await (const doc of clearbitCursor) {
    const m = doc.iconUrl.match(/clearbit\.com\/(.+)/);
    if (m) {
      const domain = m[1];
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      if ((domain.length < 5 || /^\d+\./.test(domain) || /priority\.com/.test(domain)) && suspiciousCount < 10) {
        suspiciousSamples.push({ symbol: doc.symbol, domain });
        suspiciousCount++;
      }
    }
  }

  const overusedDomains = Object.entries(domainCounts)
    .filter(([, count]) => count > 50)
    .sort((a, b) => b[1] - a[1]);

  if (overusedDomains.length > 0) {
    console.log('Overused Clearbit domains (>50 uses, likely wrong):');
    for (const [domain, count] of overusedDomains.slice(0, 20)) {
      console.log('  ' + domain + ' → ' + count + ' symbols');
    }
  } else {
    console.log('No overused Clearbit domains detected.');
  }

  if (suspiciousSamples.length > 0) {
    console.log('Suspicious Clearbit domains (sample):');
    for (const d of suspiciousSamples) {
      console.log('  ' + d.symbol + ' → ' + d.domain);
    }
  }

  // 3. Check Google favicon domains
  console.log('\n--- Google Favicon Quality ---');
  const faviconCursor = symbols.find({ iconUrl: /^https:\/\/www\.google\.com\/s2\/favicons/ })
    .project({ symbol: 1, exchange: 1, iconUrl: 1, _id: 0 })
    .batchSize(10000);

  const faviconDomains = {};
  let faviconHd = 0;
  let faviconTotal = 0;

  for await (const doc of faviconCursor) {
    faviconTotal++;
    if (doc.iconUrl.includes('sz=128')) faviconHd++;
    const m = doc.iconUrl.match(/domain=([^&]+)/);
    if (m) {
      faviconDomains[m[1]] = (faviconDomains[m[1]] || 0) + 1;
    }
  }

  const overusedFavicons = Object.entries(faviconDomains)
    .filter(([, count]) => count > 100)
    .sort((a, b) => b[1] - a[1]);

  if (overusedFavicons.length > 0) {
    console.log('Overused Google favicon domains (>100 uses):');
    for (const [domain, count] of overusedFavicons.slice(0, 20)) {
      console.log('  ' + domain + ' → ' + count + ' symbols');
    }
  }

  console.log('Total Google favicons:', faviconTotal);
  console.log('With sz=128 (HD):', faviconHd);

  // 4. Check for common known-bad patterns
  console.log('\n--- Bad Pattern Detection ---');
  const placeholderCount = await symbols.countDocuments({ iconUrl: /placeholder|default|blank|dummy/i });
  const localhostCount = await symbols.countDocuments({ iconUrl: /localhost|127\.0\.0\.1/ });

  console.log('Placeholder URLs     :', placeholderCount);
  console.log('Localhost URLs       :', localhostCount);

  // 5. Key symbols quality check
  console.log('\n--- Key Symbols Quality ---');
  const keySymbols = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B',
    'JPM', 'V', 'UNH', 'WMT', 'MA', 'PG', 'HD', 'KO',
    'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE',
    'RELIANCE', 'TCS', 'INFY', 'HDFC',
  ];
  
  let goodKeys = 0;
  let badKeys = [];
  for (const sym of keySymbols) {
    const doc = await symbols.findOne({ symbol: sym, iconUrl: { $exists: true, $ne: '' } });
    if (doc) {
      const isGoodQuality = !doc.iconUrl.includes('google.com/s2/favicons') || doc.iconUrl.includes('sz=128');
      if (isGoodQuality) {
        goodKeys++;
      } else {
        badKeys.push(sym + ' (low-res favicon)');
      }
    } else {
      badKeys.push(sym + ' (NO LOGO)');
    }
  }
  console.log('Key symbols with good logos:', goodKeys + '/' + keySymbols.length);
  if (badKeys.length > 0) {
    console.log('Issues:', badKeys.join(', '));
  }

  // 6. Exchange coverage
  console.log('\n--- Exchange Coverage ---');
  const exchangeStats = await symbols.aggregate([
    { $group: { 
      _id: '$exchange', 
      total: { $sum: 1 },
      mapped: { $sum: { $cond: [{ $and: [{ $ne: ['$iconUrl', ''] }, { $ne: ['$iconUrl', null] }] }, 1, 0] } }
    }},
    { $sort: { total: -1 } },
    { $limit: 20 }
  ]).toArray();

  console.log('Top 20 exchanges:');
  for (const ex of exchangeStats) {
    const pct = ex.total > 0 ? (ex.mapped / ex.total * 100).toFixed(1) : '0.0';
    const flag = ex.mapped < ex.total ? ' !!!' : '';
    console.log('  ' + (ex._id || 'null').padEnd(15) + ex.mapped + '/' + ex.total + ' (' + pct + '%)' + flag);
  }

  // Summary
  console.log('\n=== AUDIT SUMMARY ===');
  const issues = [];
  if (svgCount > 0) issues.push(svgCount + ' generated SVGs');
  if (emptyCount > 0) issues.push(emptyCount + ' empty logos');
  if (placeholderCount > 0) issues.push(placeholderCount + ' placeholders');
  if (localhostCount > 0) issues.push(localhostCount + ' localhost URLs');
  if (overusedDomains.length > 0) issues.push(overusedDomains.length + ' overused Clearbit domains');
  if (badKeys.length > 0) issues.push(badKeys.length + ' key symbols with quality issues');

  if (issues.length === 0) {
    console.log('PASS: No critical issues found.');
  } else {
    console.log('Issues found:');
    for (const issue of issues) console.log('  - ' + issue);
  }

  console.log('\nLogo quality distribution:');
  const highQ = s3Count + coingeckoCount + fmpCount;
  const medQ = clearbitCount + otherCount;
  const lowQ = googleFaviconCount;
  console.log('  High quality (S3/CDN/CoinGecko/FMP): ' + highQ + ' (' + (highQ / totalDocs * 100).toFixed(1) + '%)');
  console.log('  Medium quality (Clearbit/Other)     : ' + medQ + ' (' + (medQ / totalDocs * 100).toFixed(1) + '%)');
  console.log('  Lower quality (Google favicons)     : ' + lowQ + ' (' + (lowQ / totalDocs * 100).toFixed(1) + '%)');

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
