/**
 * Quick check: what fields do cleanassets have vs symbols for top stocks?
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    process.env[key] = val;
  }
}
loadEnvFile();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  // Check AAPL in cleanassets
  const aapl = await db.collection("cleanassets").findOne(
    { symbol: "AAPL" },
    { projection: { _id: 0 } }
  );
  console.log("CLEANASSET AAPL:", JSON.stringify(aapl, null, 2));

  // Check null rates in cleanassets for stocks
  const caStocks = await db.collection("cleanassets").countDocuments({ type: "stock" });
  console.log(`\nCLEANASSET STOCK NULL RATES (total: ${caStocks}):`);
  const fields = ["marketCap","volume","pe","eps","epsGrowth","dividendYield","netIncome","revenue",
    "sharesFloat","beta","revenueGrowth","roe","avgVolume","analystRating","sector","iconUrl","s3Icon",
    "companyDomain","price","change","changePercent"];

  for (const f of fields) {
    const missing = await db.collection("cleanassets").countDocuments({
      type: "stock",
      $or: [
        { [f]: { $exists: false } },
        { [f]: null },
        { [f]: "" },
        { [f]: 0 }
      ]
    });
    const pct = ((missing / caStocks) * 100).toFixed(1);
    console.log(`  ${f}: missing=${missing}/${caStocks} (${pct}%)`);
  }

  // Check how screener aggregation works - sample a few docs
  const sample = await db.collection("cleanassets").find(
    { type: "stock", marketCap: { $gt: 0 } }
  ).sort({ marketCap: -1 }).limit(5).project({ _id: 0, symbol: 1, marketCap: 1, pe: 1, eps: 1, sector: 1, beta: 1, avgVolume: 1, price: 1, volume: 1 }).toArray();
  console.log("\nTOP 5 STOCKS WITH MARKETCAP IN CLEANASSETS:", JSON.stringify(sample, null, 2));

  await client.close();
}
main().catch(e => console.error(e));
