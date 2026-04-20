/**
 * INDIA YAHOO ENRICHMENT v2 — NO-CLOBBER MERGE
 *
 * Guarantees:
 *  - Never overwrite an existing non-null/non-zero/non-empty value with a weaker
 *    (null/0/"") value from Yahoo.
 *  - Per-field audit: writes `{field}EnrichedFrom` and `{field}EnrichedAt`
 *    metadata only when the field is actually set.
 *  - Covers IN stocks sorted by marketCap; sweeps NSE first, BSE fallback.
 *
 * Reports:
 *  /tmp/india_enrichment_before_after_v2.csv
 *  /tmp/india_failed_symbols_with_reason_v2.csv
 *  /tmp/india_enrichment_regression_fix.md
 */
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const https = require("https");

function loadEnv() {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = l.trim(); if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("="); if (i === -1) continue;
    const k = t.slice(0, i).trim(); if (process.env[k]) continue;
    let v = t.slice(i + 1).trim();
    if ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'")) v = v.slice(1, -1);
    process.env[k] = v;
  }
}
loadEnv();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith("--")).map(a => { const [k, v] = a.slice(2).split("="); return [k, v ?? "true"]; }));
const LIMIT = Number(args.limit) || 1500;
const DELAY_MS = 200;
const BATCH = 10;

const FIELDS = ["marketCap","pe","eps","beta","avgVolume","dividendYield","roe","revenue","revenueGrowth","epsGrowth","earningsGrowth","analystRating","peg","volume","price","sector","industry"];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
let cookies = null, crumb = null;
function request(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({ hostname: u.hostname, path: u.pathname + u.search, timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", ...(cookies ? { Cookie: cookies } : {}), ...headers } },
      (res) => {
        const chunks = [];
        if (!cookies && res.headers["set-cookie"]) cookies = res.headers["set-cookie"].map(c => c.split(";")[0]).join("; ");
        res.on("data", d => chunks.push(d));
        res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      }
    );
    req.on("error", reject); req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}
async function getCrumb() {
  try {
    await request("https://fc.yahoo.com/");
    const r = await request("https://query2.finance.yahoo.com/v1/test/getcrumb");
    if (r.status === 200) crumb = r.body.trim();
  } catch {}
}
async function yahooBatchQuote(syms) {
  try {
    const q = encodeURIComponent(syms.join(","));
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${q}${crumb ? "&crumb=" + encodeURIComponent(crumb) : ""}`;
    const r = await request(url);
    if (r.status !== 200) return null;
    return JSON.parse(r.body)?.quoteResponse?.result || [];
  } catch { return null; }
}
async function yahooQuoteSummary(sym) {
  const modules = "summaryDetail,defaultKeyStatistics,financialData,assetProfile,price";
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${modules}${crumb ? "&crumb=" + encodeURIComponent(crumb) : ""}`;
  try {
    const r = await request(url);
    if (r.status !== 200) return null;
    return JSON.parse(r.body)?.quoteSummary?.result?.[0] || null;
  } catch { return null; }
}

function yahooSuffix(e) { return e === "NSE" ? ".NS" : e === "BSE" ? ".BO" : ""; }

function fromQuote(q) {
  const u = {};
  if (q.marketCap > 0) u.marketCap = q.marketCap;
  if (q.trailingPE > 0) u.pe = q.trailingPE;
  if (typeof q.epsTrailingTwelveMonths === "number" && q.epsTrailingTwelveMonths !== 0) u.eps = q.epsTrailingTwelveMonths;
  if (q.averageDailyVolume3Month > 0) u.avgVolume = q.averageDailyVolume3Month;
  if (q.trailingAnnualDividendYield > 0) u.dividendYield = q.trailingAnnualDividendYield;
  if (q.regularMarketPrice > 0) u.price = q.regularMarketPrice;
  if (q.regularMarketVolume > 0) u.volume = q.regularMarketVolume;
  if (q.fiftyTwoWeekHigh > 0) u.week52High = q.fiftyTwoWeekHigh;
  if (q.fiftyTwoWeekLow > 0) u.week52Low = q.fiftyTwoWeekLow;
  return u;
}
function fromSummary(r) {
  const u = {}, d = r.summaryDetail || {}, s = r.defaultKeyStatistics || {}, f = r.financialData || {}, p = r.assetProfile || {}, pr = r.price || {};
  if (pr.marketCap?.raw > 0) u.marketCap = pr.marketCap.raw;
  if (d.trailingPE?.raw > 0) u.pe = d.trailingPE.raw;
  if (d.dividendYield?.raw > 0) u.dividendYield = d.dividendYield.raw;
  if (typeof d.beta?.raw === "number" && d.beta.raw !== 0) u.beta = d.beta.raw;
  if (d.averageVolume?.raw > 0) u.avgVolume = d.averageVolume.raw;
  if (typeof s.trailingEps?.raw === "number" && s.trailingEps.raw !== 0) u.eps = s.trailingEps.raw;
  if (s.pegRatio?.raw !== undefined && s.pegRatio.raw !== 0) u.peg = s.pegRatio.raw;
  if (typeof f.returnOnEquity?.raw === "number" && f.returnOnEquity.raw !== 0) u.roe = f.returnOnEquity.raw;
  if (f.totalRevenue?.raw > 0) u.revenue = f.totalRevenue.raw;
  if (typeof f.revenueGrowth?.raw === "number" && f.revenueGrowth.raw !== 0) u.revenueGrowth = f.revenueGrowth.raw;
  if (typeof f.earningsGrowth?.raw === "number" && f.earningsGrowth.raw !== 0) { u.earningsGrowth = f.earningsGrowth.raw; u.epsGrowth = f.earningsGrowth.raw; }
  if (f.recommendationKey) {
    const rec = f.recommendationKey;
    const mapped = rec === "strong_buy" || rec === "strongBuy" ? "strong-buy"
      : rec === "buy" ? "buy" : rec === "sell" ? "sell"
      : rec === "strong_sell" || rec === "strongSell" ? "strong-sell"
      : rec === "hold" || rec === "neutral" ? "neutral" : null;
    if (mapped) u.analystRating = mapped;
  }
  if (p.sector && p.sector.trim()) u.sector = p.sector.trim();
  if (p.industry && p.industry.trim()) u.industry = p.industry.trim();
  return u;
}

/* NO-CLOBBER merge: per-field update only if doc currently has null/0/"" or is missing the field */
async function noClobberSet(coll, baseFilter, update, source) {
  let written = 0;
  for (const [field, value] of Object.entries(update)) {
    if (value === null || value === undefined || value === "" || value === 0) continue;
    const guard = { [field]: { $in: [null, 0, ""] } };
    const missing = { [field]: { $exists: false } };
    const r = await coll.updateMany(
      { ...baseFilter, $or: [guard, missing] },
      { $set: {
          [field]: value,
          [`enrichMeta.${field}.source`]: source,
          [`enrichMeta.${field}.updatedAt`]: new Date(),
      }}
    ).catch(() => ({ modifiedCount: 0 }));
    if (r.modifiedCount) written += r.modifiedCount;
  }
  return written;
}

async function nullRates(ca) {
  const base = { isActive: true, type: "stock", country: "IN" };
  const tot = await ca.countDocuments(base);
  const out = { total: tot };
  for (const f of FIELDS) {
    const n = await ca.countDocuments({ $and: [base, { $or: [{ [f]: { $exists: false } }, { [f]: null }, { [f]: "" }, { [f]: 0 }] }] });
    out[f] = { nulls: n, pct: tot ? +(n * 100 / tot).toFixed(1) : 0 };
  }
  return out;
}

(async () => {
  const c = new MongoClient(MONGO_URI); await c.connect();
  const ca = c.db().collection("cleanassets");
  const sym = c.db().collection("symbols");

  console.log("=== INDIA YAHOO ENRICHMENT v2 (no-clobber) ===");
  const before = await nullRates(ca);
  fs.writeFileSync("/tmp/india_enrich_before_v2.json", JSON.stringify(before, null, 2));
  await getCrumb();

  const docs = await ca.aggregate([
    { $match: { isActive: true, type: "stock", country: "IN", exchange: { $in: ["NSE", "BSE"] } } },
    { $sort: { marketCap: -1, exchange: 1 } },
    { $group: { _id: "$symbol", exchange: { $first: "$exchange" }, fullSymbol: { $first: "$fullSymbol" }, marketCap: { $first: "$marketCap" } } },
    { $sort: { marketCap: -1 } },
    { $limit: LIMIT }
  ]).toArray();

  console.log(`Processing ${docs.length} unique IN symbols`);
  const failed = []; let enriched = 0, totalFieldsWritten = 0;
  const startedAt = Date.now();

  for (let i = 0; i < docs.length; i += BATCH) {
    const chunk = docs.slice(i, i + BATCH);
    const nsMap = new Map(chunk.map(d => [d._id + yahooSuffix(d.exchange), d]));
    const ySyms = [...nsMap.keys()];
    let quotes = await yahooBatchQuote(ySyms);
    if (!quotes) quotes = await yahooBatchQuote(ySyms) || [];

    const resolved = new Set();
    for (const q of quotes) {
      if (!q.symbol) continue;
      resolved.add(q.symbol);
      const d = nsMap.get(q.symbol); if (!d) continue;
      const u = fromQuote(q);
      if (Object.keys(u).length) {
        totalFieldsWritten += await noClobberSet(ca, { symbol: d._id, country: "IN" }, u, "yahoo-quote");
        await noClobberSet(sym, { symbol: d._id }, u, "yahoo-quote");
        enriched++;
      }
    }
    for (const [ysym, d] of nsMap.entries()) {
      if (resolved.has(ysym)) continue;
      const alt = d._id + (d.exchange === "NSE" ? ".BO" : ".NS");
      const r2 = await yahooBatchQuote([alt]);
      if (r2 && r2[0]?.symbol) {
        const u = fromQuote(r2[0]);
        if (Object.keys(u).length) {
          totalFieldsWritten += await noClobberSet(ca, { symbol: d._id, country: "IN" }, u, "yahoo-quote-fallback");
          await noClobberSet(sym, { symbol: d._id }, u, "yahoo-quote-fallback");
          enriched++; resolved.add(alt);
        } else failed.push({ symbol: d._id, exchange: d.exchange, reason: "no_fields_extracted" });
      } else failed.push({ symbol: d._id, exchange: d.exchange, reason: "not_found_on_yahoo" });
      await sleep(DELAY_MS);
    }
    await sleep(DELAY_MS);
    if ((i / BATCH) % 10 === 0) {
      const min = ((Date.now() - startedAt) / 60000).toFixed(1);
      console.log(`  [${Math.min(i + BATCH, docs.length)}/${docs.length}] enriched=${enriched} writes=${totalFieldsWritten} failed=${failed.length} ${min}min`);
    }
  }

  console.log("\n=== PHASE B: deep summary ===");
  const phaseB = await ca.aggregate([
    { $match: { isActive: true, type: "stock", country: "IN",
      $or: [{ roe: { $in: [null, 0] } }, { roe: { $exists: false } }, { revenue: { $in: [null, 0] } }, { analystRating: { $in: [null, ""] } }] } },
    { $group: { _id: "$symbol", exchange: { $first: "$exchange" }, marketCap: { $first: "$marketCap" } } },
    { $sort: { marketCap: -1 } },
    { $limit: LIMIT }
  ]).toArray();
  console.log(`Deep ${phaseB.length} symbols`);
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
        totalFieldsWritten += await noClobberSet(ca, { symbol: d._id, country: "IN" }, u, "yahoo-summary");
        await noClobberSet(sym, { symbol: d._id }, u, "yahoo-summary");
        deep++;
      }
    }
    await sleep(DELAY_MS);
    if ((i + 1) % 50 === 0) console.log(`  [${i + 1}/${phaseB.length}] deep=${deep} writes=${totalFieldsWritten}`);
  }

  const after = await nullRates(ca);
  fs.writeFileSync("/tmp/india_enrich_after_v2.json", JSON.stringify(after, null, 2));

  const csvBA = ["field,before_nulls,before_pct,after_nulls,after_pct,delta_pct"];
  for (const f of FIELDS) {
    const b = before[f], a = after[f];
    csvBA.push(`${f},${b.nulls},${b.pct},${a.nulls},${a.pct},${(+(a.pct - b.pct)).toFixed(1)}`);
  }
  fs.writeFileSync("/tmp/india_enrichment_before_after_v2.csv", csvBA.join("\n"));

  const csvF = ["symbol,exchange,reason"];
  failed.forEach(f => csvF.push(`${f.symbol},${f.exchange},${f.reason}`));
  fs.writeFileSync("/tmp/india_failed_symbols_with_reason_v2.csv", csvF.join("\n"));

  console.log(`\n=== DONE === enriched=${enriched} deep=${deep} fieldsWritten=${totalFieldsWritten} failed=${failed.length}`);
  await c.close();
})().catch(e => { console.error("FATAL", e); process.exit(1); });
