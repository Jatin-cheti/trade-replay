/**
 * Batch enrichment pipeline - uses FMP batch endpoints for maximum throughput.
 * 
 * Strategy:
 * 1. Batch profile requests (comma-separated symbols, up to 50/request)
 * 2. Batch ratios-ttm
 * 3. Batch income-statement-ttm  
 * 4. Batch financial-growth
 * 5. Write all updates to both symbols + cleanassets
 * 
 * Usage:
 *   node scripts/enrich-batch.cjs [--limit=N] [--offset=N] [--type=stock]
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const https = require("https");

/* ── env ─────────────────────────────────────────────────────────── */
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

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, v] = a.slice(2).split("="); return [k, v]; })
);
const LIMIT = Number(args.limit) || 50000;
const OFFSET = Number(args.offset) || 0;
const TYPE = args.type || "stock";
const BATCH_SIZE = 5; // symbols per API request (FMP batch limit varies)
const DELAY_MS = Math.ceil(1200 / FMP_KEYS.length);

let keyIdx = 0;
function nextKey() { return FMP_KEYS[keyIdx++ % FMP_KEYS.length]; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 25000 }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error("JSON parse: " + d.slice(0, 300))); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function fmpBatch(endpoint, symbols, retries = 2) {
  const joined = symbols.join(",");
  for (let i = 0; i <= retries; i++) {
    const key = nextKey();
    const sep = endpoint.includes("?") ? "&" : "?";
    const url = `https://financialmodelingprep.com${endpoint}${sep}symbol=${encodeURIComponent(joined)}&apikey=${key}`;
    try {
      const data = await fetchJSON(url);
      if (data?.["Error Message"]?.includes("Limit")) {
        console.log(`  Rate limit hit, waiting 20s...`);
        await sleep(20000);
        continue;
      }
      return Array.isArray(data) ? data : [];
    } catch (e) {
      if (i < retries) { await sleep(3000); continue; }
      console.log(`  Batch fetch failed: ${e.message}`);
      return [];
    }
  }
  return [];
}

async function fmpSingle(endpoint, symbol, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const key = nextKey();
    const sep = endpoint.includes("?") ? "&" : "?";
    const url = `https://financialmodelingprep.com${endpoint}${sep}symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
    try {
      const data = await fetchJSON(url);
      if (data?.["Error Message"]?.includes("Limit")) { await sleep(15000); continue; }
      return Array.isArray(data) ? data : [];
    } catch (e) {
      if (i < retries) { await sleep(2000); continue; }
      return [];
    }
  }
  return [];
}

/* ── main ─────────────────────────────────────────────────────────── */
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const symCol = db.collection("symbols");
  const caCol = db.collection("cleanassets");

  console.log(`\n${"=".repeat(60)}`);
  console.log("  BATCH ENRICHMENT PIPELINE");
  console.log(`  Keys: ${FMP_KEYS.length} | Limit: ${LIMIT} | Type: ${TYPE} | BatchSize: ${BATCH_SIZE}`);
  console.log(`${"=".repeat(60)}\n`);

  // Find symbols needing enrichment
  const query = {
    type: TYPE,
    source: { $ne: "synthetic-derivatives" },
    $or: [
      { marketCap: { $in: [null, 0] } },
      { marketCap: { $exists: false } },
    ],
  };

  const docs = await caCol.find(query, {
    projection: { symbol: 1, fullSymbol: 1, exchange: 1, priorityScore: 1 }
  }).sort({ priorityScore: -1 }).skip(OFFSET).limit(LIMIT).toArray();

  // Deduplicate by symbol
  const seen = new Set();
  const unique = [];
  for (const d of docs) {
    if (!seen.has(d.symbol)) {
      seen.add(d.symbol);
      unique.push(d.symbol);
    }
  }

  console.log(`Found ${docs.length} docs, ${unique.length} unique symbols to enrich.\n`);

  let enriched = 0, failed = 0, totalFields = 0;
  const startTime = Date.now();

  // Process in batches
  for (let b = 0; b < unique.length; b += BATCH_SIZE) {
    const batch = unique.slice(b, b + BATCH_SIZE);
    const updates = {}; // symbol -> update fields

    for (const s of batch) updates[s] = {};

    // ── STEP 1: Profile (marketCap, sector, beta, avgVolume, website) ──
    const profiles = await fmpBatch("/stable/profile", batch);
    for (const p of profiles) {
      if (!p.symbol || !updates[p.symbol]) continue;
      const u = updates[p.symbol];
      if (p.marketCap) u.marketCap = p.marketCap;
      if (p.sector) u.sector = p.sector;
      if (p.industry) u.industry = p.industry;
      if (p.beta) u.beta = p.beta;
      if (p.volAvg) u.avgVolume = p.volAvg;
      if (p.price) u.price = p.price;
      if (p.changes) u.change = p.changes;
      if (p.changesPercentage != null) u.changePercent = p.changesPercentage;
      if (p.companyName) u.companyName = p.companyName;
      if (p.website) {
        try { u.companyDomain = new URL(p.website).hostname.replace(/^www\./, ""); } catch {}
      }
      if (p.image && !p.image.includes("financialmodelingprep.com")) u.iconUrl = p.image;
    }
    await sleep(DELAY_MS);

    // ── STEP 2: Ratios TTM (PE, dividendYield, ROE) ──
    for (const sym of batch) {
      const ratios = await fmpSingle("/stable/ratios-ttm", sym);
      if (ratios.length && ratios[0]) {
        const r = ratios[0];
        const u = updates[sym];
        if (r.peRatioTTM) u.pe = r.peRatioTTM;
        if (r.dividendYielTTM != null) u.dividendYield = r.dividendYielTTM;
        if (r.dividendYieldTTM != null && !u.dividendYield) u.dividendYield = r.dividendYieldTTM;
        if (r.returnOnEquityTTM != null) u.roe = r.returnOnEquityTTM;
        if (r.priceEarningsToGrowthRatioTTM != null) u.peg = r.priceEarningsToGrowthRatioTTM;
      }
      await sleep(DELAY_MS);
    }

    // ── STEP 3: Income statement TTM (EPS, revenue, netIncome) ──
    for (const sym of batch) {
      const income = await fmpSingle("/stable/income-statement?period=ttm", sym);
      if (income.length && income[0]) {
        const inc = income[0];
        const u = updates[sym];
        if (inc.epsdiluted) u.eps = inc.epsdiluted;
        if (inc.netIncome) u.netIncome = inc.netIncome;
        if (inc.revenue) u.revenue = inc.revenue;
      }
      await sleep(DELAY_MS);
    }

    // ── STEP 4: Financial growth (epsGrowth, revenueGrowth) ──
    for (const sym of batch) {
      const growth = await fmpSingle("/stable/financial-growth?period=annual&limit=1", sym);
      if (growth.length && growth[0]) {
        const g = growth[0];
        const u = updates[sym];
        if (g.epsDilutedGrowth != null) u.epsGrowth = g.epsDilutedGrowth;
        if (g.revenueGrowth != null) u.revenueGrowth = g.revenueGrowth;
      }
      await sleep(DELAY_MS);
    }

    // ── Write updates ──
    const bulkSym = [];
    const bulkCa = [];
    for (const sym of batch) {
      const u = updates[sym];
      const fieldCount = Object.keys(u).length;
      if (fieldCount > 0) {
        u.metadataUpdatedAt = new Date();
        bulkSym.push({ updateMany: { filter: { symbol: sym }, update: { $set: u } } });
        bulkCa.push({ updateMany: { filter: { symbol: sym }, update: { $set: u } } });
        enriched++;
        totalFields += fieldCount;
      } else {
        failed++;
      }
    }

    if (bulkSym.length) {
      await symCol.bulkWrite(bulkSym, { ordered: false }).catch(() => {});
      await caCol.bulkWrite(bulkCa, { ordered: false }).catch(() => {});
    }

    // Progress
    const done = Math.min(b + BATCH_SIZE, unique.length);
    if (done <= 30 || done % 25 === 0 || done === unique.length) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const rate = enriched > 0 ? (enriched / ((Date.now() - startTime) / 60000)).toFixed(1) : "0";
      const batchSample = batch.slice(0, 3).map(s => {
        const u = updates[s];
        const mc = u.marketCap ? `$${(u.marketCap / 1e9).toFixed(1)}B` : "—";
        return `${s}=${mc}`;
      }).join(", ");
      console.log(`  [${done}/${unique.length}] enriched=${enriched} failed=${failed} | ${elapsed}min | ${rate}/min | ${batchSample}`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  // Post-enrichment null-rate check
  console.log(`\n--- POST-ENRICHMENT NULL RATES ---`);
  const caStocks = await caCol.countDocuments({ type: TYPE });
  for (const f of ["marketCap", "pe", "eps", "beta", "sector", "avgVolume", "revenue", "analystRating"]) {
    const missing = await caCol.countDocuments({
      type: TYPE,
      $or: [{ [f]: { $exists: false } }, { [f]: null }, { [f]: "" }, { [f]: 0 }]
    });
    console.log(`  ${f}: ${missing}/${caStocks} (${((missing / caStocks) * 100).toFixed(1)}%)`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  BATCH ENRICHMENT COMPLETE`);
  console.log(`  Enriched: ${enriched} | Failed: ${failed} | Fields: ${totalFields}`);
  console.log(`  Time: ${totalTime} min`);
  console.log(`  Rate: ${(enriched / (totalTime || 1) * 1).toFixed(1)} symbols/min`);
  console.log(`${"=".repeat(60)}\n`);

  await client.close();
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
