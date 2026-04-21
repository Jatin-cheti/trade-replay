// Runs via: mongosh <uri> --quiet _baseline-loop4.js
const out = {};
const coll = db.getCollection('cleanassets');
const auditColl = db.getCollection('enrichment_audit_log');

out.global_active = coll.countDocuments({ isActive: true });
out.global_total = coll.estimatedDocumentCount();

out.by_country_top = coll.aggregate([
  { $match: { isActive: true } },
  { $group: { _id: '$country', n: { $sum: 1 } } },
  { $sort: { n: -1 } },
  { $limit: 15 }
]).toArray();

out.in_by_exchange_type = coll.aggregate([
  { $match: { country: 'IN', isActive: true } },
  { $group: { _id: { exchange: '$exchange', type: '$type' }, n: { $sum: 1 } } },
  { $sort: { n: -1 } }
]).toArray();

out.in_total = coll.countDocuments({ country: 'IN', isActive: true });
out.us_total = coll.countDocuments({ country: 'US', isActive: true });

out.in_enrichment = coll.aggregate([
  { $match: { country: 'IN', isActive: true } },
  { $group: {
      _id: null,
      total: { $sum: 1 },
      has_logo: { $sum: { $cond: [{ $and: [ { $ne: ['$iconUrl', null] }, { $ne: ['$iconUrl', ''] } ] }, 1, 0] } },
      has_sector: { $sum: { $cond: [{ $and: [ { $ne: ['$sector', null] }, { $ne: ['$sector', ''] } ] }, 1, 0] } },
      has_industry: { $sum: { $cond: [{ $and: [ { $ne: ['$industry', null] }, { $ne: ['$industry', ''] } ] }, 1, 0] } },
      has_mcap: { $sum: { $cond: [{ $ne: ['$marketCap', null] }, 1, 0] } },
      has_pe: { $sum: { $cond: [{ $ne: ['$pe', null] }, 1, 0] } },
      has_name: { $sum: { $cond: [{ $and: [ { $ne: ['$companyName', null] }, { $ne: ['$companyName', ''] } ] }, 1, 0] } }
  } }
]).toArray();

out.dupe_fullsymbol = coll.aggregate([
  { $match: { isActive: true } },
  { $group: { _id: '$fullSymbol', n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } },
  { $count: 'dupes' }
]).toArray();

out.audit_log = {
  total: auditColl.countDocuments({}),
  null_overwrite_bug: auditColl.countDocuments({ reason_code: 'NULL_OVERWRITE_BUG' }),
  weak_source_bug: auditColl.countDocuments({ reason_code: 'WEAK_SOURCE_OVERWRITE_BUG' })
};

out.timestamp = new Date().toISOString();
print(JSON.stringify(out, null, 2));
