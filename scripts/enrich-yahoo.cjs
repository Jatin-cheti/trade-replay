/**
 * YAHOO FINANCE BULK ENRICHMENT
 * 
 * Uses Yahoo Finance v8/v10 quoteSummary API — no API key needed, very generous rate limits.
 * Can process ~10 symbols per batch request.
 * 
 * Usage:
 *   node scripts/enrich-yahoo.cjs              # Full run
 *   node scripts/enrich-yahoo.cjs --limit=500  # First 500
 *   node scripts/enrich-yahoo.cjs --type=etf   # ETFs
 *   node scripts/enrich-yahoo.cjs --check       # Just check progress
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
const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, v] = a.slice(2).split("="); return [k, v || "true"]; })
);
const LIMIT = Number(args.limit) || 100000;
const TYPE = args.type || "stock";
const CHECK_ONLY = args.check === "true";
const DELAY_MS = 350; // ~3 req/s — Yahoo is generous
const BATCH_SIZE = 10; // Yahoo supports batching

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── Yahoo crumb auth ─────────────────────────────────────────── */
let yahooCrumb = null;
let yahooCookies = null;

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOpts = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || "GET",
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ...(options.headers || {}),
      }
    };
    if (yahooCookies) reqOpts.headers["Cookie"] = yahooCookies;
    
    const req = https.request(reqOpts, res => {
      // Capture cookies
      if (res.headers["set-cookie"]) {
        const newCookies = res.headers["set-cookie"].map(c => c.split(";")[0]).join("; ");
        yahooCookies = yahooCookies ? yahooCookies + "; " + newCookies : newCookies;
      }
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => resolve({ data: d, status: res.statusCode }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

async function getYahooCrumb() {
  // Step 1: Get cookies from fc.yahoo.com
  await httpRequest("https://fc.yahoo.com/").catch(() => {});
  // Step 2: Get crumb
  const resp = await httpRequest("https://query2.finance.yahoo.com/v1/test/getcrumb");
  yahooCrumb = resp.data.trim();
  console.log(`  Yahoo crumb: ${yahooCrumb}`);
  return yahooCrumb;
}

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOpts = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ...(yahooCookies ? { "Cookie": yahooCookies } : {}),
        ...headers
      }
    };
    const req = https.get(reqOpts, res => {
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

/* ── Yahoo quoteSummary for single symbol ─────────────────────── */
async function yahooQuoteSummary(symbol, retries = 2) {
  const modules = "price,summaryDetail,defaultKeyStatistics,financialData,assetProfile";
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(yahooCrumb)}`;
  
  for (let i = 0; i <= retries; i++) {
    try {
      const data = await fetchJSON(url);
      if (data?.quoteSummary?.result?.[0]) {
        return data.quoteSummary.result[0];
      }
      // Check if crumb expired
      if (data?.quoteSummary?.error?.code === "Unauthorized") {
        console.log("  Crumb expired, refreshing...");
        await getYahooCrumb();
        continue;
      }
      return null;
    } catch (e) {
      if (i < retries) { await sleep(1000 * (i + 1)); continue; }
      return null;
    }
  }
  return null;
}

/* ── Yahoo v7 quote for batch symbols ─────────────────────────── */
async function yahooBatchQuote(symbols, retries = 2) {
  const syms = symbols.join(",");
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}&crumb=${encodeURIComponent(yahooCrumb)}`;
  
  for (let i = 0; i <= retries; i++) {
    try {
      const data = await fetchJSON(url);
      if (data?.quoteResponse?.result) {
        return data.quoteResponse.result;
      }
      if (data?.finance?.error?.code === "Unauthorized") {
        console.log("  Crumb expired, refreshing...");
        await getYahooCrumb();
        continue;
      }
      return [];
    } catch (e) {
      if (i < retries) { await sleep(1000 * (i + 1)); continue; }
      return [];
    }
  }
  return [];
}

/* ── Extract update from Yahoo quote ──────────────────────────── */
function extractFromQuote(q) {
  const update = {};
  
  if (q.marketCap) update.marketCap = q.marketCap;
  if (q.trailingPE) update.pe = q.trailingPE;
  if (q.epsTrailingTwelveMonths) update.eps = q.epsTrailingTwelveMonths;
  if (q.fiftyDayAverage) update.fiftyDayAverage = q.fiftyDayAverage;
  if (q.twoHundredDayAverage) update.twoHundredDayAverage = q.twoHundredDayAverage;
  if (q.averageDailyVolume3Month) update.avgVolume = q.averageDailyVolume3Month;
  if (q.trailingAnnualDividendYield) update.dividendYield = q.trailingAnnualDividendYield;
  if (q.priceToBook) update.priceToBook = q.priceToBook;
  if (q.shortName) update.shortName = q.shortName;
  if (q.longName) update.companyName = q.longName;
  if (q.sector) update.sector = q.sector;
  if (q.industry) update.industry = q.industry;
  if (q.bookValue) update.bookValue = q.bookValue;
  if (q.fiftyTwoWeekHigh) update.week52High = q.fiftyTwoWeekHigh;
  if (q.fiftyTwoWeekLow) update.week52Low = q.fiftyTwoWeekLow;
  
  return update;
}

/* ── Extract update from Yahoo quoteSummary ───────────────────── */
function extractFromSummary(result) {
  const update = {};
  const price = result.price || {};
  const detail = result.summaryDetail || {};
  const stats = result.defaultKeyStatistics || {};
  const fin = result.financialData || {};
  const profile = result.assetProfile || {};

  // Price module
  if (price.marketCap?.raw) update.marketCap = price.marketCap.raw;
  
  // Summary detail
  if (detail.trailingPE?.raw) update.pe = detail.trailingPE.raw;
  if (detail.forwardPE?.raw) update.forwardPE = detail.forwardPE.raw;
  if (detail.dividendYield?.raw) update.dividendYield = detail.dividendYield.raw;
  if (detail.beta?.raw) update.beta = detail.beta.raw;
  if (detail.averageVolume?.raw) update.avgVolume = detail.averageVolume.raw;
  if (detail.fiftyTwoWeekHigh?.raw) update.week52High = detail.fiftyTwoWeekHigh.raw;
  if (detail.fiftyTwoWeekLow?.raw) update.week52Low = detail.fiftyTwoWeekLow.raw;
  
  // Key statistics
  if (stats.trailingEps?.raw) update.eps = stats.trailingEps.raw;
  if (stats.priceToBook?.raw) update.priceToBook = stats.priceToBook.raw;
  if (stats.pegRatio?.raw) update.peg = stats.pegRatio.raw;
  if (stats.enterpriseValue?.raw) update.enterpriseValue = stats.enterpriseValue.raw;
  if (stats.bookValue?.raw) update.bookValue = stats.bookValue.raw;
  
  // Financial data
  if (fin.returnOnEquity?.raw) update.roe = fin.returnOnEquity.raw;
  if (fin.totalRevenue?.raw) update.revenue = fin.totalRevenue.raw;
  if (fin.revenueGrowth?.raw) update.revenueGrowth = fin.revenueGrowth.raw;
  if (fin.grossMargins?.raw) update.grossMargin = fin.grossMargins.raw;
  if (fin.operatingMargins?.raw) update.operatingMargin = fin.operatingMargins.raw;
  if (fin.profitMargins?.raw) update.profitMargin = fin.profitMargins.raw;
  if (fin.earningsGrowth?.raw) update.epsGrowth = fin.earningsGrowth.raw;
  if (fin.targetMeanPrice?.raw) update.analystTargetPrice = fin.targetMeanPrice.raw;
  if (fin.recommendationKey) {
    const rec = fin.recommendationKey;
    if (rec === "strong_buy" || rec === "strongBuy") update.analystRating = "strong-buy";
    else if (rec === "buy") update.analystRating = "buy";
    else if (rec === "sell") update.analystRating = "sell";
    else if (rec === "strong_sell" || rec === "strongSell") update.analystRating = "strong-sell";
    else update.analystRating = "neutral";
  }
  
  // Asset profile
  if (profile.website) {
    try { update.companyDomain = new URL(profile.website).hostname.replace(/^www\./, ""); } catch {}
  }
  if (profile.sector) update.sector = profile.sector;
  if (profile.industry) update.industry = profile.industry;
  if (profile.longBusinessSummary) update.description = profile.longBusinessSummary.slice(0, 500);
  if (profile.country) update.profileCountry = profile.country;
  if (profile.fullTimeEmployees) update.employees = profile.fullTimeEmployees;
  
  return update;
}

/* ── Main ───────────────────────────────────────────────────────── */
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const ca = db.collection("cleanassets");
  const sym = db.collection("symbols");

  console.log(`\n${"█".repeat(60)}`);
  console.log(`  YAHOO FINANCE ENRICHMENT | Type: ${TYPE} | Limit: ${LIMIT}`);
  console.log(`${"█".repeat(60)}\n`);

  // Get Yahoo crumb
  await getYahooCrumb();

  // Get unique symbols that need enrichment (missing marketCap, pe, or eps)
  const docs = await ca.aggregate([
    {
      $match: {
        type: TYPE,
        $or: [
          { marketCap: { $in: [null, 0] } }, { marketCap: { $exists: false } },
          { pe: { $in: [null, 0] } }, { pe: { $exists: false } },
          { eps: { $in: [null, 0] } }, { eps: { $exists: false } }
        ]
      }
    },
    { $group: { _id: "$symbol" } },
    { $limit: LIMIT }
  ]).toArray();

  const symbols = docs.map(d => d._id);
  console.log(`  Symbols to enrich: ${symbols.length}`);

  if (CHECK_ONLY) {
    await client.close();
    return;
  }

  // Phase A: Batch quote (fast, ~10 symbols per request)
  console.log(`\n${"═".repeat(60)}`);
  console.log("  PHASE A: Yahoo Batch Quote (marketCap, PE, EPS, avgVolume)");
  console.log(`${"═".repeat(60)}`);

  let enriched = 0, failed = 0, batchNum = 0;
  const startTime = Date.now();
  const enrichedSymbols = new Set();

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    batchNum++;
    
    const quotes = await yahooBatchQuote(batch);
    
    for (const q of quotes) {
      if (!q.symbol) continue;
      const update = extractFromQuote(q);
      if (Object.keys(update).length > 0) {
        update.metadataUpdatedAt = new Date();
        update.yahooenrichedAt = new Date();
        await sym.updateMany({ symbol: q.symbol }, { $set: update }).catch(() => {});
        await ca.updateMany({ symbol: q.symbol }, { $set: update }).catch(() => {});
        enriched++;
        enrichedSymbols.add(q.symbol);
      }
    }

    const batchFailed = batch.length - quotes.filter(q => q.symbol && Object.keys(extractFromQuote(q)).length > 0).length;
    failed += batchFailed;
    
    await sleep(DELAY_MS);

    if (batchNum <= 5 || batchNum % 50 === 0 || i + BATCH_SIZE >= symbols.length) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      const rate = enriched > 0 ? (enriched / ((Date.now() - startTime) / 60000)).toFixed(0) : "0";
      console.log(`  [batch ${batchNum}, ${Math.min(i + BATCH_SIZE, symbols.length)}/${symbols.length}] ✓${enriched} ✗${failed} | ${elapsed}min | ${rate}/min`);
    }
  }

  console.log(`\n  Phase A complete: enriched=${enriched}, failed=${failed}`);

  // Phase B: Deep quoteSummary for symbols that succeeded in Phase A (gets ROE, revenue, analyst, domain)
  console.log(`\n${"═".repeat(60)}`);
  console.log("  PHASE B: Yahoo QuoteSummary (ROE, revenue, analyst, domain)");
  console.log(`${"═".repeat(60)}`);

  // Only deep-enrich symbols that need more data AND were found by Yahoo
  const needsDeep = await ca.aggregate([
    {
      $match: {
        type: TYPE,
        symbol: { $in: [...enrichedSymbols] },
        $or: [
          { roe: { $in: [null, 0] } }, { roe: { $exists: false } },
          { revenue: { $in: [null, 0] } }, { revenue: { $exists: false } },
          { analystRating: { $in: [null, ""] } }, { analystRating: { $exists: false } }
        ]
      }
    },
    { $group: { _id: "$symbol" } },
    { $limit: LIMIT }
  ]).toArray();

  const deepSymbols = needsDeep.map(d => d._id);
  console.log(`  ${deepSymbols.length} symbols need deep enrichment`);

  let deepEnriched = 0, deepFailed = 0;
  const deepStart = Date.now();

  for (let i = 0; i < deepSymbols.length; i++) {
    const symbol = deepSymbols[i];
    const result = await yahooQuoteSummary(symbol);

    if (result) {
      const update = extractFromSummary(result);
      if (Object.keys(update).length > 0) {
        update.metadataUpdatedAt = new Date();
        update.yahooDeepEnrichedAt = new Date();
        await sym.updateMany({ symbol }, { $set: update }).catch(() => {});
        await ca.updateMany({ symbol }, { $set: update }).catch(() => {});
        deepEnriched++;
      } else {
        deepFailed++;
      }
    } else {
      deepFailed++;
    }

    await sleep(DELAY_MS);

    if ((i + 1) <= 10 || (i + 1) % 200 === 0 || i + 1 === deepSymbols.length) {
      const elapsed = ((Date.now() - deepStart) / 60000).toFixed(1);
      const rate = deepEnriched > 0 ? (deepEnriched / ((Date.now() - deepStart) / 60000)).toFixed(0) : "0";
      console.log(`  [${i + 1}/${deepSymbols.length}] ✓${deepEnriched} ✗${deepFailed} | ${elapsed}min | ${rate}/min | ${symbol}`);
    }
  }

  console.log(`\n  Phase B complete: enriched=${deepEnriched}, failed=${deepFailed}`);

  // Final report
  console.log(`\n${"═".repeat(60)}`);
  console.log("  FINAL NULL RATES");
  console.log(`${"═".repeat(60)}`);
  const total = await ca.countDocuments({ type: TYPE });
  const fields = ["marketCap","pe","eps","beta","sector","avgVolume","revenue","epsGrowth","revenueGrowth","roe","dividendYield","analystRating","companyDomain","iconUrl"];
  for (const f of fields) {
    const filled = await ca.countDocuments({
      type: TYPE,
      [f]: { $exists: true, $ne: null, $ne: "", $nin: [0] }
    });
    const pct = ((filled / total) * 100).toFixed(1);
    const bar = "█".repeat(Math.round((filled / total) * 30)) + "░".repeat(30 - Math.round((filled / total) * 30));
    console.log(`  ${f.padEnd(16)} ${bar} ${pct}% (${filled}/${total})`);
  }

  console.log(`\n${"█".repeat(60)}`);
  console.log(`  YAHOO ENRICHMENT COMPLETE`);
  console.log(`  Phase A: ${enriched} batch-enriched`);
  console.log(`  Phase B: ${deepEnriched} deep-enriched`);
  console.log(`  Total time: ${((Date.now() - startTime) / 60000).toFixed(1)} min`);
  console.log(`${"█".repeat(60)}\n`);

  await client.close();
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
