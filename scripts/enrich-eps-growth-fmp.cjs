/**
 * Enrich EPS (TTM) and revenue/EPS growth from FMP.
 * Sources:
 *   - /stable/income-statement?period=ttm  → eps, epsDiluted
 *   - /stable/financial-growth              → revenueGrowth, epsgrowth
 *
 * Usage:
 *   node scripts/enrich-eps-growth-fmp.cjs
 *   node scripts/enrich-eps-growth-fmp.cjs --limit=500
 *   node scripts/enrich-eps-growth-fmp.cjs --symbols=NVDA,MSFT,AAPL
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const https = require("https");

/* ── env ──────────────────────────────────────────────────────────── */
function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key]) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[key] = val;
  }
}
loadEnvFile();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";

const FMP_KEYS = [
  process.env.FMP_API_KEY,
  process.env.FMP_KEY_1,
  process.env.FMP_KEY_2,
].filter(Boolean);

if (FMP_KEYS.length === 0) {
  console.error("No FMP keys. Set FMP_API_KEY / FMP_KEY_1 / FMP_KEY_2.");
  process.exit(1);
}
console.log(`EPS+Growth enrichment — using ${FMP_KEYS.length} FMP key(s).`);

const argLimit = process.argv.find(a => a.startsWith("--limit="));
const argSymbols = process.argv.find(a => a.startsWith("--symbols="));
const LIMIT = argLimit ? Number(argLimit.split("=")[1]) : 10000;
const TARGET_SYMBOLS = argSymbols
  ? argSymbols.split("=")[1].split(",").map(s => s.trim().toUpperCase()).filter(Boolean)
  : [];

function baseSymbol(symbol) {
  if (!symbol) return "";
  return String(symbol).split(":").pop().toUpperCase();
}

const DELAY_MS = Math.ceil(9000 / FMP_KEYS.length);
let keyIndex = 0;
const nextKey = () => FMP_KEYS[keyIndex++ % FMP_KEYS.length];

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`JSON parse failed: ${String(data).slice(0, 120)}`)); }
      });
    }).on("error", reject).on("timeout", () => reject(new Error("Timeout")));
  });
}

function normalizeSymbolForFmp(symbol) {
  if (!symbol) return symbol;
  let s = String(symbol).split(":").pop() || String(symbol);
  s = s.replace(/\.(?=[A-Z]$)/, "-");
  s = s.replace(/\.(W|WS|U|RT)$/i, "");
  return s;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const symbolsColl = db.collection("symbols");
  const cleanColl = db.collection("cleanassets");
  const stockTypeQuery = { $or: [{ assetType: "stock" }, { type: "stock" }] };

  let docs = [];
  if (TARGET_SYMBOLS.length) {
    const all = await symbolsColl
      .find(stockTypeQuery, { projection: { symbol: 1, fullSymbol: 1 } })
      .limit(Math.max(LIMIT * 10, 5000))
      .toArray();
    const allClean = await cleanColl
      .find(stockTypeQuery, { projection: { symbol: 1, fullSymbol: 1 } })
      .limit(Math.max(LIMIT * 10, 5000))
      .toArray();
    const merged = [...all, ...allClean];
    const wanted = new Set(TARGET_SYMBOLS.map(s => s.toUpperCase()));
    const seenBase = new Set();
    docs = merged.filter((d) => {
      const sym = String(d.symbol || "").toUpperCase();
      const full = String(d.fullSymbol || "").toUpperCase();
      const base = baseSymbol(sym);
      if (!wanted.has(sym) && !wanted.has(full) && !wanted.has(base)) return false;
      if (seenBase.has(base)) return false;
      seenBase.add(base);
      return true;
    }).slice(0, LIMIT);
  } else {
    docs = await cleanColl
      .find({ ...stockTypeQuery, eps: { $exists: false } }, { projection: { symbol: 1, fullSymbol: 1 } })
      .limit(LIMIT)
      .toArray();
  }

  console.log(`Found ${docs.length} symbols to enrich with EPS+Growth`);
  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const sym = normalizeSymbolForFmp(doc.symbol);
    const key1 = nextKey();
    const key2 = nextKey();

    const update = {};

    try {
      // Fetch income-statement TTM for EPS
      const isUrl = `https://financialmodelingprep.com/stable/income-statement?symbol=${encodeURIComponent(sym)}&period=ttm&limit=1&apikey=${key1}`;
      const isData = await fetchJSON(isUrl);
      const is = Array.isArray(isData) ? isData[0] : null;
      if (is) {
        const epsVal = is.epsDiluted ?? is.eps ?? null;
        if (epsVal != null) update.eps = Number(epsVal);
      }
    } catch { /* EPS optional */ }

    try {
      // Fetch financial-growth for revenueGrowth and epsGrowth
      const fgUrl = `https://financialmodelingprep.com/stable/financial-growth?symbol=${encodeURIComponent(sym)}&limit=1&apikey=${key2}`;
      const fgData = await fetchJSON(fgUrl);
      const fg = Array.isArray(fgData) ? fgData[0] : null;
      if (fg) {
        if (fg.revenueGrowth != null) update.revenueGrowth = Number(fg.revenueGrowth);
        const epsGrowthVal = fg.epsdilutedGrowth ?? fg.epsgrowth ?? null;
        if (epsGrowthVal != null) update.earningsGrowth = Number(epsGrowthVal);
      }
    } catch { /* growth optional */ }

    if (Object.keys(update).length === 0) {
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchFilter = {
      $or: [
        { symbol: sym },
        { fullSymbol: sym },
        { symbol: { $regex: `(^|:)${escaped}$`, $options: "i" } },
        { fullSymbol: { $regex: `(^|:)${escaped}$`, $options: "i" } },
      ],
    };

    await symbolsColl.updateMany(matchFilter, { $set: update });
    await cleanColl.updateMany(matchFilter, { $set: update });

    enriched++;
    if (enriched % 50 === 0) console.log(`  Enriched ${enriched}/${docs.length}...`);

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. enriched=${enriched}, failed/skipped=${failed}`);
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
