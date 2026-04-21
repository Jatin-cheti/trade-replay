// scripts/loop8-emit-failed.js
// After waterfall finishes, rebuild missing-logos.txt from the DB
'use strict';
const fs = require('fs');
const { MongoClient } = require('mongodb');
const URI = process.env.MONGO_URI_PRODUCTION || 'mongodb://10.122.0.2:27017/tradereplay';

(async () => {
  const c = new MongoClient(URI);
  await c.connect();
  const col = c.db().collection('cleanassets');

  // Any stock where logoVerified !== true OR iconUrl is dead
  const DEAD = /clearbit|logo\.dev|ui-avatars|logo\.uplead/i;
  const docs = await col.find(
    { type: 'stock', $or: [
      { logoVerified: { $ne: true } },
      { iconUrl: { $in: [null, ''] } },
      { iconUrl: { $exists: false } },
      { iconUrl: /clearbit|logo\.dev|ui-avatars|logo\.uplead/i }
    ] },
    { projection: { symbol: 1, name: 1, exchange: 1, country: 1, companyDomain: 1, websiteUrl: 1, iconUrl: 1, marketCap: 1 } }
  ).sort({ marketCap: -1 }).toArray();

  console.log('Total stocks without verified real logo:', docs.length);

  const lines = ['SYMBOL\tEXCHANGE\tCOUNTRY\tMARKETCAP\tDOMAIN\tCURRENT_ICON\tNAME'];
  for (const d of docs) {
    lines.push([
      d.symbol || '?',
      d.exchange || '?',
      d.country || '?',
      d.marketCap || 0,
      d.companyDomain || d.websiteUrl || '',
      (d.iconUrl || '').substring(0, 80),
      (d.name || '').substring(0, 60)
    ].join('\t'));
  }
  fs.writeFileSync('/opt/tradereplay/missing-logos.txt', lines.join('\n'));
  console.log('Wrote /opt/tradereplay/missing-logos.txt with', docs.length, 'rows');

  // Also print top 50 failing symbols
  console.log('\n=== TOP 50 FAILING BY MARKETCAP ===');
  for (const d of docs.slice(0, 50)) {
    console.log('  ' + d.symbol + ' [' + (d.exchange||'?') + '/' + (d.country||'?') + '] mcap=' + ((d.marketCap||0)/1e9).toFixed(1) + 'B dom=' + (d.companyDomain||'-'));
  }

  await c.close();
})();
