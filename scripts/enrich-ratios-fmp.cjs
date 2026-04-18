/**
 * Enrich financial ratios from FMP /stable/ratios endpoint.
 * Writes pe, dividendYield, roe, revenueGrowth into symbols + cleanassets.
 *
 * Usage:
 *   node scripts/enrich-ratios-fmp.cjs
 *   node scripts/enrich-ratios-fmp.cjs --limit=500
 *   node scripts/enrich-ratios-fmp.cjs --symbols=AMZN,NVDA,MSFT
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
console.log(`Ratios enrichment — using ${FMP_KEYS.length} FMP key(s).`);

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

// Stable endpoint rate limits can still trip with key rotation; keep conservative pacing.
const DELAY_MS = Math.ceil(9000 / FMP_KEYS.length);
let keyIndex = 0;
const nextKey = () => FMP_KEYS[keyIndex++ % FMP_KEYS.length];

/* ── HTTP ─────────────────────────────────────────────────────────── */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`JSON parse failed: ${String(data).slice(0, 120)}`));
        }
      });
    }).on("error", reject).on("timeout", () => reject(new Error("Timeout")));
  });
}

function normalizeSymbolForFmp(symbol) {
  if (!symbol) return symbol;
  // Use base ticker and normalize class separator for FMP (e.g. BRK.B -> BRK-B)
  let s = String(symbol).split(":").pop() || String(symbol);
  s = s.replace(/\.(?=[A-Z]$)/, "-");
  // Remove unsupported warrant/units suffixes that produce systematic failures
  s = s.replace(/\.(W|WS|U|RT)$/i, "");
  return s;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── main ─────────────────────────────────────────────────────────── */
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const symbolsColl = db.collection("symbols");
  const cleanColl = db.collection("cleanassets");
  const stockTypeQuery = { $or: [{ assetType: "stock" }, { type: "stock" }] };

  // Find symbols missing pe that have a base symbol (equities)
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
    docs = merged.filter((d) => {
      const sym = String(d.symbol || "").toUpperCase();
      const full = String(d.fullSymbol || "").toUpperCase();
      const base = baseSymbol(sym);
      return wanted.has(sym) || wanted.has(full) || wanted.has(base);
    }).slice(0, LIMIT);
  } else {
    docs = await cleanColl
      .find({ ...stockTypeQuery, pe: { $exists: false } }, { projection: { symbol: 1, fullSymbol: 1 } })
      .limit(LIMIT)
      .toArray();
  }

  console.log(`Found ${docs.length} symbols to enrich with ratios`);
  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const sym = normalizeSymbolForFmp(doc.symbol);
    const key = nextKey();
    const url = `https://financialmodelingprep.com/stable/ratios?symbol=${encodeURIComponent(sym)}&apikey=${key}`;

    try {
      const data = await fetchJSON(url);
      // FMP returns array; take first (most recent TTM)
      const ratio = Array.isArray(data) ? data[0] : null;
      if (!ratio) { failed++; continue; }

      const update = {};
      // FMP stable/ratios field names (confirmed 2025)
      const peVal = ratio.priceToEarningsRatio ?? ratio.peRatioTTM ?? ratio.priceEarningsRatioTTM ?? ratio.peRatio ?? null;
      if (peVal != null) update.pe = Number(peVal);

      const divYield = ratio.dividendYield ?? ratio.dividendYieldTTM ?? null;
      if (divYield != null) update.dividendYield = Number(divYield);

      // Revenue growth not in stable/ratios — skip here (not in this endpoint)
      // Also capture PEG ratio while available
      const pegVal = ratio.priceToEarningsGrowthRatio ?? ratio.forwardPriceToEarningsGrowthRatio ?? null;
      if (pegVal != null) update.peg = Number(pegVal);

      // Fetch key-metrics for ROE (returnOnEquity is only in key-metrics)
      const kmKey = nextKey();
      const kmUrl = `https://financialmodelingprep.com/stable/key-metrics?symbol=${encodeURIComponent(sym)}&apikey=${kmKey}`;
      try {
        const kmData = await fetchJSON(kmUrl);
        const km = Array.isArray(kmData) ? kmData[0] : null;
        if (km) {
          const roeVal = km.returnOnEquity ?? null;
          if (roeVal != null) update.roe = Number(roeVal);
        }
      } catch { /* ROE optional */ }

      if (Object.keys(update).length === 0) { failed++; continue; }

      const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      await symbolsColl.updateMany(
        {
          $or: [
            { symbol: sym },
            { fullSymbol: sym },
            { symbol: { $regex: `(^|:)${escaped}$`, $options: "i" } },
            { fullSymbol: { $regex: `(^|:)${escaped}$`, $options: "i" } },
          ],
        },
        { $set: update },
      );
      // Mirror to cleanassets, handling both base and exchange-prefixed symbols.
      await cleanColl.updateMany(
        {
          $or: [
            { symbol: sym },
            { fullSymbol: sym },
            { symbol: { $regex: `(^|:)${escaped}$`, $options: "i" } },
            { fullSymbol: { $regex: `(^|:)${escaped}$`, $options: "i" } },
          ],
        },
        { $set: update },
      );

      enriched++;
      if (enriched % 50 === 0) console.log(`  Enriched ${enriched}/${docs.length}...`);
    } catch (err) {
      failed++;
      console.warn(`  SKIP ${sym}: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. enriched=${enriched}, failed/skipped=${failed}`);
  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
