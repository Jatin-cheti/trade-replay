// Pre-Loop 5 baseline — run via mongosh
const out = {};

// 1. By country
out.by_country_top = db.symbols.aggregate([
  { $group: { _id: '$country', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 30 }
]).toArray();

// 2. India breakdown
out.in_breakdown = db.symbols.aggregate([
  { $match: { country: 'IN' } },
  { $group: {
    _id: { exchange: '$exchange', type: '$type', segment: '$segment' },
    count: { $sum: 1 },
    has_logo: { $sum: { $cond: [{ $and: [{ $ne: ['$iconUrl', null] }, { $ne: ['$iconUrl', ''] }] }, 1, 0] } },
    has_isin: { $sum: { $cond: [{ $ne: ['$isin', null] }, 1, 0] } },
    has_sector: { $sum: { $cond: [{ $ne: ['$sector', null] }, 1, 0] } },
    has_marketCap: { $sum: { $cond: [{ $ne: ['$marketCap', null] }, 1, 0] } }
  }},
  { $sort: { count: -1 } }
]).toArray();

// 3. Facet coverage
out.facets = db.symbols.aggregate([
  { $facet: {
    global:  [{ $count: 'n' }],
    india:   [{ $match: { country: 'IN' } }, { $count: 'n' }],
    us:      [{ $match: { country: 'US' } }, { $count: 'n' }],
    nse_stock: [{ $match: { country: 'IN', exchange: 'NSE', type: 'stock' } }, { $count: 'n' }],
    bse_stock: [{ $match: { country: 'IN', exchange: 'BSE', type: 'stock' } }, { $count: 'n' }],
    mf:      [{ $match: { country: 'IN', type: 'mutualfund' } }, { $count: 'n' }],
    futures: [{ $match: { country: 'IN', type: 'futures' } }, { $count: 'n' }],
    options: [{ $match: { country: 'IN', type: 'options' } }, { $count: 'n' }],
    bonds:   [{ $match: { country: 'IN', type: 'bond' } }, { $count: 'n' }]
  }}
]).toArray()[0];

// 4. Audit log
out.audit = {
  total: db.enrichment_audit_log.countDocuments({}),
  null_overwrite_bug: db.enrichment_audit_log.countDocuments({ reason_code: 'NULL_OVERWRITE_BUG' }),
  weak_source_bug: db.enrichment_audit_log.countDocuments({ reason_code: 'WEAK_SOURCE_OVERWRITE_BUG' }),
  positive_confidence: db.enrichment_audit_log.countDocuments({ new_confidence: { $gt: 0 } }),
  zero_confidence: db.enrichment_audit_log.countDocuments({ new_confidence: 0 }),
  by_reason: db.enrichment_audit_log.aggregate([
    { $group: { _id: '$reason_code', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray()
};

// 5. Dupes
out.dupes = db.symbols.aggregate([
  { $group: { _id: '$fullSymbol', count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
  { $count: 'n' }
]).toArray();

// 6. Source names
out.source_names = db.symbols.distinct('sourceName').filter(x => x);

// 7. Indexes
out.indexes = db.symbols.getIndexes().map(i => ({ name: i.name, key: i.key, unique: i.unique || false }));

out.timestamp = new Date().toISOString();
print(JSON.stringify(out, null, 2));
