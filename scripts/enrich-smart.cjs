/**
 * SMART ENRICHMENT — Uses /stable/profile for all real-exchange stocks.
 * 
 * Strategy:
 * 1. Get all unique stock symbols from cleanassets (not derivatives/CFD)
 * 2. Call /stable/profile for each (gets marketCap, sector, beta, avgVolume, website, image)
 * 3. Call /stable/ratios-ttm for each (PE, ROE, dividendYield, PEG)
 * 4. Call /stable/income-statement?period=ttm (EPS, revenue, netIncome)
 * 5. Call /stable/financial-growth (epsGrowth, revenueGrowth) 
 * 6. Call /stable/grade (analystRating)
 * 7. Write to BOTH symbols AND cleanassets (by symbol, matches all exchanges)
 * 
 * With 3 FMP keys: ~4 req/s → ~240 symbols/min
 * For ~8000 unique stock symbols: ~33 minutes
 * 
 * Usage:
 *   node scripts/enrich-smart.cjs              # Full run
 *   node scripts/enrich-smart.cjs --limit=500  # First 500
 *   node scripts/enrich-smart.cjs --phase=1    # Profile only
 *   node scripts/enrich-smart.cjs --phase=2    # Ratios only  
 *   node scripts/enrich-smart.cjs --phase=3    # Income only
 *   node scripts/enrich-smart.cjs --phase=4    # Growth only
 *   node scripts/enrich-smart.cjs --phase=5    # Ratings only
 *   node scripts/enrich-smart.cjs --type=etf   # ETFs instead of stocks
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

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, v] = a.slice(2).split("="); return [k, v || "true"]; })
);
const LIMIT = Number(args.limit) || 100000;
const PHASE = args.phase || "all";
const TYPE = args.type || "stock";
const DELAY_MS = Math.ceil(2000 / FMP_KEYS.length); // ~1.5 req/s with 3 keys (safe for FMP limits)

let keyIdx = 0, rateLimitCount = 0;
const keyBannedUntil = new Map(); // key -> timestamp when ban expires
function nextKey() {
  const now = Date.now();
  // Try each key, skip banned ones
  for (let i = 0; i < FMP_KEYS.length; i++) {
    const k = FMP_KEYS[keyIdx % FMP_KEYS.length];
    keyIdx++;
    const bannedUntil = keyBannedUntil.get(k) || 0;
    if (now >= bannedUntil) return k;
  }
  // All keys banned — use least-banned one and wait
  let minBan = Infinity, bestKey = FMP_KEYS[0];
  for (const k of FMP_KEYS) {
    const until = keyBannedUntil.get(k) || 0;
    if (until < minBan) { minBan = until; bestKey = k; }
  }
  return bestKey;
}
function banKey(key, durationMs) { keyBannedUntil.set(key, Date.now() + durationMs); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 20000 }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error("JSON parse: " + d.slice(0, 200))); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function fmpGet(endpoint, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const key = nextKey();
    const url = `https://financialmodelingprep.com${endpoint}${endpoint.includes("?") ? "&" : "?"}apikey=${key}`;
    try {
      const data = await fetchJSON(url);
      if (typeof data === "string" && data.includes("Restricted")) return [];
      if (data?.["Error Message"]) {
        if (data["Error Message"].includes("Limit")) {
          rateLimitCount++;
          banKey(key, 120000); // Ban this key for 2 minutes
          console.log(`  ⚠ Rate limit #${rateLimitCount} on key ...${key.slice(-4)}, banned 2min`);
          // Check if ALL keys are banned
          const now = Date.now();
          const allBanned = FMP_KEYS.every(k => (keyBannedUntil.get(k) || 0) > now);
          if (allBanned) {
            const waitTime = Math.min(...FMP_KEYS.map(k => (keyBannedUntil.get(k) || 0))) - now + 5000;
            console.log(`  ⏳ All keys banned, waiting ${(waitTime/1000).toFixed(0)}s...`);
            await sleep(waitTime);
          }
          continue;
        }
        return [];
      }
      return Array.isArray(data) ? data : [];
    } catch (e) {
      if (i < retries) { await sleep(2000); continue; }
      return [];
    }
  }
  return [];
}

async function bulkWrite(db, symbol, update) {
  if (Object.keys(update).length === 0) return;
  update.metadataUpdatedAt = new Date();
  await db.collection("symbols").updateMany({ symbol }, { $set: update }).catch(() => {});
  await db.collection("cleanassets").updateMany({ symbol }, { $set: update }).catch(() => {});
}

/* ── Get unique symbols ─────────────────────────────────────────── */
async function getTargetSymbols(db) {
  // Get unique symbols from cleanassets, excluding synthetic derivatives
  const docs = await db.collection("cleanassets").aggregate([
    {
      $match: {
        type: TYPE,
        source: { $nin: ["synthetic-derivatives", "cfd-expansion"] },
        exchange: { $nin: ["CFD", "OPT", "DERIV"] }
      }
    },
    { $group: { _id: "$symbol", priorityScore: { $max: "$priorityScore" }, marketCap: { $max: "$marketCap" } } },
    { $sort: { marketCap: -1, priorityScore: -1 } },
    { $limit: LIMIT }
  ]).toArray();

  const symbols = docs.map(d => d._id);
  
  // If we got too few from non-synthetic, also get unique symbols from ALL cleanassets
  if (symbols.length < 100) {
    console.log(`  Only ${symbols.length} non-synthetic, also checking all stocks...`);
    const allDocs = await db.collection("cleanassets").aggregate([
      { $match: { type: TYPE } },
      { $group: { _id: "$symbol", priorityScore: { $max: "$priorityScore" }, marketCap: { $max: "$marketCap" } } },
      { $sort: { marketCap: -1, priorityScore: -1 } },
      { $limit: LIMIT }
    ]).toArray();
    
    const seen = new Set(symbols);
    for (const d of allDocs) {
      if (!seen.has(d._id)) {
        symbols.push(d._id);
        seen.add(d._id);
      }
    }
  }

  return symbols;
}

/* ── Phase 1: Profile ───────────────────────────────────────────── */
async function runPhase(db, symbols, phaseName, endpointFn, extractFn, filterFn) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${phaseName}`);
  console.log(`${"═".repeat(60)}`);

  // Filter symbols that need this data
  const needed = filterFn ? await filterFn(db, symbols) : symbols;
  console.log(`  ${needed.length} symbols need enrichment (of ${symbols.length} total)`);

  let enriched = 0, failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < needed.length; i++) {
    const symbol = needed[i];
    const endpoint = endpointFn(symbol);
    const data = await fmpGet(endpoint);

    if (data.length && data[0]) {
      const update = extractFn(data[0], data);
      if (Object.keys(update).length > 0) {
        await bulkWrite(db, symbol, update);
        enriched++;
      } else {
        failed++;
      }
    } else {
      failed++;
    }

    await sleep(DELAY_MS);

    if ((i + 1) <= 10 || (i + 1) % 100 === 0 || i + 1 === needed.length) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      const rate = enriched > 0 ? (enriched / ((Date.now() - startTime) / 60000)).toFixed(0) : "0";
      console.log(`  [${i + 1}/${needed.length}] ✓${enriched} ✗${failed} | ${elapsed}min | ${rate}/min | ${symbol}`);
    }

    // Abort on too many rate limits
    if (rateLimitCount >= 50) {
      console.log("  ⛔ Too many rate limits, aborting phase.");
      break;
    }
  }

  console.log(`  ${phaseName} DONE: enriched=${enriched}, failed=${failed}`);
  return enriched;
}

/* ── Main ───────────────────────────────────────────────────────── */
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log(`\n${"█".repeat(60)}`);
  console.log(`  SMART ENRICHMENT | Type: ${TYPE} | Limit: ${LIMIT} | Phase: ${PHASE}`);
  console.log(`  FMP keys: ${FMP_KEYS.length} | Delay: ${DELAY_MS}ms`);
  console.log(`${"█".repeat(60)}`);

  const symbols = await getTargetSymbols(db);
  console.log(`\n  Target: ${symbols.length} unique ${TYPE} symbols`);
  console.log(`  Sample: ${symbols.slice(0, 10).join(", ")}`);

  const doAll = PHASE === "all";

  // Phase 1: Profile (marketCap, sector, beta, avgVolume, domain, image)
  if (doAll || PHASE === "1") {
    await runPhase(db, symbols, "PHASE 1: Profile",
      sym => `/stable/profile?symbol=${encodeURIComponent(sym)}`,
      (p) => {
        const u = {};
        if (p.marketCap) u.marketCap = p.marketCap;
        if (p.sector) u.sector = p.sector;
        if (p.industry) u.industry = p.industry;
        if (p.beta) u.beta = p.beta;
        if (p.volAvg || p.averageVolume) u.avgVolume = p.volAvg || p.averageVolume;
        if (p.price) u.price = p.price;
        if (p.changes || p.change) u.change = p.changes || p.change;
        if (p.changesPercentage != null || p.changePercentage != null) u.changePercent = p.changesPercentage || p.changePercentage;
        if (p.companyName) u.companyName = p.companyName;
        if (p.volume) u.volume = p.volume;
        if (p.website) {
          try { u.companyDomain = new URL(p.website).hostname.replace(/^www\./, ""); } catch {}
        }
        if (p.image && !p.image.includes("financialmodelingprep.com")) u.iconUrl = p.image;
        return u;
      },
      async (db, syms) => {
        // Get symbols missing marketCap
        const docs = await db.collection("cleanassets").aggregate([
          { $match: { 
            type: TYPE, symbol: { $in: syms },
            $or: [{ marketCap: { $in: [null, 0] } }, { marketCap: { $exists: false } }]
          }},
          { $group: { _id: "$symbol" } }
        ]).toArray();
        return docs.map(d => d._id);
      }
    );
  }

  // Phase 2: Ratios TTM (PE, ROE, dividendYield, PEG)
  if (doAll || PHASE === "2") {
    await runPhase(db, symbols, "PHASE 2: Ratios TTM",
      sym => `/stable/ratios-ttm?symbol=${encodeURIComponent(sym)}`,
      (r) => {
        const u = {};
        if (r.peRatioTTM) u.pe = r.peRatioTTM;
        if (r.dividendYielTTM != null) u.dividendYield = r.dividendYielTTM;
        if (r.dividendYieldTTM != null && !u.dividendYield) u.dividendYield = r.dividendYieldTTM;
        if (r.returnOnEquityTTM != null) u.roe = r.returnOnEquityTTM;
        if (r.priceEarningsToGrowthRatioTTM != null) u.peg = r.priceEarningsToGrowthRatioTTM;
        return u;
      },
      async (db, syms) => {
        const docs = await db.collection("cleanassets").aggregate([
          { $match: { type: TYPE, symbol: { $in: syms }, $or: [{ pe: { $in: [null, 0] } }, { pe: { $exists: false } }] }},
          { $group: { _id: "$symbol" } }
        ]).toArray();
        return docs.map(d => d._id);
      }
    );
  }

  // Phase 3: Income statement (EPS, revenue, netIncome)
  if (doAll || PHASE === "3") {
    await runPhase(db, symbols, "PHASE 3: Income Statement",
      sym => `/stable/income-statement?period=ttm&symbol=${encodeURIComponent(sym)}`,
      (inc) => {
        const u = {};
        if (inc.epsdiluted) u.eps = inc.epsdiluted;
        if (inc.netIncome) u.netIncome = inc.netIncome;
        if (inc.revenue) u.revenue = inc.revenue;
        return u;
      },
      async (db, syms) => {
        const docs = await db.collection("cleanassets").aggregate([
          { $match: { type: TYPE, symbol: { $in: syms }, $or: [{ eps: { $in: [null, 0] } }, { eps: { $exists: false } }] }},
          { $group: { _id: "$symbol" } }
        ]).toArray();
        return docs.map(d => d._id);
      }
    );
  }

  // Phase 4: Financial growth (epsGrowth, revenueGrowth)
  if (doAll || PHASE === "4") {
    await runPhase(db, symbols, "PHASE 4: Financial Growth",
      sym => `/stable/financial-growth?period=annual&limit=1&symbol=${encodeURIComponent(sym)}`,
      (g) => {
        const u = {};
        if (g.epsDilutedGrowth != null) u.epsGrowth = g.epsDilutedGrowth;
        if (g.revenueGrowth != null) u.revenueGrowth = g.revenueGrowth;
        return u;
      },
      async (db, syms) => {
        const docs = await db.collection("cleanassets").aggregate([
          { $match: { type: TYPE, symbol: { $in: syms }, $or: [{ epsGrowth: { $in: [null, 0] } }, { epsGrowth: { $exists: false } }] }},
          { $group: { _id: "$symbol" } }
        ]).toArray();
        return docs.map(d => d._id);
      }
    );
  }

  // Phase 5: Analyst ratings
  if (doAll || PHASE === "5") {
    await runPhase(db, symbols, "PHASE 5: Analyst Ratings",
      sym => `/stable/grade?limit=20&symbol=${encodeURIComponent(sym)}`,
      (_first, grades) => {
        const counts = { buy: 0, sell: 0, hold: 0 };
        for (const g of grades) {
          const grade = (g.newGrade || "").toLowerCase();
          if (grade.includes("buy") || grade.includes("outperform") || grade.includes("overweight")) counts.buy++;
          else if (grade.includes("sell") || grade.includes("underperform") || grade.includes("underweight")) counts.sell++;
          else counts.hold++;
        }
        const total = counts.buy + counts.sell + counts.hold;
        if (total === 0) return {};
        const buyPct = counts.buy / total, sellPct = counts.sell / total;
        let rating;
        if (buyPct >= 0.7) rating = "strong-buy";
        else if (buyPct >= 0.5) rating = "buy";
        else if (sellPct >= 0.7) rating = "strong-sell";
        else if (sellPct >= 0.5) rating = "sell";
        else rating = "neutral";
        return { analystRating: rating };
      },
      async (db, syms) => {
        const docs = await db.collection("cleanassets").aggregate([
          { $match: { type: TYPE, symbol: { $in: syms }, $or: [{ analystRating: { $in: [null, ""] } }, { analystRating: { $exists: false } }] }},
          { $group: { _id: "$symbol" } }
        ]).toArray();
        return docs.map(d => d._id);
      }
    );
  }

  // Final report
  console.log(`\n${"═".repeat(60)}`);
  console.log("  FINAL NULL RATES");
  console.log(`${"═".repeat(60)}`);
  const total = await db.collection("cleanassets").countDocuments({ type: TYPE });
  const fields = ["marketCap","pe","eps","beta","sector","avgVolume","revenue","netIncome","epsGrowth","revenueGrowth","roe","dividendYield","analystRating","companyDomain","iconUrl"];
  for (const f of fields) {
    const missing = await db.collection("cleanassets").countDocuments({
      type: TYPE,
      $or: [{ [f]: { $exists: false } }, { [f]: null }, { [f]: "" }, { [f]: 0 }]
    });
    const pct = (100 - (missing / total) * 100).toFixed(1);
    const bar = "█".repeat(Math.round(parseFloat(pct) / 100 * 30)) + "░".repeat(30 - Math.round(parseFloat(pct) / 100 * 30));
    console.log(`  ${f.padEnd(16)} ${bar} ${pct}% (${total - missing}/${total})`);
  }

  console.log(`\n${"█".repeat(60)}`);
  console.log("  SMART ENRICHMENT COMPLETE");
  console.log(`${"█".repeat(60)}\n`);

  await client.close();
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
