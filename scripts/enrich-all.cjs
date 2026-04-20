/**
 * Master enrichment orchestrator.
 * Runs all enrichment scripts in optimal order for maximum data coverage.
 * 
 * Usage:
 *   node scripts/enrich-all.cjs [--limit=N]
 * 
 * Steps:
 *   1. Market cap + profile data (sector, beta, avgVolume)
 *   2. Financial ratios (PE, dividend yield, ROE, revenue growth)  
 *   3. EPS + growth metrics
 *   4. Average volume (for relVolume calculation)
 *   5. Analyst ratings
 *   6. Sector classification (for any still missing)
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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    process.env[key] = val;
  }
}
loadEnvFile();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const FMP_KEYS = [process.env.FMP_API_KEY, process.env.FMP_KEY_1, process.env.FMP_KEY_2].filter(Boolean);
if (!FMP_KEYS.length) { console.error("No FMP keys."); process.exit(1); }

const argLimit = process.argv.find(a => a.startsWith("--limit="));
const LIMIT = argLimit ? Number(argLimit.split("=")[1]) : 50000;
const DELAY_MS = Math.ceil(2500 / FMP_KEYS.length);
let keyIdx = 0;
function nextKey() { return FMP_KEYS[keyIdx++ % FMP_KEYS.length]; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 20000 }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { reject(new Error("JSON parse: " + d.slice(0, 200))); } });
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function fmpFetch(endpoint, symbol, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    const key = nextKey();
    const url = `https://financialmodelingprep.com${endpoint}${endpoint.includes("?") ? "&" : "?"}symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
    try {
      const data = await fetchJSON(url);
      if (data?.["Error Message"]?.includes("Limit")) { await sleep(15000); continue; }
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object" && !data["Error Message"]) return [data];
      return [];
    } catch (e) {
      if (i < retries) { await sleep(3000); continue; }
      return [];
    }
  }
  return [];
}

/* ── main ───────────────────────────────────────────────────────────── */
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const sym = db.collection("symbols");
  const ca = db.collection("cleanassets");

  console.log(`\n${"=".repeat(60)}`);
  console.log("  MASTER ENRICHMENT PIPELINE");
  console.log(`  FMP keys: ${FMP_KEYS.length}, limit: ${LIMIT}, delay: ${DELAY_MS}ms`);
  console.log(`${"=".repeat(60)}\n`);

  // Get US stocks needing enrichment (highest priority first)
  const needsEnrich = await sym.find(
    {
      type: "stock",
      source: { $ne: "synthetic-derivatives" },
      $or: [
        { marketCap: { $in: [null, 0] } },
        { marketCap: { $exists: false } },
        { beta: { $in: [null, 0] } },
        { beta: { $exists: false } },
        { sector: { $in: [null, ""] } },
        { sector: { $exists: false } },
      ],
    },
    { projection: { symbol: 1, fullSymbol: 1, exchange: 1, priorityScore: 1 } }
  ).sort({ priorityScore: -1 }).limit(LIMIT).toArray();

  console.log(`Found ${needsEnrich.length} stocks needing enrichment.\n`);

  // Deduplicate by symbol (keep highest priority)
  const seen = new Set();
  const unique = [];
  for (const d of needsEnrich) {
    if (!seen.has(d.symbol)) {
      seen.add(d.symbol);
      unique.push(d);
    }
  }
  console.log(`Unique symbols to enrich: ${unique.length}\n`);

  let enriched = 0, failed = 0, rateLimits = 0;
  const startTime = Date.now();

  for (let i = 0; i < unique.length; i++) {
    const { symbol, fullSymbol } = unique[i];

    // ─── STEP 1: Profile (marketCap, sector, beta, avgVolume) ───
    const profiles = await fmpFetch("/stable/profile", symbol);
    if (!profiles.length) {
      failed++;
      if (failed <= 20 || failed % 100 === 0) console.log(`  [${i + 1}] ${symbol}: no profile`);
      await sleep(DELAY_MS);
      continue;
    }
    const p = profiles[0];

    const update = {};
    if (p.marketCap) update.marketCap = p.marketCap;
    if (p.sector) update.sector = p.sector;
    if (p.industry) update.industry = p.industry;
    if (p.beta) update.beta = p.beta;
    if (p.volAvg) update.avgVolume = p.volAvg;
    if (p.price) update.price = p.price;
    if (p.changes) update.change = p.changes;
    if (p.changesPercentage != null) update.changePercent = p.changesPercentage;
    if (p.companyName) update.companyName = p.companyName;
    if (p.website) {
      try {
        const domain = new URL(p.website).hostname.replace(/^www\./, "");
        update.companyDomain = domain;
      } catch {}
    }
    if (p.isin) update.isin = p.isin;
    if (p.image && !p.image.includes("financialmodelingprep.com")) update.iconUrl = p.image;

    await sleep(DELAY_MS);

    // ─── STEP 2: Ratios (PE, dividendYield, ROE, revenueGrowth) ───
    const ratios = await fmpFetch("/stable/ratios-ttm", symbol);
    if (ratios.length && ratios[0]) {
      const r = ratios[0];
      if (r.peRatioTTM) update.pe = r.peRatioTTM;
      if (r.dividendYielTTM != null) update.dividendYield = r.dividendYielTTM;
      if (r.returnOnEquityTTM != null) update.roe = r.returnOnEquityTTM;
      if (r.priceEarningsToGrowthRatioTTM != null) update.peg = r.priceEarningsToGrowthRatioTTM;
    }
    await sleep(DELAY_MS);

    // ─── STEP 3: Income statement for EPS ───
    const income = await fmpFetch("/stable/income-statement?period=ttm", symbol);
    if (income.length && income[0]) {
      const inc = income[0];
      if (inc.epsdiluted) update.eps = inc.epsdiluted;
      if (inc.netIncome) update.netIncome = inc.netIncome;
      if (inc.revenue) update.revenue = inc.revenue;
    }
    await sleep(DELAY_MS);

    // ─── STEP 4: Financial growth for EPS growth + revenue growth ───
    const growth = await fmpFetch("/stable/financial-growth?period=annual&limit=1", symbol);
    if (growth.length && growth[0]) {
      const g = growth[0];
      if (g.epsDilutedGrowth != null) update.epsGrowth = g.epsDilutedGrowth;
      if (g.revenueGrowth != null) update.revenueGrowth = g.revenueGrowth;
    }
    await sleep(DELAY_MS);

    // ─── STEP 5: Analyst consensus ───
    const grades = await fmpFetch("/stable/grade?limit=20", symbol);
    if (grades.length) {
      const counts = { buy: 0, sell: 0, hold: 0 };
      for (const g of grades) {
        const grade = (g.newGrade || "").toLowerCase();
        if (grade.includes("buy") || grade.includes("outperform") || grade.includes("overweight")) counts.buy++;
        else if (grade.includes("sell") || grade.includes("underperform") || grade.includes("underweight")) counts.sell++;
        else counts.hold++;
      }
      const total = counts.buy + counts.sell + counts.hold;
      if (total > 0) {
        const buyPct = counts.buy / total;
        const sellPct = counts.sell / total;
        if (buyPct >= 0.7) update.analystRating = "strong-buy";
        else if (buyPct >= 0.5) update.analystRating = "buy";
        else if (sellPct >= 0.5) update.analystRating = "sell";
        else if (sellPct >= 0.7) update.analystRating = "strong-sell";
        else update.analystRating = "neutral";
      }
    }

    // ─── Write all updates ───
    if (Object.keys(update).length > 0) {
      update.metadataUpdatedAt = new Date();
      // Update all matching symbol docs (covers multiple exchanges)
      await sym.updateMany({ symbol }, { $set: update });
      await ca.updateMany({ symbol }, { $set: update });
      enriched++;
      if (enriched <= 30 || enriched % 50 === 0) {
        const mc = update.marketCap ? `$${(update.marketCap / 1e9).toFixed(1)}B` : "—";
        const sec = update.sector || "—";
        console.log(`  [${i + 1}/${unique.length}] ${symbol}: mc=${mc} sec=${sec} ✓ (${Object.keys(update).length} fields)`);
      }
    } else {
      failed++;
    }

    await sleep(DELAY_MS);

    // Progress report every 100
    if ((i + 1) % 100 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const rate = (enriched / (Date.now() - startTime) * 60000).toFixed(1);
      console.log(`\n  --- Progress: ${i + 1}/${unique.length} | enriched=${enriched} failed=${failed} | ${elapsed}min | ${rate}/min ---\n`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ENRICHMENT COMPLETE`);
  console.log(`  Enriched: ${enriched}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Time: ${totalTime} min`);
  console.log(`${"=".repeat(60)}\n`);

  await client.close();
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
