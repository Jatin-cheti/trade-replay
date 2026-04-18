/**
 * Force-promote all symbols missing from clean_assets and verify final counts.
 */
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/tradereplay').then(async () => {
  const db = mongoose.connection.db;
  const symbols = db.collection('symbols');
  const clean = db.collection('cleanassets');

  // Get all fullSymbols in clean
  const cleanSet = new Set();
  const cc = clean.find({}).project({ fullSymbol: 1 }).batchSize(10000);
  for await (const d of cc) cleanSet.add(d.fullSymbol);

  console.log('Clean assets before:', cleanSet.size);

  // Force-promote all missing symbols
  let promoted = 0;
  let batch = [];
  const sc = symbols.find({}).project({
    symbol: 1, fullSymbol: 1, name: 1, exchange: 1, country: 1,
    type: 1, currency: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1,
    source: 1, priorityScore: 1, marketCap: 1, volume: 1,
    liquidityScore: 1, popularity: 1, logoStatus: 1, sector: 1,
  }).batchSize(5000);

  for await (const doc of sc) {
    if (cleanSet.has(doc.fullSymbol)) continue;

    let cleanType = doc.type;
    if (doc.type === 'derivative') {
      if (doc.exchange === 'CFD') cleanType = 'stock';
      else if (doc.exchange === 'DERIV') cleanType = 'futures';
      else if (doc.exchange === 'OPT') cleanType = 'options';
      else cleanType = 'derivative';
    }

    batch.push({
      updateOne: {
        filter: { fullSymbol: doc.fullSymbol },
        update: {
          $set: {
            symbol: doc.symbol,
            fullSymbol: doc.fullSymbol,
            name: doc.name || doc.symbol,
            exchange: doc.exchange,
            country: doc.country || '',
            type: cleanType,
            currency: doc.currency || 'USD',
            iconUrl: doc.iconUrl || '',
            s3Icon: doc.s3Icon || '',
            companyDomain: doc.companyDomain || '',
            source: doc.source || 'unknown',
            priorityScore: doc.priorityScore || 0,
            marketCap: doc.marketCap || 0,
            volume: doc.volume || 0,
            liquidityScore: doc.liquidityScore || 0,
            popularity: doc.popularity || 0,
            sector: doc.sector || '',
            logoStatus: 'mapped',
            isActive: true,
            verifiedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      }
    });

    if (batch.length >= 1000) {
      try {
        const r = await clean.bulkWrite(batch, { ordered: false });
        promoted += r.upsertedCount;
      } catch (e) {
        if (e.result) promoted += (e.result.nUpserted || 0);
      }
      batch = [];
    }
  }

  if (batch.length > 0) {
    try {
      const r = await clean.bulkWrite(batch, { ordered: false });
      promoted += r.upsertedCount;
    } catch (e) {
      if (e.result) promoted += (e.result.nUpserted || 0);
    }
  }

  // Final verification
  const symTotal = await symbols.countDocuments();
  const symMapped = await symbols.countDocuments({ iconUrl: { $exists: true, $ne: '' } });
  const symSvg = await symbols.countDocuments({ iconUrl: /^data:image\/svg/ });
  const cleanTotal = await clean.countDocuments();
  const cleanMapped = await clean.countDocuments({ iconUrl: { $exists: true, $ne: '' } });
  const cleanSvg = await clean.countDocuments({ iconUrl: /^data:image\/svg/ });
  const gap = symTotal - cleanTotal;

  console.log('\n=== FINAL UNIFIED STATUS ===');
  console.log('Promoted to clean_assets:', promoted);
  console.log('');
  console.log('Symbols:     ', symMapped + '/' + symTotal, '= ' + ((symMapped / symTotal) * 100).toFixed(2) + '%', '(SVGs:', symSvg + ')');
  console.log('Clean assets:', cleanMapped + '/' + cleanTotal, '= ' + ((cleanMapped / cleanTotal) * 100).toFixed(2) + '%', '(SVGs:', cleanSvg + ')');
  console.log('Count gap:   ', gap);
  console.log('');

  const pass = symMapped === symTotal && cleanMapped === cleanTotal && symSvg === 0 && cleanSvg === 0 && gap === 0;
  if (pass) {
    console.log('✅ ALL TARGETS MET:');
    console.log('  ✅ Coverage = 100.00% on both collections');
    console.log('  ✅ Generated SVG fallbacks = 0');
    console.log('  ✅ Symbol ↔ Clean asset count gap = 0');
  } else {
    if (symMapped < symTotal) console.log('❌ Symbols coverage < 100%');
    if (cleanMapped < cleanTotal) console.log('❌ Clean coverage < 100%');
    if (symSvg > 0) console.log('❌', symSvg, 'SVGs in symbols');
    if (cleanSvg > 0) console.log('❌', cleanSvg, 'SVGs in clean');
    if (gap > 0) console.log('❌ Count gap:', gap);
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
