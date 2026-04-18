/**
 * Enrich market caps using FMP /stable/profile endpoint.
 *
 * Rotates between all available FMP keys (FMP_API_KEY, FMP_KEY_1, FMP_KEY_2)
 * to maximise daily throughput. Rate-limits to ~4 req/min per key.
 *
 * Usage:
 *   node scripts/enrich-marketcap-fmp-stable.cjs
 *   node scripts/enrich-marketcap-fmp-stable.cjs --limit=500
 *   node scripts/enrich-marketcap-fmp-stable.cjs --symbols=AMZN,NVDA,MSFT,META
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const https = require("https");

/* ── env ────────────────────────────────────────────────────────────── */

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
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[key] = val;
  }
}
loadEnvFile();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";

// Collect all usable FMP keys
const FMP_KEYS = [
  process.env.FMP_API_KEY,
  process.env.FMP_KEY_1,
  process.env.FMP_KEY_2,
].filter(Boolean);

if (FMP_KEYS.length === 0) {
  console.error("No FMP keys found in environment. Set FMP_API_KEY, FMP_KEY_1, or FMP_KEY_2.");
  process.exit(1);
}
console.log(`Using ${FMP_KEYS.length} FMP key(s) for rotation.`);

// CLI args
const argLimit = process.argv.find(a => a.startsWith("--limit="));
const argSymbols = process.argv.find(a => a.startsWith("--symbols="));
const LIMIT = argLimit ? Number(argLimit.split("=")[1]) : 10000;
const TARGET_SYMBOLS = argSymbols
  ? argSymbols.split("=")[1].split(",").map(s => s.trim().toUpperCase()).filter(Boolean)
  : [];

// Rate limiting: ~4 seconds between requests per key, key rotation
const DELAY_MS = Math.ceil(4200 / FMP_KEYS.length); // effective gap per request
let keyIndex = 0;
function nextKey() {
  const key = FMP_KEYS[keyIndex % FMP_KEYS.length];
  keyIndex++;
  return key;
}

/* ── HTTP helper ────────────────────────────────────────────────────── */

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`JSON parse error: ${data.slice(0, 200)}`));
        }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function fetchProfileWithRetry(symbol, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const key = nextKey();
    const url = `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
    try {
      const data = await fetchJSON(url);

      // Rate limit or error
      if (data && data["Error Message"]) {
        const msg = data["Error Message"];
        if (msg.includes("Limit Reach") || msg.includes("rate")) {
          console.log(`  [${symbol}] Rate limit on key ...${key.slice(-4)}, retry ${attempt + 1}`);
          await sleep(15000); // wait 15s on rate limit
          continue;
        }
        return { error: msg };
      }

      // Success - array with profile object
      if (Array.isArray(data) && data.length > 0 && data[0].marketCap) {
        return data[0];
      }

      // Empty array = symbol not found on FMP
      if (Array.isArray(data) && data.length === 0) {
        return { error: "Symbol not found on FMP" };
      }

      return { error: `Unexpected response: ${JSON.stringify(data).slice(0, 150)}` };
    } catch (err) {
      if (attempt < maxRetries) {
        await sleep(5000);
        continue;
      }
      return { error: err.message };
    }
  }
  return { error: "Max retries exceeded" };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ── main ───────────────────────────────────────────────────────────── */

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const symbolsCol = db.collection("symbols");
  const cleanCol = db.collection("cleanassets");

  // Build query
  let query;
  if (TARGET_SYMBOLS.length > 0) {
    query = { symbol: { $in: TARGET_SYMBOLS } };
    console.log(`Targeting ${TARGET_SYMBOLS.length} specific symbols.`);
  } else {
    query = {
      country: "US",
      type: "stock",
      source: { $ne: "synthetic-derivatives" },
      isPrimaryListing: { $ne: false },
      $or: [
        { marketCap: { $exists: false } },
        { marketCap: null },
        { marketCap: 0 },
        { marketCap: { $lt: 1 } },
      ],
    };
  }

  // Get symbols sorted by priority
  const docs = await symbolsCol
    .find(query, { projection: { symbol: 1, priorityScore: 1 } })
    .sort({ priorityScore: -1 })
    .limit(LIMIT)
    .toArray();

  console.log(`Found ${docs.length} symbols to enrich (limit: ${LIMIT}).`);
  if (docs.length === 0) {
    await client.close();
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let rateLimitHits = 0;

  for (let i = 0; i < docs.length; i++) {
    const { symbol } = docs[i];
    const profile = await fetchProfileWithRetry(symbol);

    if (profile.error) {
      if (profile.error.includes("Limit Reach") || profile.error.includes("rate")) {
        rateLimitHits++;
        if (rateLimitHits >= 10) {
          console.log(`\n*** Too many rate limits (${rateLimitHits}). Stopping early. ***`);
          break;
        }
      }
      failed++;
      if (failed <= 20 || failed % 50 === 0) {
        console.log(`  [${i + 1}/${docs.length}] ${symbol}: FAILED - ${profile.error}`);
      }
      await sleep(DELAY_MS);
      continue;
    }

    const mc = profile.marketCap;
    const extra = {};
    if (profile.sector) extra.sector = profile.sector;
    if (profile.industry) extra.industry = profile.industry;
    if (profile.beta) extra.beta = profile.beta;
    if (profile.volAvg) extra.volAvg = profile.volAvg;
    if (profile.mktCap) extra.mktCap = profile.mktCap;
    if (profile.companyName) extra.companyName = profile.companyName;

    const updateFields = { marketCap: mc, ...extra };

    // Update symbols collection
    await symbolsCol.updateOne(
      { symbol },
      { $set: updateFields }
    );

    // Update cleanassets collection
    await cleanCol.updateOne(
      { symbol },
      { $set: updateFields }
    );

    updated++;
    if (updated <= 30 || updated % 25 === 0) {
      console.log(`  [${i + 1}/${docs.length}] ${symbol}: marketCap = ${mc.toLocaleString()} ✓`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n=== FMP Stable Enrichment Complete ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed:  ${failed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Rate limit hits: ${rateLimitHits}`);

  await client.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
