// scripts/fix-priority-scores.js
// Run: mongosh 'mongodb://10.122.0.2:27017/tradereplay' --quiet --file scripts/fix-priority-scores.js
print('=== FIXING PRIORITY SCORES (India first) ===');

// Tier 1: India NSE primary listings (highest priority — we're India-based)
const r1 = db.cleanassets.updateMany(
  { country: 'IN', exchange: 'NSE', type: 'stock' },
  [{ $set: { priorityScore: { $add: [{ $ifNull: ['$marketCap', 0] }, 1e13] } } }]
);
print('India NSE stocks:', r1.modifiedCount);

// Tier 2: India BSE stocks
const r2 = db.cleanassets.updateMany(
  { country: 'IN', exchange: 'BSE', type: 'stock' },
  [{ $set: { priorityScore: { $add: [{ $ifNull: ['$marketCap', 0] }, 5e12] } } }]
);
print('India BSE stocks:', r2.modifiedCount);

// Tier 3: Other India listings (CFD, indices, etc.)
const r3 = db.cleanassets.updateMany(
  { country: 'IN', type: 'stock', exchange: { $nin: ['NSE', 'BSE'] } },
  [{ $set: { priorityScore: { $add: [{ $ifNull: ['$marketCap', 0] }, 1e12] } } }]
);
print('India other stocks:', r3.modifiedCount);

// Tier 4: US large caps (>$10B)
const r4 = db.cleanassets.updateMany(
  { country: 'US', type: 'stock', marketCap: { $gt: 1e10 } },
  [{ $set: { priorityScore: { $add: [{ $ifNull: ['$marketCap', 0] }, 1e11] } } }]
);
print('US large caps:', r4.modifiedCount);

// Tier 5: Other countries with marketCap
const r5 = db.cleanassets.updateMany(
  { country: { $nin: ['IN', 'US'] }, type: 'stock', marketCap: { $gt: 0 } },
  [{ $set: { priorityScore: { $ifNull: ['$marketCap', 0] } } }]
);
print('Other countries:', r5.modifiedCount);

// Top 10 verification
print('\n=== TOP 10 BY NEW PRIORITY (type=stock) ===');
db.cleanassets.find({ type: 'stock' }, { symbol: 1, country: 1, exchange: 1, priorityScore: 1, marketCap: 1 })
  .sort({ priorityScore: -1 }).limit(10).forEach(s =>
    print('  ' + s.symbol + ' ' + (s.country||'?') + '/' + (s.exchange||'?') + ' prio=' + s.priorityScore.toExponential(3) + ' mcap=' + s.marketCap));
