const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/tradereplay').then(async () => {
  const db = mongoose.connection.db;
  const s = db.collection('symbols');
  const c = db.collection('cleanassets');

  const total = await s.countDocuments();
  const missing = await s.countDocuments({ $or: [{ iconUrl: { $exists: false } }, { iconUrl: '' }] });
  const svgs = await s.countDocuments({ iconUrl: /^data:image\/svg/ });

  const cTotal = await c.countDocuments();
  const cMissing = await c.countDocuments({ $or: [{ iconUrl: { $exists: false } }, { iconUrl: '' }] });
  const cSvgs = await c.countDocuments({ iconUrl: /^data:image\/svg/ });

  console.log('=== FINAL VERIFICATION (API-equivalent) ===');
  console.log('Symbols:');
  console.log('  total   :', total);
  console.log('  mapped  :', total - missing);
  console.log('  missing :', missing);
  console.log('  coverage:', ((total - missing) / total * 100).toFixed(2) + '%');
  console.log('  SVGs    :', svgs);
  console.log('');
  console.log('Clean Assets:');
  console.log('  total   :', cTotal);
  console.log('  mapped  :', cTotal - cMissing);
  console.log('  missing :', cMissing);
  console.log('  coverage:', ((cTotal - cMissing) / cTotal * 100).toFixed(2) + '%');
  console.log('  SVGs    :', cSvgs);
  console.log('');
  console.log('Count gap :', total - cTotal);
  console.log('');

  // Sample 10 random mapped logos to show they're real URLs
  const samples = await s.aggregate([
    { $match: { iconUrl: { $exists: true, $ne: '' } } },
    { $sample: { size: 10 } },
    { $project: { symbol: 1, exchange: 1, iconUrl: 1, _id: 0 } }
  ]).toArray();
  console.log('Sample logos:');
  for (const doc of samples) {
    console.log('  ' + doc.symbol + ':' + doc.exchange + ' → ' + (doc.iconUrl || '').substring(0, 80));
  }

  // Check key symbols
  console.log('\nKey symbol check:');
  for (const sym of ['AAPL', 'TSLA', 'NVDA', 'RELIANCE', 'TCS', 'INFY', 'BTC', 'ETH']) {
    const doc = await s.findOne({ symbol: sym });
    if (doc) {
      console.log('  ' + sym + ':' + doc.exchange + ' → ' + (doc.iconUrl || '').substring(0, 80));
    } else {
      console.log('  ' + sym + ' NOT FOUND');
    }
  }

  // Success criteria
  const apiPct = (total - missing) / total * 100;
  const pass = apiPct >= 99.0 && svgs === 0 && cSvgs === 0 && (total - cTotal) === 0;
  console.log('\n=== SUCCESS CRITERIA ===');
  console.log('apiCoveragePercent >= 99.0      :', apiPct >= 99.0, '(' + apiPct.toFixed(2) + '%)');
  console.log('generatedSVGFallbacks === 0     :', svgs === 0 && cSvgs === 0, '(sym:' + svgs + ' clean:' + cSvgs + ')');
  console.log('symbolsNotInCleanAssets === 0   :', (total - cTotal) === 0, '(gap:' + (total - cTotal) + ')');
  console.log('');
  console.log(pass ? '✅ ALL CRITERIA PASSED' : '❌ SOME CRITERIA FAILED');

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
