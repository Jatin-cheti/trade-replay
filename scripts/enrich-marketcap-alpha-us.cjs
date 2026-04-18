/**
 * Enrich market caps for high-priority US equities using Alpha Vantage.
 *
 * This is intentionally scoped to the symbols the screener is most likely to
 * serve first. Yahoo is blocking server-side crumb acquisition and the current
 * FMP key is rejected by stable endpoints, while Alpha Vantage OVERVIEW returns
 * real MarketCapitalization values for US equities.
 *
 * Usage:
 *   node scripts/enrich-marketcap-alpha-us.cjs
 *
 * Optional env vars:
 *   ALPHA_US_LIMIT=300
 *   ALPHA_US_DELAY_MS=1200
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

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (!key || process.env[key]) continue;

    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile();

const ALPHA_KEYS = [
  process.env.ALPHA_VANTAGE_KEY,
  process.env.ALPHA_VANTAGE_KEY_1,
  process.env.ALPHA_VANTAGE_KEY_2,
].filter(Boolean);
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const LIMIT = Number(process.env.ALPHA_US_LIMIT || 300);
const DELAY_MS = Number(process.env.ALPHA_US_DELAY_MS || 1200);
let alphaKeyIndex = 0;
const argSymbols = process.argv
  .find((arg) => arg.startsWith("--symbols="))
  ?.slice("--symbols=".length);

const TARGET_SYMBOLS = (argSymbols || process.env.ALPHA_US_SYMBOLS || "")
  .split(",")
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean);

if (ALPHA_KEYS.length === 0) {
  console.error("Missing Alpha Vantage key(s). Set ALPHA_VANTAGE_KEY and/or ALPHA_VANTAGE_KEY_1/2.");
  process.exit(1);
}

function nextAlphaKey() {
  const key = ALPHA_KEYS[alphaKeyIndex % ALPHA_KEYS.length];
  alphaKeyIndex += 1;
  return key;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchOverview(symbol, apiKey) {
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "OVERVIEW");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  return response.json();
}

async function fetchOverviewWithRetry(symbol, maxAttempts = 6) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const key = nextAlphaKey();
    try {
      const payload = await fetchOverview(symbol, key);

      if (payload?.Note || payload?.Information) {
        const waitMs = 1500 * attempt;
        console.log(`  Rate limit on ${symbol} key ...${key.slice(-4)}; waiting ${waitMs}ms (${attempt}/${maxAttempts})`);
        await sleep(waitMs);
        continue;
      }

      if (payload?.["Error Message"]) {
        return null;
      }

      return payload;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await sleep(2000 * attempt);
    }
  }

  return null;
}

async function main() {
  console.log(`Using ${ALPHA_KEYS.length} Alpha Vantage key(s) in rotation.`);

  const client = new MongoClient(MONGO_URI);
  await client.connect();

  const db = client.db();
  const symbols = db.collection("symbols");
  const cleanassets = db.collection("cleanassets");

  const query = {
    country: "US",
    type: "stock",
    source: { $ne: "synthetic-derivatives" },
    isPrimaryListing: { $ne: false },
    ...(TARGET_SYMBOLS.length > 0 ? { symbol: { $in: TARGET_SYMBOLS } } : {}),
    $or: [
      { marketCap: { $exists: false } },
      { marketCap: null },
      { marketCap: 0 },
    ],
  };

  const docs = await symbols
    .find(query, {
      projection: {
        _id: 1,
        symbol: 1,
        fullSymbol: 1,
        exchange: 1,
        priorityScore: 1,
        searchFrequency: 1,
        popularity: 1,
      },
    })
    .sort({ priorityScore: -1, searchFrequency: -1, popularity: -1, symbol: 1 })
    .limit(TARGET_SYMBOLS.length > 0 ? TARGET_SYMBOLS.length : LIMIT)
    .toArray();

  if (TARGET_SYMBOLS.length > 0) {
    console.log(`Found ${docs.length} targeted US symbols needing marketCap enrichment`);
  } else {
    console.log(`Found ${docs.length} high-priority US symbols needing marketCap enrichment`);
  }

  let updated = 0;
  let failed = 0;

  for (let index = 0; index < docs.length; index += 1) {
    const doc = docs[index];
    const payload = await fetchOverviewWithRetry(doc.symbol);
    const marketCap = Number(payload?.MarketCapitalization || 0);

    if (marketCap > 0) {
      await symbols.updateOne({ _id: doc._id }, { $set: { marketCap } });
      await cleanassets.updateOne({ fullSymbol: doc.fullSymbol }, { $set: { marketCap } });
      updated += 1;
    } else {
      failed += 1;
    }

    if ((index + 1) % 25 === 0 || index === docs.length - 1) {
      console.log(`  Processed ${index + 1} / ${docs.length} | updated=${updated} failed=${failed}`);
    }

    await sleep(DELAY_MS);
  }

  console.log("\n=== Alpha US Market Cap Enrichment Complete ===");
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});