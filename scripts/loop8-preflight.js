// scripts/loop8-preflight.js
// Run: mongosh 'mongodb://10.122.0.2:27017/tradereplay' --quiet scripts/loop8-preflight.js

const col = db.getCollection('cleanassets');

const total      = col.countDocuments({});
const isActive   = col.countDocuments({ isActive: true });
const s3Has      = col.countDocuments({ s3Icon: { $exists: true, $nin: [null, ''] } });
const fmpHas     = col.countDocuments({ fmpIcon: { $exists: true, $nin: [null, ''] } });
const clearbit   = col.countDocuments({ iconUrl: /clearbit/ });
const logoDev    = col.countDocuments({ iconUrl: /logo\.dev/ });
const googleFav  = col.countDocuments({ iconUrl: /google\.com\/s2\/favicons/ });
const ddg        = col.countDocuments({ iconUrl: /duckduckgo\.com/ });
const fmpImg     = col.countDocuments({ iconUrl: /financialmodelingprep\.com\/image-stock/ });
const s3direct   = col.countDocuments({ iconUrl: /s3\.|amazonaws\.com|cloudfront/ });
const nullOrEmpty= col.countDocuments({ $or: [{ iconUrl: null }, { iconUrl: '' }, { iconUrl: { $exists: false } }] });
const realUsable = total - clearbit - logoDev - nullOrEmpty;

print('=== LOGO AUDIT ===');
print(JSON.stringify({ total, isActive, s3Has, fmpHas, clearbit, logoDev, googleFav, ddg, fmpImg, s3direct, nullOrEmpty, realUsable }, null, 2));

print('\n=== TYPE BREAKDOWN ===');
col.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }, { $sort: { n: -1 } }]).forEach(r => print(r._id + ': ' + r.n));

print('\n=== TOP COUNTRIES ===');
col.aggregate([{ $group: { _id: '$country', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }]).forEach(r => print((r._id||'?') + ': ' + r.n));

print('\n=== INDIA BREAKDOWN ===');
const inTotal   = col.countDocuments({ country: 'IN' });
const inStock   = col.countDocuments({ country: 'IN', type: 'stock' });
const inActive  = col.countDocuments({ country: 'IN', isActive: true });
const inNSE     = col.countDocuments({ country: 'IN', exchange: 'NSE' });
const inBSE     = col.countDocuments({ country: 'IN', exchange: 'BSE' });
print(JSON.stringify({ inTotal, inStock, inActive, inNSE, inBSE }));

print('\n=== TOP 10 BY MARKETCAP ===');
col.find({ marketCap: { $gt: 0 } }, { symbol: 1, fullSymbol: 1, name: 1, country: 1, exchange: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1, websiteUrl: 1, marketCap: 1, priorityScore: 1 })
   .sort({ marketCap: -1 }).limit(10).forEach(s => {
  print([
    s.symbol,
    '| ' + (s.country||'?') + '/' + (s.exchange||'?'),
    '| mcap=' + (s.marketCap/1e9).toFixed(1) + 'B',
    '| icon=' + ((s.iconUrl||'NONE').substring(0, 60)),
    '| dom=' + (s.companyDomain||s.websiteUrl||'-')
  ].join(' '));
});

print('\n=== TOP 10 BY PRIORITY ===');
col.find({}, { symbol: 1, country: 1, priorityScore: 1, marketCap: 1 })
   .sort({ priorityScore: -1 }).limit(10).forEach(s => print(s.symbol + ' ' + (s.country||'?') + ' prio=' + s.priorityScore + ' mcap=' + s.marketCap));

print('\n=== TOP 10 INDIA BY MARKETCAP ===');
col.find({ country: 'IN', marketCap: { $gt: 0 } }, { symbol: 1, name: 1, exchange: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1, marketCap: 1 })
   .sort({ marketCap: -1 }).limit(10).forEach(s => {
  print([
    s.symbol,
    '| ' + (s.exchange||'?'),
    '| mcap=' + (s.marketCap/1e9).toFixed(1) + 'B',
    '| icon=' + ((s.iconUrl||'NONE').substring(0, 60)),
    '| dom=' + (s.companyDomain||'-')
  ].join(' '));
});
