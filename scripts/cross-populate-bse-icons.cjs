// Cross-populate iconUrl on BSE symbols from their NSE twin matched by ISIN or symbol.
// Read-then-write on cleanassets. No external API calls.
const { MongoClient } = require('mongodb');
const URI = process.env.MONGO_URI || 'mongodb://10.122.0.2:27017/tradereplay';

(async () => {
  const c = await MongoClient.connect(URI);
  const db = c.db();
  const col = db.collection('cleanassets');

  // BSE stocks without iconUrl that have an ISIN
  const bseMissing = await col.find(
    { exchange: 'BSE', country: 'IN', type: 'stock', isActive: true,
      $or: [{ iconUrl: { $in: ['', null] } }, { iconUrl: { $exists: false } }] },
    { projection: { symbol: 1, isin: 1 } }
  ).toArray();
  console.log('BSE missing iconUrl:', bseMissing.length);

  // Build NSE lookup (both by isin and by symbol)
  const nseAll = await col.find(
    { exchange: 'NSE', country: 'IN', type: 'stock', isActive: true,
      iconUrl: { $exists: true, $nin: ['', null] } },
    { projection: { symbol: 1, isin: 1, iconUrl: 1, name: 1, logoSource: 1 } }
  ).toArray();
  const byIsin = new Map();
  const bySym = new Map();
  for (const n of nseAll) {
    if (n.isin) byIsin.set(n.isin, n);
    if (n.symbol) bySym.set(String(n.symbol).toUpperCase(), n);
  }
  console.log('NSE with iconUrl:', nseAll.length, 'isinKeys=', byIsin.size);

  let matched = 0, updated = 0;
  const ops = [];
  for (const b of bseMissing) {
    const src = (b.isin && byIsin.get(b.isin)) || bySym.get(String(b.symbol || '').toUpperCase());
    if (!src) continue;
    matched++;
    ops.push({
      updateOne: {
        filter: { _id: b._id },
        update: { $set: { iconUrl: src.iconUrl, logoSource: 'bse-nse-mirror', logoMirroredFrom: `NSE:${src.symbol}` } }
      }
    });
    if (ops.length >= 500) {
      const r = await col.bulkWrite(ops);
      updated += r.modifiedCount;
      ops.length = 0;
    }
  }
  if (ops.length) {
    const r = await col.bulkWrite(ops);
    updated += r.modifiedCount;
  }
  console.log('matched', matched, 'updated', updated);
  await c.close();
})().catch(e => { console.error(e); process.exit(1); });
