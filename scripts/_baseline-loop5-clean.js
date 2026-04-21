const out = {};
out.collections = db.getCollectionNames();
out.counts = {};
["symbols","cleanassets","enrichment_audit_log","missinglogos"].forEach(c => {
  try { out.counts[c] = db.getCollection(c).estimatedDocumentCount(); } catch(e){ out.counts[c]="N/A"; }
});
out.cleanassets_total = db.cleanassets.estimatedDocumentCount();
out.cleanassets_in = db.cleanassets.countDocuments({country:"IN"});
out.cleanassets_in_active = db.cleanassets.countDocuments({country:"IN",isActive:true});
out.cleanassets_in_by_exchange = db.cleanassets.aggregate([{$match:{country:"IN",isActive:true}},{$group:{_id:"$exchange",n:{$sum:1}}},{$sort:{n:-1}}]).toArray();
out.cleanassets_in_by_type = db.cleanassets.aggregate([{$match:{country:"IN",isActive:true}},{$group:{_id:"$type",n:{$sum:1}}},{$sort:{n:-1}}]).toArray();
out.cleanassets_global = db.cleanassets.countDocuments({isActive:true});
out.cleanassets_us = db.cleanassets.countDocuments({country:"US",isActive:true});
out.cleanassets_sources = db.cleanassets.distinct("sourceName").filter(x=>x).slice(0,30);
out.cleanassets_sample_in = db.cleanassets.findOne({country:"IN",exchange:"BSE"},{fullSymbol:1,symbol:1,companyName:1,name:1,isin:1,nseSymbol:1,sourceName:1,marketCap:1,pe:1,sector:1,iconUrl:1});
out.dupes_clean = db.cleanassets.aggregate([{$match:{isActive:true}},{$group:{_id:"$fullSymbol",n:{$sum:1}}},{$match:{n:{$gt:1}}},{$count:"n"}]).toArray();
printjson(out);
