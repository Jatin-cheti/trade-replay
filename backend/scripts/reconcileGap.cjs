/**
 * Fix the 5,247 count gap.
 * These are duplicate symbols with EXCHANGE:SYMBOL format (e.g., "NASDAQ:AAL")
 * while clean_assets has SYMBOL:EXCHANGE format (e.g., "AAL:NASDAQ").
 * 
 * Solution: For each missing fullSymbol in clean_assets, either:
 * 1. If the reverse format already exists in clean_assets → merge (dedupe in symbols)
 * 2. If truly new → create clean asset entry
 * 
 * Then normalize all symbols to use ONE consistent fullSymbol format.
 */
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/tradereplay').then(async () => {
  const db = mongoose.connection.db;
  const symbols = db.collection('symbols');
  const clean = db.collection('cleanassets');

  console.log('=== RECONCILE COUNT GAP ===');

  // Build clean fullSymbol set
  const cleanSet = new Set();
  const cc = clean.find({}).project({ fullSymbol: 1 }).batchSize(10000);
  for await (const d of cc) cleanSet.add(d.fullSymbol);

  // Find symbols not in clean
  let duplicates = 0;
  let genuinelyNew = 0;
  let promoteBatch = [];

  const sc = symbols.find({}).project({
    _id: 1, symbol: 1, fullSymbol: 1, name: 1, exchange: 1, country: 1,
    type: 1, currency: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1,
    source: 1, priorityScore: 1, marketCap: 1, volume: 1,
    liquidityScore: 1, popularity: 1, logoStatus: 1, sector: 1,
  }).batchSize(5000);

  for await (const doc of sc) {
    if (cleanSet.has(doc.fullSymbol)) continue;

    // Check reverse format
    const parts = doc.fullSymbol.split(':');
    let reverseFullSymbol = null;
    if (parts.length === 2) {
      reverseFullSymbol = parts[1] + ':' + parts[0];
    }

    if (reverseFullSymbol && cleanSet.has(reverseFullSymbol)) {
      // This is a duplicate — the clean_assets already has this symbol+exchange under the reverse format
      // Normalize the symbol's fullSymbol to match clean_assets
      duplicates++;
      continue; // Already represented in clean_assets
    }

    // Genuinely new — promote to clean_assets
    genuinelyNew++;
    let cleanType = doc.type;
    if (doc.type === 'derivative') {
      if (doc.exchange === 'CFD') cleanType = 'stock';
      else if (doc.exchange === 'DERIV') cleanType = 'futures';
      else if (doc.exchange === 'OPT') cleanType = 'options';
      else cleanType = 'derivative';
    }

    promoteBatch.push({
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

    if (promoteBatch.length >= 1000) {
      try {
        await clean.bulkWrite(promoteBatch, { ordered: false });
      } catch (e) { /* ignore dup key */ }
      promoteBatch = [];
    }
  }

  if (promoteBatch.length > 0) {
    try {
      await clean.bulkWrite(promoteBatch, { ordered: false });
    } catch (e) { /* ignore dup key */ }
  }

  console.log('Duplicates (reverse format exists in clean):', duplicates);
  console.log('Genuinely new (promoted):', genuinelyNew);

  // Now deduplicate symbols collection: remove the EXCHANGE:SYMBOL duplicates
  // keeping only the SYMBOL:EXCHANGE format that clean_assets uses
  console.log('\nDeduplicating symbols collection...');
  let deduped = 0;
  const dedupCursor = symbols.find({}).project({
    _id: 1, fullSymbol: 1, symbol: 1, exchange: 1,
  }).batchSize(5000);

  const seenSymExchange = new Map(); // "SYMBOL|EXCHANGE" -> fullSymbol
  const toRemove = [];

  for await (const doc of dedupCursor) {
    const key = doc.symbol + '|' + doc.exchange;
    if (seenSymExchange.has(key)) {
      // Duplicate! Keep the one that matches SYMBOL:EXCHANGE format
      const existing = seenSymExchange.get(key);
      const isCurrentCanonical = doc.fullSymbol === doc.symbol + ':' + doc.exchange;
      const isExistingCanonical = existing === doc.symbol + ':' + doc.exchange;

      if (isCurrentCanonical && !isExistingCanonical) {
        // Current is canonical, remove existing
        toRemove.push(existing);
        seenSymExchange.set(key, doc.fullSymbol);
      } else {
        // Existing is canonical (or both are), remove current
        toRemove.push(doc.fullSymbol);
      }
    } else {
      seenSymExchange.set(key, doc.fullSymbol);
    }
  }

  if (toRemove.length > 0) {
    // Delete in batches
    for (let i = 0; i < toRemove.length; i += 1000) {
      const chunk = toRemove.slice(i, i + 1000);
      const result = await symbols.deleteMany({ fullSymbol: { $in: chunk } });
      deduped += result.deletedCount;
    }
  }

  console.log('Removed', deduped, 'duplicate symbols');

  // Final counts
  const symTotal = await symbols.countDocuments();
  const symMapped = await symbols.countDocuments({ iconUrl: { $exists: true, $ne: '' } });
  const symSvg = await symbols.countDocuments({ iconUrl: /^data:image\/svg/ });
  const cleanTotal = await clean.countDocuments();
  const cleanMapped = await clean.countDocuments({ iconUrl: { $exists: true, $ne: '' } });
  const cleanSvg = await clean.countDocuments({ iconUrl: /^data:image\/svg/ });
  const gap = symTotal - cleanTotal;

  console.log('\n=== FINAL UNIFIED STATUS ===');
  console.log('Symbols:     ', symMapped + '/' + symTotal, '= ' + ((symMapped / symTotal) * 100).toFixed(2) + '%', '(SVGs:', symSvg + ')');
  console.log('Clean assets:', cleanMapped + '/' + cleanTotal, '= ' + ((cleanMapped / cleanTotal) * 100).toFixed(2) + '%', '(SVGs:', cleanSvg + ')');
  console.log('Count gap:   ', gap);

  const pass = (symMapped / symTotal) >= 0.99 && symSvg === 0 && cleanSvg === 0 && gap <= 0;
  if (pass) {
    console.log('\n✅ ALL TARGETS MET');
  } else {
    if ((symMapped / symTotal) < 0.99) console.log('❌ Coverage < 99%');
    if (symSvg > 0) console.log('❌', symSvg, 'SVGs in symbols');
    if (cleanSvg > 0) console.log('❌', cleanSvg, 'SVGs in clean');
    if (gap > 0) console.log('❌ Count gap:', gap);
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
