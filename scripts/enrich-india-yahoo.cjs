/**
 * INDIA YAHOO FINANCE ENRICHMENT
 * Maps NSE:XXX -> XXX.NS and BSE:XXX -> XXX.BO (Yahoo format), fetches
 * fundamentals, writes back into both `cleanassets` and `symbols` under
 * the canonical (no-suffix) symbol. Handles dual-exchange listings by
 * preferring NSE when both exist.
 *
 * Writes reports:
 *   /tmp/india_enrich_before.json   (null rates before)
 *   /tmp/india_enrich_after.json    (null rates after)
 *   /tmp/india_failed_symbols.csv   (symbol,exchange,reason)
 *
 * Usage:
 *   node scripts/enrich-india-yahoo.cjs --limit=500
 *   node scripts/enrich-india-yahoo.cjs --limit=500 --sort=marketCap
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const https = require("https");

function loadEnv() {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (process.env[k]) continue;
    let v = t.slice(eq + 1).trim();
    if ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'")) v = v.slice(1, -1);
    process.env[k] = v;
  }
}
loadEnv();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, v] = a.slice(2).split("="); return [k, v ?? "true"]; })
);
const LIMIT = Number(args.limit) || 500;
const DELAY_MS = 300;
const BATCH_SIZE = 10;

const FIELDS = ["marketCap","pe","eps","beta","avgVolume","dividendYield","roe","revenue","revenueGrowth","epsGrowth","earningsGrowth","analystRating","peg","volume","price","sector","industry"];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let cookies = null, crumb = null;
function request(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname, path: u.pathname + u.search, timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        ...(cookies ? { Cookie: cookies } : {}),
        ...headers
      }
    }, res => {
      if (res.headers["set-cookie"]) {
        const nc = res.headers["set-cookie"].map(c => c.split(";")[0]).join("; ");
        cookies = cookies ? cookies + "; " + nc : nc;
      }
      let d = ""; res.on("data", c => d += c); res.on("end", () => resolve({ data: d, status: res.statusCode }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}
async function getCrumb() {
  await request("https://fc.yahoo.com/").catch(() => {});
  const r = await request("https://query2.finance.yahoo.com/v1/test/getcrumb");
  crumb = r.data.trim();
  console.log("crumb:", crumb.slice(0, 12) + "...");
}
async function fetchJSON(url) {
  const r = await request(url);
  try { return JSON.parse(r.data); } catch { return null; }
}

async function yahooBatchQuote(symbols) {
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}&crumb=${encodeURIComponent(crumb)}`;
  const d = await fetchJSON(url);
  if (d?.finance?.error?.code === "Unauthorized") { await getCrumb(); return null; }
  return d?.quoteResponse?.result || [];
}
async function yahooQuoteSummary(sym) {
  const modules = "price,summaryDetail,defaultKeyStatistics,financialData,assetProfile";
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;
  const d = await fetchJSON(url);
  if (d?.quoteSummary?.error?.code === "Unauthorized") { await getCrumb(); return null; }
  return d?.quoteSummary?.result?.[0] || null;
}

function yahooSuffix(exchange) {
  if (exchange === "NSE") return ".NS";
  if (exchange === "BSE") return ".BO";
  return "";
}

function fromQuote(q) {
  const u = {};
  if (q.marketCap) u.marketCap = q.marketCap;
  if (q.trailingPE) u.pe = q.trailingPE;
  if (q.epsTrailingTwelveMonths) u.eps = q.epsTrailingTwelveMonths;
  if (q.averageDailyVolume3Month) u.avgVolume = q.averageDailyVolume3Month;
  if (q.trailingAnnualDividendYield) u.dividendYield = q.trailingAnnualDividendYield;
  if (q.regularMarketPrice) u.price = q.regularMarketPrice;
  if (q.regularMarketVolume) u.volume = q.regularMarketVolume;
  if (q.fiftyTwoWeekHigh) u.week52High = q.fiftyTwoWeekHigh;
  if (q.fiftyTwoWeekLow) u.week52Low = q.fiftyTwoWeekLow;
  return u;
}
function fromSummary(r) {
  const u = {};
  const d = r.summaryDetail || {}, s = r.defaultKeyStatistics || {}, f = r.financialData || {}, p = r.assetProfile || {}, pr = r.price || {};
  if (pr.marketCap?.raw) u.marketCap = pr.marketCap.raw;
  if (d.trailingPE?.raw) u.pe = d.trailingPE.raw;
  if (d.dividendYield?.raw) u.dividendYield = d.dividendYield.raw;
  if (d.beta?.raw) u.beta = d.beta.raw;
  if (d.averageVolume?.raw) u.avgVolume = d.averageVolume.raw;
  if (s.trailingEps?.raw) u.eps = s.trailingEps.raw;
  if (s.pegRatio?.raw) u.peg = s.pegRatio.raw;
  if (f.returnOnEquity?.raw) u.roe = f.returnOnEquity.raw;
  if (f.totalRevenue?.raw) u.revenue = f.totalRevenue.raw;
  if (f.revenueGrowth?.raw) u.revenueGrowth = f.revenueGrowth.raw;
  if (f.earningsGrowth?.raw) { u.earningsGrowth = f.earningsGrowth.raw; u.epsGrowth = f.earningsGrowth.raw; }
  if (f.recommendationKey) {
    const rec = f.recommendationKey;
    u.analystRating = rec === "strong_buy" || rec === "strongBuy" ? "strong-buy"
      : rec === "buy" ? "buy"
      : rec === "sell" ? "sell"
      : rec === "strong_sell" || rec === "strongSell" ? "strong-sell"
      : "neutral";
  }
  if (p.sector) u.sector = p.sector;
  if (p.industry) u.industry = p.industry;
  return u;
}

async function nullRates(ca) {
  const base = { isActive: true, type: "stock", country: "IN" };
  const tot = await ca.countDocuments(base);
  const out = { total: tot };
  for (const f of FIELDS) {
    const n = await ca.countDocuments({
      $and: [ base, { $or: [ { [f]: { $exists: false } }, { [f]: null }, { [f]: "" }, { [f]: 0 } ] } ]
    });
    out[f] = { nulls: n, pct: tot ? +(n * 100 / tot).toFixed(1) : 0 };
  }
  return out;
}

(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();
  const ca = db.collection("cleanassets");
  const sym = db.collection("symbols");

  console.log("\n=== INDIA YAHOO ENRICHMENT ===");
  const before = await nullRates(ca);
  console.log("BEFORE total:", before.total);
  fs.writeFileSync("/tmp/india_enrich_before.json", JSON.stringify(before, null, 2));

  await getCrumb();

  // Pick top-LIMIT unique symbols by market cap (prefer NSE when dual-listed)
  const docs = await ca.aggregate([
    { $match: { isActive: true, type: "stock", country: "IN", exchange: { $in: ["NSE","BSE"] } } },
    { $sort: { marketCap: -1, exchange: 1 } }, // NSE < BSE alpha -> NSE first
    { $group: {
        _id: "$symbol",
        exchange: { $first: "$exchange" },
        fullSymbol: { $first: "$fullSymbol" },
        marketCap: { $first: "$marketCap" }
    } },
    { $sort: { marketCap: -1 } },
    { $limit: LIMIT }
  ]).toArray();

  console.log(`Processing ${docs.length} unique India symbols (top by market cap)`);

  const failed = [];
  let enriched = 0, skipped = 0;
  const startedAt = Date.now();

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    // Try NSE (.NS) first for each
    const nsMap = new Map(chunk.map(d => [d._id + yahooSuffix(d.exchange), d]));
    const ySymbols = [...nsMap.keys()];

    let quotes = await yahooBatchQuote(ySymbols);
    if (!quotes) quotes = await yahooBatchQuote(ySymbols) || [];

    const resolvedYSymbols = new Set();
    for (const q of quotes) {
      if (!q.symbol) continue;
      resolvedYSymbols.add(q.symbol);
      const d = nsMap.get(q.symbol);
      if (!d) continue;
      const update = fromQuote(q);
      if (Object.keys(update).length) {
        update.metadataUpdatedAt = new Date();
        update.yahooIndiaEnrichedAt = new Date();
        await ca.updateMany({ symbol: d._id, country: "IN" }, { $set: update }).catch(() => {});
        await sym.updateMany({ symbol: d._id }, { $set: update }).catch(() => {});
        enriched++;
      }
    }
    // For unresolved on NSE, try BSE fallback
    for (const [ysym, d] of nsMap.entries()) {
      if (resolvedYSymbols.has(ysym)) continue;
      const altSuffix = d.exchange === "NSE" ? ".BO" : ".NS";
      const alt = d._id + altSuffix;
      const r2 = await yahooBatchQuote([alt]);
      if (r2 && r2[0]?.symbol) {
        const u = fromQuote(r2[0]);
        if (Object.keys(u).length) {
          u.metadataUpdatedAt = new Date();
          u.yahooIndiaEnrichedAt = new Date();
          await ca.updateMany({ symbol: d._id, country: "IN" }, { $set: u }).catch(() => {});
          await sym.updateMany({ symbol: d._id }, { $set: u }).catch(() => {});
          enriched++;
          resolvedYSymbols.add(alt);
        } else {
          failed.push({ symbol: d._id, exchange: d.exchange, reason: "no_fields_extracted" });
        }
      } else {
        failed.push({ symbol: d._id, exchange: d.exchange, reason: "not_found_on_yahoo" });
      }
      await sleep(DELAY_MS);
    }

    await sleep(DELAY_MS);
    if ((i / BATCH_SIZE) % 5 === 0) {
      const min = ((Date.now() - startedAt) / 60000).toFixed(1);
      console.log(`  [${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}] enriched=${enriched} failed=${failed.length} ${min}min`);
    }
  }

  // Deep enrichment for enriched symbols to get ROE/revenue/analyst
  console.log("\n=== PHASE B: deep enrichment ===");
  const phaseB = await ca.aggregate([
    { $match: { isActive: true, type: "stock", country: "IN",
      yahooIndiaEnrichedAt: { $exists: true },
      $or: [ { roe: { $in: [null, 0] } }, { roe: { $exists: false } }, { revenue: { $in: [null, 0] } } ] } },
    { $group: { _id: "$symbol", exchange: { $first: "$exchange" } } },
    { $limit: LIMIT }
  ]).toArray();
  console.log(`Deep-enriching ${phaseB.length} symbols`);
  let deep = 0;
  for (let i = 0; i < phaseB.length; i++) {
    const d = phaseB[i];
    const ysym = d._id + yahooSuffix(d.exchange);
    let r = await yahooQuoteSummary(ysym);
    if (!r && d.exchange === "NSE") r = await yahooQuoteSummary(d._id + ".BO");
    if (!r && d.exchange === "BSE") r = await yahooQuoteSummary(d._id + ".NS");
    if (r) {
      const u = fromSummary(r);
      if (Object.keys(u).length) {
        u.metadataUpdatedAt = new Date();
        u.yahooIndiaDeepAt = new Date();
        await ca.updateMany({ symbol: d._id, country: "IN" }, { $set: u }).catch(() => {});
        await sym.updateMany({ symbol: d._id }, { $set: u }).catch(() => {});
        deep++;
      }
    }
    await sleep(DELAY_MS);
    if ((i + 1) % 50 === 0 || i + 1 === phaseB.length) {
      console.log(`  [${i + 1}/${phaseB.length}] deep=${deep}`);
    }
  }

  const after = await nullRates(ca);
  fs.writeFileSync("/tmp/india_enrich_after.json", JSON.stringify(after, null, 2));

  // CSV reports
  const csvBA = ["field,before_nulls,before_pct,after_nulls,after_pct,delta_pct"];
  for (const f of FIELDS) {
    const b = before[f], a = after[f];
    csvBA.push(`${f},${b.nulls},${b.pct},${a.nulls},${a.pct},${(+(a.pct - b.pct)).toFixed(1)}`);
  }
  fs.writeFileSync("/tmp/india_enrichment_before_after.csv", csvBA.join("\n"));

  const csvF = ["symbol,exchange,reason"];
  failed.forEach(f => csvF.push(`${f.symbol},${f.exchange},${f.reason}`));
  fs.writeFileSync("/tmp/india_failed_symbols_with_reason.csv", csvF.join("\n"));

  console.log(`\n=== DONE === enriched=${enriched} deep=${deep} failed=${failed.length}`);
  console.log("AFTER total:", after.total);
  console.log("Reports: /tmp/india_enrichment_before_after.csv, /tmp/india_failed_symbols_with_reason.csv");

  await client.close();
})().catch(e => { console.error("FATAL", e); process.exit(1); });
