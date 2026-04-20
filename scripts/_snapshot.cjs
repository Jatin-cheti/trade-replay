// Live DB snapshot + null rates + ingestion counts
const { MongoClient } = require("mongodb");
const URI = process.env.MONGO_URI || "mongodb://10.122.0.2:27017/tradereplay";
(async () => {
  const c = new MongoClient(URI);
  await c.connect();
  const ca = c.db().collection("cleanassets");

  const totalActive = await ca.countDocuments({ isActive: true });
  const total = await ca.estimatedDocumentCount();

  const byType = await ca.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: "$type", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]).toArray();

  const byCountry = await ca.aggregate([
    { $match: { isActive: true, type: "stock" } },
    { $group: { _id: "$country", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]).toArray();

  // Null rates on real US stock set
  const nullFields = ["price", "pe", "eps", "marketCap", "volume", "avgVolume", "dividendYield", "beta", "roe", "earningsGrowth", "epsGrowth", "revenue", "revenueGrowth", "analystRating", "peg", "industry", "sector"];

  async function nullRate(match, label) {
    const n = await ca.countDocuments(match);
    const out = { _: label, n };
    for (const f of nullFields) {
      const nulls = await ca.countDocuments({ ...match, $or: [{ [f]: null }, { [f]: "" }, { [f]: { $exists: false } }] });
      out[f] = n ? ((nulls / n) * 100).toFixed(1) + "%" : "-";
    }
    return out;
  }

  const us = await nullRate({ isActive: true, type: "stock", country: "US" }, "US stocks");
  const inStk = await nullRate({ isActive: true, type: "stock", country: "IN" }, "IN stocks");

  // Logo quality
  const withIcon = await ca.countDocuments({ isActive: true, iconUrl: { $ne: "", $exists: true } });
  const withS3 = await ca.countDocuments({ isActive: true, s3Icon: { $ne: "", $exists: true } });
  const gFav128 = await ca.countDocuments({ isActive: true, iconUrl: /sz=128/ });
  const gFav64 = await ca.countDocuments({ isActive: true, iconUrl: /sz=64/ });
  const gFav256 = await ca.countDocuments({ isActive: true, iconUrl: /sz=256/ });
  const clearbit = await ca.countDocuments({ isActive: true, iconUrl: /logo\.clearbit\.com|logo\.dev/i });
  const noLogo = await ca.countDocuments({ isActive: true, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] });
  const lowTier = await ca.countDocuments({ isActive: true, logoTier: { $lte: 2 } });
  const highTier = await ca.countDocuments({ isActive: true, logoTier: { $gte: 3 } });

  console.log(JSON.stringify({
    snapshot_ts: new Date().toISOString(),
    total_docs: total,
    total_active: totalActive,
    by_type: byType,
    by_country_stocks: byCountry,
    null_rates: { us, in: inStk },
    logos: { withIcon, withS3, gFav64, gFav128, gFav256, clearbit_logodev: clearbit, noLogo, lowTier_lte2: lowTier, highTier_gte3: highTier },
  }, null, 2));

  await c.close();
})();
