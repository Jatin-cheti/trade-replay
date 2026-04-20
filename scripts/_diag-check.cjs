/**
 * Diagnostic: Check cleanassets docs for key symbols
 * Usage: node scripts/_diag-check.cjs
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

function loadEnv() {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    if (!k || process.env[k]) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}
loadEnv();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const SYMS = ["NVDA", "MSFT", "AAPL", "TSLA", "META", "AMZN", "NFLX", "GOOGL"];
const FIELDS = ["symbol", "fullSymbol", "pe", "dividendYield", "roe", "revenueGrowth", "analystRating", "eps", "epsGrowth", "beta", "avgVolume"];

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const clean = db.collection("cleanassets");

  for (const sym of SYMS) {
    const doc = await clean.findOne({
      $or: [
        { symbol: sym },
        { fullSymbol: sym },
        { symbol: new RegExp(`(^|:)${sym}$`, "i") },
        { fullSymbol: new RegExp(`(^|:)${sym}$`, "i") },
      ]
    });
    if (!doc) {
      console.log(`${sym}: NOT FOUND in cleanassets`);
      continue;
    }
    const picked = {};
    for (const f of FIELDS) picked[f] = doc[f] !== undefined ? doc[f] : "MISSING";
    console.log(`${sym}:`, JSON.stringify(picked));
  }

  // Also show counts
  const total = await clean.countDocuments({});
  const hasPe = await clean.countDocuments({ pe: { $ne: null, $exists: true } });
  const hasAnalyst = await clean.countDocuments({ analystRating: { $ne: null, $ne: "", $exists: true } });
  console.log(`\ncleanassets total=${total} | with pe=${hasPe} | with analystRating=${hasAnalyst}`);

  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
