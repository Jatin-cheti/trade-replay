// Loop 6 baseline: logo coverage against cleanassets (authoritative)
const ca = db.cleanassets;
const total = ca.countDocuments({ isActive: true });
const hasLogo = ca.countDocuments({ isActive: true, iconUrl: { $exists: true, $ne: null, $nin: [""] } });
const inTotal = ca.countDocuments({ isActive: true, country: "IN" });
const inLogo = ca.countDocuments({ isActive: true, country: "IN", iconUrl: { $exists: true, $ne: null, $nin: [""] } });
const usTotal = ca.countDocuments({ isActive: true, country: "US" });
const usLogo = ca.countDocuments({ isActive: true, country: "US", iconUrl: { $exists: true, $ne: null, $nin: [""] } });
const top500 = ca.find({ isActive: true, marketCap: { $gt: 0 } }).sort({ marketCap: -1 }).limit(500).toArray();
const top500Logo = top500.filter(s => s.iconUrl && s.iconUrl.trim()).length;
const samples = ca.find({ isActive: true, iconUrl: { $exists: true, $ne: null, $nin: [""] } }, { fullSymbol: 1, iconUrl: 1, name: 1, exchange: 1 }).limit(5).toArray();
const noLogoSamples = ca.find({ isActive: true, marketCap: { $gt: 1e9 }, $or: [{ iconUrl: null }, { iconUrl: "" }, { iconUrl: { $exists: false } }] }, { fullSymbol: 1, name: 1, marketCap: 1, exchange: 1, country: 1 }).sort({ marketCap: -1 }).limit(5).toArray();
print(JSON.stringify({
  total, hasLogo, logoPct: (hasLogo / total * 100).toFixed(1),
  inTotal, inLogo, inPct: (inLogo / inTotal * 100).toFixed(1),
  usTotal, usLogo, usPct: (usLogo / usTotal * 100).toFixed(1),
  top500Logo, top500TotalWithMcap: top500.length,
  samples, noLogoSamples
}, null, 2));
