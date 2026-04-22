#!/bin/bash
set -e
printf '/ %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
printf '/screener/stocks %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/screener/stocks)"
printf '/symbol/NSE:RELIANCE %s\n' "$(curl -s -o /dev/null -w '%{http_code}' 'http://localhost:3000/symbol/NSE%3ARELIANCE')"
printf '/api/health %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health)"
mongosh "mongodb://localhost:27017/tradereplay" --quiet <<'NODE'
const total = db.getCollection('cleanassets').countDocuments({});
const logo = db.getCollection('cleanassets').countDocuments({ iconUrl: { $exists: true, $nin: [null, ''] } });
const top500 = db.getCollection('cleanassets').find({ marketCap: { $gt: 0 } }).sort({ marketCap: -1 }).limit(500).toArray();
const top500Logo = top500.filter(s => s.iconUrl && s.iconUrl.trim()).length;
print(`Logo coverage: ${logo}/${total} (${(logo/total*100).toFixed(1)}%)`);
print(`Top 500 by mktcap: ${top500Logo}/500 (${(top500Logo/5).toFixed(1)}%)`);
NODE
