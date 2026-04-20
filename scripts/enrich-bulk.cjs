/**
 * HIGH-EFFICIENCY BULK ENRICHMENT
 * 
 * Strategy: Use FMP stock-screener endpoint which returns bulk data with financials
 * in a single request (up to 10,000 results per call). Much faster than per-symbol lookups.
 * 
 * Phase 1: FMP stock-screener (marketCap, sector, beta, price, volume) — bulk
 * Phase 2: FMP /stable/profile batch (website/domain, detailed sector) — per symbol
 * Phase 3: FMP /stable/ratios-ttm (PE, ROE, dividendYield) — per symbol  
 * Phase 4: FMP /stable/income-statement (EPS, revenue, netIncome) — per symbol
 * Phase 5: FMP /stable/financial-growth (epsGrowth, revenueGrowth) — per symbol
 * Phase 6: FMP /stable/grade (analystRating) — per symbol
 * 
 * Usage:
 *   node scripts/enrich-bulk.cjs                    # All phases
 *   node scripts/enrich-bulk.cjs --phase=1          # Screener bulk only
 *   node scripts/enrich-bulk.cjs --phase=2-6        # Per-symbol detail only
 *   node scripts/enrich-bulk.cjs --limit=5000       # Limit per-symbol phases
 *   node scripts/enrich-bulk.cjs --country=US       # US stocks only
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const https = require("https");

/* ── env ─────────────────────────────────────────────────────────── */
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
const FMP_KEYS = [process.env.FMP_API_KEY, process.env.FMP_KEY_1, process.env.FMP_KEY_2].filter(Boolean);
if (!FMP_KEYS.length) { console.error("No FMP keys."); process.exit(1); }
console.log(`FMP keys: ${FMP_KEYS.length}`);

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, v] = a.slice(2).split("="); return [k, v || "true"]; })
);
const LIMIT = Number(args.limit) || 50000;
const COUNTRY = args.country || null;
const PHASE = args.phase || "1-6";
const DELAY_PER_KEY_MS = 800; // ~1.25 req/s per key
const DELAY_MS = Math.ceil(DELAY_PER_KEY_MS / FMP_KEYS.length);

let keyIdx = 0;
function nextKey() { return FMP_KEYS[keyIdx++ % FMP_KEYS.length]; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000 }, res => {
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

async function fmpGet(urlPath, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const key = nextKey();
    const sep = urlPath.includes("?") ? "&" : "?";
    const url = `https://financialmodelingprep.com${urlPath}${sep}apikey=${key}`;
    try {
      const data = await fetchJSON(url);
      if (data?.["Error Message"]?.includes("Limit")) {
        console.log("  Rate limit, waiting 20s...");
        await sleep(20000);
        continue;
      }
      return Array.isArray(data) ? data : (data && typeof data === "object" ? [data] : []);
    } catch (e) {
      if (i < retries) { await sleep(3000); continue; }
      return [];
    }
  }
  return [];
}

/* ── Phase 1: Bulk screener ─────────────────────────────────────── */
async function phase1BulkScreener(db) {
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 1: FMP Stock Screener (Bulk)");
  console.log("═".repeat(60));

  const sym = db.collection("symbols");
  const ca = db.collection("cleanassets");

  // FMP stock-screener: returns up to 10,000 per call with marketCap, sector, beta, price, volume
  // Paginate with different marketCap thresholds to get all stocks
  const thresholds = [
    { label: "mega-cap", params: "marketCapMoreThan=100000000000" },      // >$100B
    { label: "large-cap", params: "marketCapMoreThan=10000000000&marketCapLowerThan=100000000000" }, // $10B-$100B
    { label: "mid-cap", params: "marketCapMoreThan=2000000000&marketCapLowerThan=10000000000" },     // $2B-$10B
    { label: "small-cap", params: "marketCapMoreThan=300000000&marketCapLowerThan=2000000000" },     // $300M-$2B
    { label: "micro-cap", params: "marketCapMoreThan=50000000&marketCapLowerThan=300000000" },       // $50M-$300M
    { label: "nano-cap", params: "marketCapMoreThan=1000000&marketCapLowerThan=50000000" },          // $1M-$50M
  ];

  let totalBulkUpdated = 0;
  const allSymbols = new Map(); // symbol -> data

  for (const { label, params } of thresholds) {
    const countryParam = COUNTRY ? `&country=${COUNTRY}` : "";
    const url = `/api/v3/stock-screener?${params}&limit=10000${countryParam}`;
    console.log(`  Fetching ${label}...`);
    
    const data = await fmpGet(url);
    console.log(`  Got ${data.length} results for ${label}`);
    
    for (const d of data) {
      if (!d.symbol) continue;
      allSymbols.set(d.symbol, d);
    }
    
    await sleep(DELAY_MS * 2);
  }

  console.log(`  Total unique symbols from screener: ${allSymbols.size}`);

  // Batch write to DB
  const WRITE_BATCH = 500;
  const entries = [...allSymbols.entries()];
  
  for (let i = 0; i < entries.length; i += WRITE_BATCH) {
    const batch = entries.slice(i, i + WRITE_BATCH);
    const bulkSym = [];
    const bulkCa = [];

    for (const [symbol, d] of batch) {
      const update = {};
      if (d.marketCap) update.marketCap = d.marketCap;
      if (d.sector) update.sector = d.sector;
      if (d.industry) update.industry = d.industry;
      if (d.beta) update.beta = d.beta;
      if (d.price) update.price = d.price;
      if (d.volume) update.volume = d.volume;
      if (d.lastAnnualDividend != null) update.lastAnnualDividend = d.lastAnnualDividend;
      if (d.country) update.country = d.country;
      if (d.exchangeShortName) update.exchangeShortName = d.exchangeShortName;
      if (d.companyName) update.companyName = d.companyName;
      update.metadataUpdatedAt = new Date();

      if (Object.keys(update).length > 1) {
        bulkSym.push({ updateMany: { filter: { symbol }, update: { $set: update } } });
        bulkCa.push({ updateMany: { filter: { symbol }, update: { $set: update } } });
      }
    }

    if (bulkSym.length) {
      const r1 = await sym.bulkWrite(bulkSym, { ordered: false }).catch(e => ({ modifiedCount: 0 }));
      const r2 = await ca.bulkWrite(bulkCa, { ordered: false }).catch(e => ({ modifiedCount: 0 }));
      totalBulkUpdated += bulkSym.length;
    }

    if ((i + WRITE_BATCH) % 2000 === 0 || i + WRITE_BATCH >= entries.length) {
      console.log(`  Written ${Math.min(i + WRITE_BATCH, entries.length)}/${entries.length} symbol updates`);
    }
  }

  console.log(`  Phase 1 complete: ${totalBulkUpdated} bulk updates from ${allSymbols.size} screener results`);
  return allSymbols;
}

/* ── Phase 2: Profile batch (domain, detailed sector, image) ──── */
async function phase2Profiles(db, targetSymbols) {
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 2: FMP Profiles (domain, sector, image)");
  console.log("═".repeat(60));

  const sym = db.collection("symbols");
  const ca = db.collection("cleanassets");
  
  // Get symbols missing companyDomain
  const needsDomain = await ca.find(
    {
      type: "stock",
      symbol: { $in: targetSymbols },
      $or: [{ companyDomain: { $in: [null, ""] } }, { companyDomain: { $exists: false } }]
    },
    { projection: { symbol: 1 } }
  ).limit(LIMIT).toArray();

  const unique = [...new Set(needsDomain.map(d => d.symbol))];
  console.log(`  ${unique.length} symbols need domain/profile enrichment`);

  let enriched = 0, failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < unique.length; i++) {
    const symbol = unique[i];
    const profiles = await fmpGet(`/stable/profile?symbol=${encodeURIComponent(symbol)}`);
    
    if (profiles.length && profiles[0]) {
      const p = profiles[0];
      const update = {};
      if (p.website) {
        try { update.companyDomain = new URL(p.website).hostname.replace(/^www\./, ""); } catch {}
      }
      if (p.image && !p.image.includes("financialmodelingprep.com")) update.iconUrl = p.image;
      if (p.isin) update.isin = p.isin;
      if (p.sector && !update.sector) update.sector = p.sector;
      if (p.industry) update.industry = p.industry;
      if (p.volAvg) update.avgVolume = p.volAvg;
      if (p.companyName) update.companyName = p.companyName;
      
      if (Object.keys(update).length > 0) {
        await sym.updateMany({ symbol }, { $set: update });
        await ca.updateMany({ symbol }, { $set: update });
        enriched++;
      }
    } else {
      failed++;
    }

    await sleep(DELAY_MS);

    if ((i + 1) % 100 === 0 || i + 1 === unique.length) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`  [${i + 1}/${unique.length}] enriched=${enriched} failed=${failed} | ${elapsed}min`);
    }
  }

  console.log(`  Phase 2 complete: enriched=${enriched}, failed=${failed}`);
}

/* ── Phase 3: Ratios TTM (PE, ROE, dividendYield) ────────────── */
async function phase3Ratios(db, targetSymbols) {
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 3: FMP Ratios TTM (PE, ROE, dividendYield)");
  console.log("═".repeat(60));

  const sym = db.collection("symbols");
  const ca = db.collection("cleanassets");
  
  const needsRatios = await ca.find(
    {
      type: "stock",
      symbol: { $in: targetSymbols },
      $or: [{ pe: { $in: [null, 0] } }, { pe: { $exists: false } }]
    },
    { projection: { symbol: 1 } }
  ).limit(LIMIT).toArray();

  const unique = [...new Set(needsRatios.map(d => d.symbol))];
  console.log(`  ${unique.length} symbols need ratio enrichment`);

  let enriched = 0, failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < unique.length; i++) {
    const symbol = unique[i];
    const ratios = await fmpGet(`/stable/ratios-ttm?symbol=${encodeURIComponent(symbol)}`);
    
    if (ratios.length && ratios[0]) {
      const r = ratios[0];
      const update = {};
      if (r.peRatioTTM) update.pe = r.peRatioTTM;
      if (r.dividendYielTTM != null) update.dividendYield = r.dividendYielTTM;
      if (r.dividendYieldTTM != null && !update.dividendYield) update.dividendYield = r.dividendYieldTTM;
      if (r.returnOnEquityTTM != null) update.roe = r.returnOnEquityTTM;
      if (r.priceEarningsToGrowthRatioTTM != null) update.peg = r.priceEarningsToGrowthRatioTTM;
      
      if (Object.keys(update).length > 0) {
        await sym.updateMany({ symbol }, { $set: update });
        await ca.updateMany({ symbol }, { $set: update });
        enriched++;
      }
    } else {
      failed++;
    }

    await sleep(DELAY_MS);

    if ((i + 1) % 100 === 0 || i + 1 === unique.length) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`  [${i + 1}/${unique.length}] enriched=${enriched} failed=${failed} | ${elapsed}min`);
    }
  }

  console.log(`  Phase 3 complete: enriched=${enriched}, failed=${failed}`);
}

/* ── Phase 4: Income statement (EPS, revenue, netIncome) ──────── */
async function phase4Income(db, targetSymbols) {
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 4: FMP Income Statement (EPS, revenue, netIncome)");
  console.log("═".repeat(60));

  const sym = db.collection("symbols");
  const ca = db.collection("cleanassets");
  
  const needsEps = await ca.find(
    {
      type: "stock",
      symbol: { $in: targetSymbols },
      $or: [{ eps: { $in: [null, 0] } }, { eps: { $exists: false } }]
    },
    { projection: { symbol: 1 } }
  ).limit(LIMIT).toArray();

  const unique = [...new Set(needsEps.map(d => d.symbol))];
  console.log(`  ${unique.length} symbols need EPS/income enrichment`);

  let enriched = 0, failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < unique.length; i++) {
    const symbol = unique[i];
    const income = await fmpGet(`/stable/income-statement?period=ttm&symbol=${encodeURIComponent(symbol)}`);
    
    if (income.length && income[0]) {
      const inc = income[0];
      const update = {};
      if (inc.epsdiluted) update.eps = inc.epsdiluted;
      if (inc.netIncome) update.netIncome = inc.netIncome;
      if (inc.revenue) update.revenue = inc.revenue;
      
      if (Object.keys(update).length > 0) {
        await sym.updateMany({ symbol }, { $set: update });
        await ca.updateMany({ symbol }, { $set: update });
        enriched++;
      }
    } else {
      failed++;
    }

    await sleep(DELAY_MS);

    if ((i + 1) % 100 === 0 || i + 1 === unique.length) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`  [${i + 1}/${unique.length}] enriched=${enriched} failed=${failed} | ${elapsed}min`);
    }
  }

  console.log(`  Phase 4 complete: enriched=${enriched}, failed=${failed}`);
}

/* ── Phase 5: Financial growth (epsGrowth, revenueGrowth) ─────── */
async function phase5Growth(db, targetSymbols) {
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 5: FMP Financial Growth (epsGrowth, revenueGrowth)");
  console.log("═".repeat(60));

  const sym = db.collection("symbols");
  const ca = db.collection("cleanassets");
  
  const needsGrowth = await ca.find(
    {
      type: "stock",
      symbol: { $in: targetSymbols },
      $or: [{ epsGrowth: { $in: [null, 0] } }, { epsGrowth: { $exists: false } }]
    },
    { projection: { symbol: 1 } }
  ).limit(LIMIT).toArray();

  const unique = [...new Set(needsGrowth.map(d => d.symbol))];
  console.log(`  ${unique.length} symbols need growth enrichment`);

  let enriched = 0, failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < unique.length; i++) {
    const symbol = unique[i];
    const growth = await fmpGet(`/stable/financial-growth?period=annual&limit=1&symbol=${encodeURIComponent(symbol)}`);
    
    if (growth.length && growth[0]) {
      const g = growth[0];
      const update = {};
      if (g.epsDilutedGrowth != null) update.epsGrowth = g.epsDilutedGrowth;
      if (g.revenueGrowth != null) update.revenueGrowth = g.revenueGrowth;
      
      if (Object.keys(update).length > 0) {
        await sym.updateMany({ symbol }, { $set: update });
        await ca.updateMany({ symbol }, { $set: update });
        enriched++;
      }
    } else {
      failed++;
    }

    await sleep(DELAY_MS);

    if ((i + 1) % 100 === 0 || i + 1 === unique.length) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`  [${i + 1}/${unique.length}] enriched=${enriched} failed=${failed} | ${elapsed}min`);
    }
  }

  console.log(`  Phase 5 complete: enriched=${enriched}, failed=${failed}`);
}

/* ── Phase 6: Analyst ratings ─────────────────────────────────── */
async function phase6Ratings(db, targetSymbols) {
  console.log("\n" + "═".repeat(60));
  console.log("  PHASE 6: FMP Analyst Ratings");
  console.log("═".repeat(60));

  const sym = db.collection("symbols");
  const ca = db.collection("cleanassets");
  
  const needsRating = await ca.find(
    {
      type: "stock",
      symbol: { $in: targetSymbols },
      $or: [
        { analystRating: { $in: [null, ""] } },
        { analystRating: { $exists: false } }
      ]
    },
    { projection: { symbol: 1 } }
  ).limit(LIMIT).toArray();

  const unique = [...new Set(needsRating.map(d => d.symbol))];
  console.log(`  ${unique.length} symbols need analyst rating`);

  let enriched = 0, failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < unique.length; i++) {
    const symbol = unique[i];
    const grades = await fmpGet(`/stable/grade?limit=20&symbol=${encodeURIComponent(symbol)}`);
    
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
        let rating;
        if (buyPct >= 0.7) rating = "strong-buy";
        else if (buyPct >= 0.5) rating = "buy";
        else if (sellPct >= 0.7) rating = "strong-sell";
        else if (sellPct >= 0.5) rating = "sell";
        else rating = "neutral";
        
        await sym.updateMany({ symbol }, { $set: { analystRating: rating } });
        await ca.updateMany({ symbol }, { $set: { analystRating: rating } });
        enriched++;
      }
    } else {
      failed++;
    }

    await sleep(DELAY_MS);

    if ((i + 1) % 100 === 0 || i + 1 === unique.length) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      console.log(`  [${i + 1}/${unique.length}] enriched=${enriched} failed=${failed} | ${elapsed}min`);
    }
  }

  console.log(`  Phase 6 complete: enriched=${enriched}, failed=${failed}`);
}

/* ── Orchestrator ─────────────────────────────────────────────── */
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const ca = db.collection("cleanassets");

  console.log("\n" + "█".repeat(60));
  console.log("  BULK ENRICHMENT PIPELINE");
  console.log(`  Phase: ${PHASE} | Limit: ${LIMIT} | Country: ${COUNTRY || "ALL"}`);
  console.log("█".repeat(60));

  const phases = PHASE.split("-").map(Number);
  const startPhase = phases[0] || 1;
  const endPhase = phases[1] || phases[0] || 6;

  let targetSymbols = [];

  // Phase 1: Bulk screener data
  if (startPhase <= 1 && endPhase >= 1) {
    const screenerResults = await phase1BulkScreener(db);
    targetSymbols = [...screenerResults.keys()];
    console.log(`\n  Phase 1 produced ${targetSymbols.length} target symbols for detailed enrichment`);
  }

  // If we skipped phase 1, get target symbols from DB
  if (targetSymbols.length === 0) {
    const docs = await ca.find(
      { type: "stock", marketCap: { $gt: 0 } },
      { projection: { symbol: 1 } }
    ).sort({ marketCap: -1 }).limit(LIMIT).toArray();
    targetSymbols = [...new Set(docs.map(d => d.symbol))];
    console.log(`  Loaded ${targetSymbols.length} target symbols from existing data`);
  }

  // Phase 2-6: Per-symbol enrichment
  if (startPhase <= 2 && endPhase >= 2) await phase2Profiles(db, targetSymbols);
  if (startPhase <= 3 && endPhase >= 3) await phase3Ratios(db, targetSymbols);
  if (startPhase <= 4 && endPhase >= 4) await phase4Income(db, targetSymbols);
  if (startPhase <= 5 && endPhase >= 5) await phase5Growth(db, targetSymbols);
  if (startPhase <= 6 && endPhase >= 6) await phase6Ratings(db, targetSymbols);

  // Final null-rate report
  console.log("\n" + "═".repeat(60));
  console.log("  POST-ENRICHMENT NULL RATES (stocks in cleanassets)");
  console.log("═".repeat(60));
  const caStocks = await ca.countDocuments({ type: "stock" });
  const fields = ["marketCap","pe","eps","beta","sector","avgVolume","revenue","netIncome","epsGrowth","revenueGrowth","roe","dividendYield","analystRating","companyDomain","iconUrl"];
  for (const f of fields) {
    const missing = await ca.countDocuments({
      type: "stock",
      $or: [{ [f]: { $exists: false } }, { [f]: null }, { [f]: "" }, { [f]: 0 }]
    });
    const pct = ((missing / caStocks) * 100).toFixed(1);
    const bar = "█".repeat(Math.round((1 - missing / caStocks) * 30)) + "░".repeat(Math.round((missing / caStocks) * 30));
    console.log(`  ${f.padEnd(16)} ${bar} ${(100 - parseFloat(pct)).toFixed(1)}% filled (${missing} missing)`);
  }

  console.log("\n" + "█".repeat(60));
  console.log("  ENRICHMENT PIPELINE COMPLETE");
  console.log("█".repeat(60) + "\n");

  await client.close();
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
