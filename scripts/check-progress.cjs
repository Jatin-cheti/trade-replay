const { MongoClient } = require("mongodb");
const path = require("path");
const fs = require("fs");
function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    let val = t.slice(eq + 1).trim();
    if ((val[0] === '"' && val.at(-1) === '"') || (val[0] === "'" && val.at(-1) === "'")) val = val.slice(1, -1);
    process.env[key] = val;
  }
}
loadEnvFile();
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
(async () => {
  const c = await MongoClient.connect(MONGO_URI);
  const db = c.db();
  const ca = db.collection("cleanassets");
  const total = await ca.countDocuments({ type: "stock" });
  const fields = [
    "marketCap", "pe", "eps", "beta", "sector", "avgVolume",
    "revenue", "netIncome", "epsGrowth", "revenueGrowth",
    "roe", "dividendYield", "analystRating", "companyDomain", "iconUrl"
  ];
  console.log(`Stocks total: ${total}\n`);
  for (const f of fields) {
    const hasFilled = await ca.countDocuments({
      type: "stock",
      [f]: { $exists: true, $ne: null, $ne: "", $nin: [0] }
    });
    const pct = ((hasFilled / total) * 100).toFixed(1);
    console.log(`  ${f.padEnd(16)} ${hasFilled.toString().padStart(6)} / ${total} (${pct}%)`);
  }
  await c.close();
})();
