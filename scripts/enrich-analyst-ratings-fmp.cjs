/**
 * Enrich analyst ratings from FMP /stable/grades-latest endpoint.
 * Maps analyst consensus → "strong-buy" | "buy" | "neutral" | "sell" | "strong-sell"
 * Writes analystRating into symbols + cleanassets collections.
 *
 * Usage:
 *   node scripts/enrich-analyst-ratings-fmp.cjs
 *   node scripts/enrich-analyst-ratings-fmp.cjs --limit=500
 *   node scripts/enrich-analyst-ratings-fmp.cjs --symbols=AMZN,NVDA
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
console.log(`Analyst rating enrichment — using ${FMP_KEYS.length} FMP key(s).`);

const argLimit = process.argv.find(a => a.startsWith("--limit="));
const argSymbols = process.argv.find(a => a.startsWith("--symbols="));
const LIMIT = argLimit ? Number(argLimit.split("=")[1]) : 10000;
const TARGET_SYMBOLS = argSymbols
  ? argSymbols.split("=")[1].split(",").map(s => s.trim().toUpperCase()).filter(Boolean)
  : [];

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── Rating normalizer ────────────────────────────────────────────── */
function normalizeRating(raw) {
  if (!raw) return null;
  const r = raw.toLowerCase().replace(/[-_\s]+/g, "");
  if (r.includes("strongbuy") || r === "strongbuy" || r === "sb") return "strong-buy";
  if (r.includes("strongsell") || r === "ss") return "strong-sell";
  if (r === "buy" || r === "outperform" || r === "overweight" || r === "accumulate" || r === "addtobuy") return "buy";
  if (r === "sell" || r === "underperform" || r === "underweight" || r === "reduce") return "sell";
  if (r === "hold" || r === "neutral" || r === "marketperform" || r === "equalweight" || r === "sectorperform") return "neutral";
  return null;
}

function normalizeSymbolForFmp(symbol) {
  if (!symbol) return symbol;
  let s = String(symbol).split(":").pop() || String(symbol);
  s = s.replace(/\.(?=[A-Z]$)/, "-");
  s = s.replace(/\.(W|WS|U|RT)$/i, "");
  return s;
}

/* ── Consensus from array of grades ──────────────────────────────── */
function consensusRating(grades) {
  if (!Array.isArray(grades) || grades.length === 0) return null;
  // Weight most recent 10 ratings
  const recent = grades.slice(0, 10);
  const counts = { "strong-buy": 0, buy: 0, neutral: 0, sell: 0, "strong-sell": 0 };
  for (const g of recent) {
    const r = normalizeRating(g.analystRatingsbuy || g.ratingScore || g.rating || g.grade);
    if (r) counts[r]++;
  }
  // Score: strong-buy=2, buy=1, neutral=0, sell=-1, strong-sell=-2
  const score = counts["strong-buy"] * 2 + counts.buy * 1 + counts.neutral * 0 + counts.sell * -1 + counts["strong-sell"] * -2;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const avg = score / total;
  if (avg >= 1.3) return "strong-buy";
  if (avg >= 0.4) return "buy";
  if (avg > -0.4) return "neutral";
  if (avg > -1.3) return "sell";
  return "strong-sell";
}

/* ── main ─────────────────────────────────────────────────────────── */
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const symbolsColl = db.collection("symbols");
  const cleanColl = db.collection("cleanassets");

  const query = TARGET_SYMBOLS.length
    ? { symbol: { $in: TARGET_SYMBOLS }, assetType: "stock" }
    : { analystRating: { $exists: false }, assetType: "stock" };

  const docs = await symbolsColl
    .find(query, { projection: { symbol: 1, fullSymbol: 1 } })
    .limit(LIMIT)
    .toArray();

  console.log(`Found ${docs.length} symbols to enrich with analyst ratings`);
  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const sym = normalizeSymbolForFmp(doc.symbol);
    const key = nextKey();
    const url = `https://financialmodelingprep.com/stable/grades-consensus?symbol=${encodeURIComponent(sym)}&apikey=${key}`;

    try {
      const data = await fetchJSON(url);
      let rating = null;
      if (Array.isArray(data) && data.length > 0) {
        const c = data[0].consensus;
        rating = normalizeRating(c);
        if (!rating) {
          const strongBuy = Number(data[0].strongBuy || 0);
          const buy = Number(data[0].buy || 0);
          const hold = Number(data[0].hold || 0);
          const sell = Number(data[0].sell || 0);
          const strongSell = Number(data[0].strongSell || 0);
          const total = strongBuy + buy + hold + sell + strongSell;
          if (total > 0) {
            const avg = (strongBuy * 2 + buy * 1 + hold * 0 + sell * -1 + strongSell * -2) / total;
            if (avg >= 1.3) rating = "strong-buy";
            else if (avg >= 0.4) rating = "buy";
            else if (avg > -0.4) rating = "neutral";
            else if (avg > -1.3) rating = "sell";
            else rating = "strong-sell";
          }
        }
      }

      if (!rating) { failed++; continue; }

      const filter = doc.fullSymbol ? { fullSymbol: doc.fullSymbol } : { symbol: doc.symbol };
      await symbolsColl.updateOne(filter, { $set: { analystRating: rating } });
      await cleanColl.updateOne({ symbol: sym }, { $set: { analystRating: rating } });

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
