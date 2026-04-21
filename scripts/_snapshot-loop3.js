// Loop 3 baseline snapshot
const out = {
  ts: new Date().toISOString(),
  global_active: db.cleanassets.countDocuments({ isActive: true }),
  in_total: db.cleanassets.countDocuments({ country: "IN", isActive: true }),
  in_stock: db.cleanassets.countDocuments({ country: "IN", type: "stock", isActive: true }),
  in_mutualfund: db.cleanassets.countDocuments({ country: "IN", type: "mutualfund" }),
  in_by_type: db.cleanassets.aggregate([
    { $match: { country: "IN", isActive: true } },
    { $group: { _id: "$type", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]).toArray(),
  us_stock: db.cleanassets.countDocuments({ country: "US", type: "stock", isActive: true }),
  us_total: db.cleanassets.countDocuments({ country: "US", isActive: true }),
  audit_log_docs: db.enrichment_audit_log.countDocuments({}),
  audit_recent: db.enrichment_audit_log.find({}).sort({ updatedAt: -1 }).limit(3).toArray(),
};
print(JSON.stringify(out, null, 2));
