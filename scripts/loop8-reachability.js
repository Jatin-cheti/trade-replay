// scripts/loop8-reachability.js
// Usage: node /tmp/loop8-reachability.js
'use strict';
const https = require('https');
const http = require('http');
const { MongoClient } = require('mongodb');
const URI = 'mongodb://10.122.0.2:27017/tradereplay';

function check(url) {
  return new Promise(res => {
    if (!url || !url.startsWith('http')) return res({ ok:false, status:0 });
    const lib = url.startsWith('https') ? https : http;
    let done=false;
    const req = lib.get(url, { timeout: 6000 }, r => {
      if (done) return;
      done=true;
      const ok = r.statusCode===200 || r.statusCode===301 || r.statusCode===302;
      res({ ok, status: r.statusCode });
      r.resume();
    });
    req.on('error', () => { if(!done){done=true;res({ok:false,status:-1});} });
    req.on('timeout', () => { if(!done){done=true;req.destroy();res({ok:false,status:-2});} });
  });
}

(async () => {
  const c = new MongoClient(URI);
  await c.connect();
  const col = c.db().collection('cleanassets');
  const docs = await col.find({ marketCap:{$gt:0}, iconUrl:{$exists:true,$nin:[null,'']}, type:'stock' })
    .sort({ marketCap:-1 }).limit(30)
    .project({ symbol:1, country:1, iconUrl:1, companyDomain:1 }).toArray();
  let ok=0, fail=0;
  await Promise.all(docs.map(async d => {
    const r = await check(d.iconUrl);
    const tag = r.ok ? 'OK' : ('FAIL_' + r.status);
    if (r.ok) ok++; else fail++;
    console.log(tag.padEnd(10), d.symbol.padEnd(14), (d.country||'?').padEnd(4), (d.iconUrl||'').substring(0,80));
  }));
  console.log('\nReachable:', ok, '/', docs.length, 'Failed:', fail);
  await c.close();
})();
