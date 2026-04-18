/**
 * Fix logo quality issues found in audit:
 * 1. Replace bogus *priority.com Clearbit domains with FMP/exchange fallback
 * 2. Replace placeholder URLs
 * 3. Fix HDFC
 */
const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/tradereplay').then(async () => {
  const db = mongoose.connection.db;
  const symbols = db.collection('symbols');
  const clean = db.collection('cleanassets');

  console.log('=== FIXING LOGO QUALITY ISSUES ===\n');

  // 1. Fix bogus *priority.com Clearbit domains
  const bogusPattern = /priority\.com$/;
  const bogusDocs = await symbols.countDocuments({ iconUrl: { $regex: 'clearbit\\.com.*priority\\.com' } });
  console.log('1. Bogus priority.com Clearbit logos:', bogusDocs);

  // Replace with FMP stock image URL (works for most stocks)
  let fixedBogus = 0;
  const bogusCursor = symbols.find({ iconUrl: { $regex: 'clearbit\\.com.*priority\\.com' } })
    .project({ _id: 1, symbol: 1, exchange: 1, type: 1 })
    .batchSize(5000);

  let bogusBatch = [];
  for await (const doc of bogusCursor) {
    // For these symbols, use FMP stock image which has good coverage
    const baseSymbol = doc.symbol.replace(/[^A-Z0-9]/g, '').substring(0, 10);
    let newUrl;

    if (doc.type === 'crypto') {
      newUrl = `https://www.google.com/s2/favicons?domain=${baseSymbol.toLowerCase()}.org&sz=128`;
    } else {
      newUrl = `https://financialmodelingprep.com/image-stock/${baseSymbol}.png`;
    }

    bogusBatch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { iconUrl: newUrl } }
      }
    });

    if (bogusBatch.length >= 2000) {
      const r = await symbols.bulkWrite(bogusBatch, { ordered: false });
      fixedBogus += r.modifiedCount;
      bogusBatch = [];
    }
  }
  if (bogusBatch.length > 0) {
    const r = await symbols.bulkWrite(bogusBatch, { ordered: false });
    fixedBogus += r.modifiedCount;
  }
  console.log('  Fixed:', fixedBogus);

  // Same for clean assets
  const bogusCleanCount = await clean.countDocuments({ iconUrl: { $regex: 'clearbit\\.com.*priority\\.com' } });
  console.log('  Bogus in clean_assets:', bogusCleanCount);
  
  let fixedBogusClean = 0;
  const bogusCleanCursor = clean.find({ iconUrl: { $regex: 'clearbit\\.com.*priority\\.com' } })
    .project({ _id: 1, symbol: 1, exchange: 1, type: 1 })
    .batchSize(5000);

  let bogusCleanBatch = [];
  for await (const doc of bogusCleanCursor) {
    const baseSymbol = doc.symbol.replace(/[^A-Z0-9]/g, '').substring(0, 10);
    let newUrl;
    if (doc.type === 'crypto') {
      newUrl = `https://www.google.com/s2/favicons?domain=${baseSymbol.toLowerCase()}.org&sz=128`;
    } else {
      newUrl = `https://financialmodelingprep.com/image-stock/${baseSymbol}.png`;
    }

    bogusCleanBatch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { iconUrl: newUrl } }
      }
    });

    if (bogusCleanBatch.length >= 2000) {
      const r = await clean.bulkWrite(bogusCleanBatch, { ordered: false });
      fixedBogusClean += r.modifiedCount;
      bogusCleanBatch = [];
    }
  }
  if (bogusCleanBatch.length > 0) {
    const r = await clean.bulkWrite(bogusCleanBatch, { ordered: false });
    fixedBogusClean += r.modifiedCount;
  }
  console.log('  Fixed in clean:', fixedBogusClean);

  // 2. Fix placeholder URLs
  console.log('\n2. Placeholder URLs:');
  const placeholderDocs = symbols.find({ iconUrl: /placeholder|default|blank|dummy/i })
    .project({ _id: 1, symbol: 1, exchange: 1, iconUrl: 1 })
    .batchSize(1000);

  let fixedPlaceholder = 0;
  let phBatch = [];
  for await (const doc of placeholderDocs) {
    const baseSymbol = doc.symbol.replace(/[^A-Z0-9]/g, '').substring(0, 10);
    const newUrl = `https://financialmodelingprep.com/image-stock/${baseSymbol}.png`;

    phBatch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { iconUrl: newUrl } }
      }
    });
  }
  if (phBatch.length > 0) {
    const r = await symbols.bulkWrite(phBatch, { ordered: false });
    fixedPlaceholder = r.modifiedCount;
  }
  console.log('  Fixed:', fixedPlaceholder, 'in symbols');

  // Same in clean
  const phCleanDocs = clean.find({ iconUrl: /placeholder|default|blank|dummy/i })
    .project({ _id: 1, symbol: 1, exchange: 1, iconUrl: 1 })
    .batchSize(1000);
  let phCleanBatch = [];
  for await (const doc of phCleanDocs) {
    const baseSymbol = doc.symbol.replace(/[^A-Z0-9]/g, '').substring(0, 10);
    const newUrl = `https://financialmodelingprep.com/image-stock/${baseSymbol}.png`;
    phCleanBatch.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { iconUrl: newUrl } }
      }
    });
  }
  if (phCleanBatch.length > 0) {
    const r = await clean.bulkWrite(phCleanBatch, { ordered: false });
    console.log('  Fixed:', r.modifiedCount, 'in clean');
  } else {
    console.log('  Fixed: 0 in clean');
  }

  // 3. Fix HDFC
  console.log('\n3. HDFC fix:');
  const hdfcUrl = 'https://www.google.com/s2/favicons?domain=hdfcbank.com&sz=128';
  const hdfcR = await symbols.updateMany({ symbol: 'HDFC', iconUrl: { $in: ['', null] } }, { $set: { iconUrl: hdfcUrl } });
  const hdfcR2 = await symbols.updateMany({ symbol: 'HDFC', iconUrl: { $exists: false } }, { $set: { iconUrl: hdfcUrl } });
  console.log('  Updated:', hdfcR.modifiedCount + hdfcR2.modifiedCount, 'symbols');
  const hdfcC = await clean.updateMany({ symbol: 'HDFC' }, { $set: { iconUrl: hdfcUrl } });
  console.log('  Updated:', hdfcC.modifiedCount, 'clean assets');

  // 4. Also fix other overused bogus domains in Clearbit  
  console.log('\n4. Fixing other overused Clearbit domains:');
  const badDomains = ['usdt.com', 'direxiondaily.com', 'innovatorequity.com', 'ftvest.com', 'isharesmsci.com'];
  let fixedOther = 0;
  for (const domain of badDomains) {
    const count = await symbols.countDocuments({ iconUrl: `https://logo.clearbit.com/${domain}` });
    if (count > 0) {
      // These are ETFs/funds — use exchange favicon or FMP
      const cursor = symbols.find({ iconUrl: `https://logo.clearbit.com/${domain}` })
        .project({ _id: 1, symbol: 1 })
        .batchSize(500);
      
      let batch = [];
      for await (const doc of cursor) {
        const baseSymbol = doc.symbol.replace(/[^A-Z0-9]/g, '').substring(0, 10);
        batch.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { iconUrl: `https://financialmodelingprep.com/image-stock/${baseSymbol}.png` } }
          }
        });
      }
      if (batch.length > 0) {
        const r = await symbols.bulkWrite(batch, { ordered: false });
        fixedOther += r.modifiedCount;
        console.log('  ' + domain + ': fixed', r.modifiedCount);
      }

      // Clean too
      const cleanBatch2 = [];
      const cleanCur = clean.find({ iconUrl: `https://logo.clearbit.com/${domain}` })
        .project({ _id: 1, symbol: 1 })
        .batchSize(500);
      for await (const doc of cleanCur) {
        const baseSymbol = doc.symbol.replace(/[^A-Z0-9]/g, '').substring(0, 10);
        cleanBatch2.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { iconUrl: `https://financialmodelingprep.com/image-stock/${baseSymbol}.png` } }
          }
        });
      }
      if (cleanBatch2.length > 0) {
        await clean.bulkWrite(cleanBatch2, { ordered: false });
      }
    }
  }
  console.log('  Total other overused fixed:', fixedOther);

  // Final verification
  console.log('\n=== POST-FIX VERIFICATION ===');
  const remaining = await symbols.countDocuments({ iconUrl: { $regex: 'clearbit\\.com.*priority\\.com' } });
  const remainingPh = await symbols.countDocuments({ iconUrl: /placeholder|default|blank|dummy/i });
  const total = await symbols.countDocuments();
  const empty = await symbols.countDocuments({ $or: [{ iconUrl: { $exists: false } }, { iconUrl: '' }] });
  const svgs = await symbols.countDocuments({ iconUrl: /^data:image\/svg/ });

  console.log('Bogus priority.com remaining:', remaining);
  console.log('Placeholder remaining       :', remainingPh);
  console.log('Empty/missing               :', empty);
  console.log('Generated SVGs              :', svgs);
  console.log('Coverage                    :', ((total - empty) / total * 100).toFixed(2) + '%');

  const hdfc = await symbols.findOne({ symbol: 'HDFC' });
  console.log('HDFC logo                   :', hdfc ? hdfc.iconUrl.substring(0, 60) : 'NOT FOUND');

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
