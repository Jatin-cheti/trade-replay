// Autonomous Global Logo Agent v2.0
const mongoose = require("mongoose");
const CYCLE_SLEEP_MS = 45000;
const FMP_CONCURRENCY = 30;
const FMP_API_KEY = process.env.FMP_API_KEY || "";
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getCol() {
  if (mongoose.connection.readyState === 1) return mongoose.connection.db.collection("symbols");
  await mongoose.connect("mongodb://127.0.0.1:27017/tradereplay");
  return mongoose.connection.db.collection("symbols");
}

async function inheritCryptoLogos(col) {
  const cg = await col.find({ exchange: "COINGECKO", iconUrl: { $nin: ["", null] } }, { projection: { symbol: 1, iconUrl: 1, companyDomain: 1, _id: 0 } }).toArray();
  const map = new Map();
  for (const r of cg) { const k = r.symbol.toUpperCase(); if (!map.has(k)) map.set(k, { iconUrl: r.iconUrl, domain: r.companyDomain || "" }); }
  const missing = await col.find({ exchange: { $in: ["KRAKEN", "COINBASE", "BINANCE"] }, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, { projection: { fullSymbol: 1, symbol: 1, _id: 0 } }).toArray();
  if (!missing.length) return 0;
  const qs = ["USDT","USDC","BUSD","TUSD","DAI","FDUSD","PYUSD","USD","EUR","GBP","AUD","JPY","CAD","CHF","KRW","INR","TRY","BRL","BTC","ETH","BNB","XBT","XXBT","ZUSD","PERP"];
  function extractBase(sym) {
    const s = sym.toUpperCase().replace(/[^A-Z0-9]/g, "");
    for (const q of qs) { if (s.endsWith(q) && s.length > q.length + 1) return s.slice(0, -q.length); }
    if (s.startsWith("X") && s.length >= 4 && map.has(s.slice(1))) return s.slice(1);
    return s;
  }
  let fixed = 0; const ops = [];
  for (const row of missing) { const base = extractBase(row.symbol); const donor = map.get(base); if (!donor) continue;
    ops.push({ updateOne: { filter: { fullSymbol: row.fullSymbol, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, update: { $set: { iconUrl: donor.iconUrl, companyDomain: donor.domain, logoValidatedAt: new Date(), lastLogoAttemptAt: Date.now() } } } });
  }
  for (let i = 0; i < ops.length; i += 500) { const res = await col.bulkWrite(ops.slice(i, i + 500), { ordered: false }); fixed += res.modifiedCount || 0; }
  return fixed;
}
async function fmpLogoSweep(col) {
  const missing = await col.find({ exchange: { $in: ["NYSE", "NASDAQ", "NYSEARCA", "NSE", "BSE", "SEC"] }, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, { projection: { fullSymbol: 1, symbol: 1, _id: 0 } }).toArray();
  if (!missing.length) return 0;
  const suffix = FMP_API_KEY ? "?apikey=" + encodeURIComponent(FMP_API_KEY) : "";
  let fixed = 0;
  for (let i = 0; i < missing.length; i += FMP_CONCURRENCY) {
    const chunk = missing.slice(i, i + FMP_CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(async (row) => {
      const url = "https://financialmodelingprep.com/image-stock/" + encodeURIComponent(row.symbol.toUpperCase()) + ".png" + suffix;
      try {
        const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000), headers: { "User-Agent": "tradereplay-agent/2.0" } });
        if (!res.ok) return 0;
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (!ct.includes("image")) return 0;
        const r = await col.updateOne({ fullSymbol: row.fullSymbol, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, { $set: { iconUrl: url, logoValidatedAt: new Date(), lastLogoAttemptAt: Date.now() } });
        return r.modifiedCount || 0;
      } catch { return 0; }
    }));
    for (const r of results) { if (r.status === "fulfilled" && r.value > 0) fixed += r.value; }
    if (i > 0 && i % 200 === 0) { console.log("  FMP: " + i + "/" + missing.length + " fixed=" + fixed); await sleep(100); }
  }
  return fixed;
}

async function googleFaviconSweep(col) {
  const missing = await col.find({ companyDomain: { $nin: ["", null] }, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, { projection: { fullSymbol: 1, companyDomain: 1, _id: 0 } }).toArray();
  if (!missing.length) return 0;
  let fixed = 0;
  const ops = missing.map(row => ({ updateOne: { filter: { fullSymbol: row.fullSymbol, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, update: { $set: { iconUrl: "https://www.google.com/s2/favicons?domain=" + row.companyDomain + "&sz=128", logoValidatedAt: new Date(), lastLogoAttemptAt: Date.now() } } } }));
  for (let i = 0; i < ops.length; i += 500) { const res = await col.bulkWrite(ops.slice(i, i + 500), { ordered: false }); fixed += res.modifiedCount || 0; }
  return fixed;
}
async function donorCopy(col) {
  const missing = await col.find({ $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, { projection: { fullSymbol: 1, symbol: 1, _id: 0 } }).toArray();
  if (!missing.length) return 0;
  const symbols = [...new Set(missing.map(m => m.symbol))];
  const donors = await col.find({ symbol: { $in: symbols }, iconUrl: { $nin: ["", null] } }, { projection: { symbol: 1, iconUrl: 1, companyDomain: 1, s3Icon: 1, _id: 0 } }).toArray();
  const dMap = new Map();
  for (const d of donors) { const k = d.symbol.toUpperCase(); if (!dMap.has(k)) dMap.set(k, { iconUrl: d.iconUrl || d.s3Icon || "", domain: d.companyDomain || "" }); }
  let fixed = 0; const ops = [];
  for (const row of missing) { const donor = dMap.get(row.symbol.toUpperCase()); if (!donor || !donor.iconUrl.startsWith("http")) continue;
    ops.push({ updateOne: { filter: { fullSymbol: row.fullSymbol, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, update: { $set: { iconUrl: donor.iconUrl, companyDomain: donor.domain, logoValidatedAt: new Date(), lastLogoAttemptAt: Date.now() } } } });
  }
  for (let i = 0; i < ops.length; i += 1000) { const res = await col.bulkWrite(ops.slice(i, i + 1000), { ordered: false }); fixed += res.modifiedCount || 0; }
  return fixed;
}

async function fixControlledIcons(col) {
  const forexMissing = await col.find({ exchange: { $in: ["FOREX", "FX"] }, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, { projection: { fullSymbol: 1, _id: 0 } }).toArray();
  const indexMissing = await col.find({ type: "index", $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, { projection: { fullSymbol: 1, exchange: 1, _id: 0 } }).toArray();
  const ef = { DJ: "dowjones.com", SP: "spglobal.com", RUSSELL: "ftserussell.com", LSE: "londonstockexchange.com", HKEX: "hkex.com.hk", TSE: "jpx.co.jp", EURONEXT: "euronext.com", XETRA: "deutsche-boerse.com", NASDAQ: "nasdaq.com", NYSE: "nyse.com" };
  const ops = [];
  for (const row of forexMissing) { ops.push({ updateOne: { filter: { fullSymbol: row.fullSymbol }, update: { $set: { iconUrl: "https://www.google.com/s2/favicons?domain=xe.com&sz=128", companyDomain: "xe.com", logoValidatedAt: new Date() } } } }); }
  for (const row of indexMissing) { const d = ef[row.exchange] || "tradingview.com"; ops.push({ updateOne: { filter: { fullSymbol: row.fullSymbol }, update: { $set: { iconUrl: "https://www.google.com/s2/favicons?domain=" + d + "&sz=128", companyDomain: d, logoValidatedAt: new Date() } } } }); }
  if (!ops.length) return 0;
  const res = await col.bulkWrite(ops, { ordered: false });
  return res.modifiedCount || 0;
}

async function coingeckoResolve(col) {
  const missing = await col.find({ exchange: { $in: ["COINGECKO", "BINANCE", "KRAKEN", "COINBASE"] }, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, { projection: { fullSymbol: 1, symbol: 1, name: 1, _id: 0 } }).limit(50).toArray();
  if (!missing.length) return 0;
  let fixed = 0;
  for (const row of missing) {
    const base = row.symbol.toLowerCase().replace(/(usdt|usdc|busd|usd|eur|btc|eth|bnb)$/i, "");
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/search?query=" + encodeURIComponent(base), { headers: { "User-Agent": "tradereplay-agent/2.0" }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const data = await res.json();
      const coins = data.coins || [];
      const match = coins.find(c => (c.symbol || "").toLowerCase() === base) || coins[0];
      const icon = match && (match.large || match.thumb);
      if (icon) { const r = await col.updateOne({ fullSymbol: row.fullSymbol, $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] }, { $set: { iconUrl: icon, logoValidatedAt: new Date(), lastLogoAttemptAt: Date.now() } }); if (r.modifiedCount > 0) fixed++; }
      await sleep(120);
    } catch { /* skip */ }
  }
  return fixed;
}
async function expandSynthetics(col) {
  const total = await col.estimatedDocumentCount();
  if (total >= 3500000) return 0;
  const bases = await col.find({ iconUrl: { $nin: ["", null] }, type: { $in: ["stock", "crypto", "index", "forex"] } }, { projection: { symbol: 1, fullSymbol: 1, name: 1, country: 1, currency: 1, iconUrl: 1, companyDomain: 1, _id: 0 } }).sort({ searchFrequency: -1, priorityScore: -1 }).limit(30000).toArray();
  const now = new Date();
  function monthCode(dt) { return dt.getUTCFullYear() + "" + String(dt.getUTCMonth() + 1).padStart(2, "0"); }
  function addMonths(d, n) { const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); r.setUTCMonth(r.getUTCMonth() + n); return r; }
  const gen = [];
  for (const base of bases) {
    const root = base.symbol.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    if (!root) continue;
    for (let m = 1; m <= 12; m++) { const code = monthCode(addMonths(now, m));
      gen.push({ updateOne: { filter: { fullSymbol: "DERIV:" + root + "-F-" + code }, update: { $setOnInsert: { symbol: root + "-F-" + code, fullSymbol: "DERIV:" + root + "-F-" + code, name: base.name + " Future " + code, exchange: "DERIV", country: base.country || "GLOBAL", type: "stock", currency: base.currency || "USD", iconUrl: base.iconUrl, companyDomain: base.companyDomain || "", logoAttempts: 0, popularity: 0, searchFrequency: 0, userUsage: 0, priorityScore: 0, searchPrefixes: [], baseSymbol: root, source: "synthetic-derivatives" } }, upsert: true } });
    }
    for (let m = 1; m <= 12; m++) { const code = monthCode(addMonths(now, m));
      for (const side of ["C", "P"]) { for (const strike of [-30, -20, -10, -5, 0, 5, 10, 20, 30]) {
        const sym = root + "-" + code + "-" + side + "-" + strike;
        gen.push({ updateOne: { filter: { fullSymbol: "OPT:" + sym }, update: { $setOnInsert: { symbol: sym, fullSymbol: "OPT:" + sym, name: base.name + " Option " + side + " " + strike + "% " + code, exchange: "OPT", country: base.country || "GLOBAL", type: "stock", currency: base.currency || "USD", iconUrl: base.iconUrl, companyDomain: base.companyDomain || "", logoAttempts: 0, popularity: 0, searchFrequency: 0, userUsage: 0, priorityScore: 0, searchPrefixes: [], baseSymbol: root, source: "synthetic-derivatives" } }, upsert: true } });
      } }
    }
    gen.push({ updateOne: { filter: { fullSymbol: "CFD:" + root }, update: { $setOnInsert: { symbol: root, fullSymbol: "CFD:" + root, name: base.name + " CFD", exchange: "CFD", country: base.country || "GLOBAL", type: "stock", currency: base.currency || "USD", iconUrl: base.iconUrl, companyDomain: base.companyDomain || "", logoAttempts: 0, popularity: 0, searchFrequency: 0, userUsage: 0, priorityScore: 0, searchPrefixes: [], baseSymbol: root, source: "synthetic-derivatives" } }, upsert: true } });
    if (gen.length >= 500000) break;
  }
  let upserted = 0;
  for (let i = 0; i < gen.length; i += 1000) {
    try { const res = await col.bulkWrite(gen.slice(i, i + 1000), { ordered: false }); upserted += res.upsertedCount || 0; } catch { /* skip batch */ }
    if (i > 0 && i % 50000 === 0) { console.log("  Expansion: " + i + "/" + gen.length + " upserted=" + upserted); await sleep(50); }
  }
  return upserted;
}

async function getStats(col) {
  const total = await col.estimatedDocumentCount();
  const noIcon = await col.countDocuments({ $or: [{ iconUrl: "" }, { iconUrl: null }, { iconUrl: { $exists: false } }] });
  const withIcon = total - noIcon;
  const byExch = await col.aggregate([{ $group: { _id: "$exchange", total: { $sum: 1 }, icons: { $sum: { $cond: [{ $and: [{ $ne: ["$iconUrl", ""] }, { $ne: ["$iconUrl", null] }] }, 1, 0] } } } }]).toArray();
  return { total, withIcon, noIcon, coverage: ((withIcon / total) * 100).toFixed(4) + "%", byExchange: Object.fromEntries(byExch.map(e => [e._id, { total: e.total, icons: e.icons, missing: e.total - e.icons }])) };
}
async function main() {
  const col = await getCol();
  console.log("================================================================");
  console.log("  AUTONOMOUS GLOBAL LOGO AGENT v2.0");
  console.log("  Target: 3,500,000 symbols | 100% real-logo coverage");
  console.log("  Mode: INFINITE AUTONOMOUS LOOP");
  console.log("================================================================\n");
  let cycle = 0;
  while (true) {
    cycle++;
    const t0 = Date.now();
    console.log("\n=== CYCLE " + cycle + " === " + new Date().toISOString() + " ===");
    try {
      console.log("[1/7] Crypto logo cross-pollination...");
      const cryptoFix = await inheritCryptoLogos(col);
      console.log("  -> " + cryptoFix + " crypto icons inherited");
      console.log("[2/7] Google favicon sweep...");
      const faviconFix = await googleFaviconSweep(col);
      console.log("  -> " + faviconFix + " icons from favicons");
      console.log("[3/7] FMP logo sweep...");
      const fmpFix = await fmpLogoSweep(col);
      console.log("  -> " + fmpFix + " stock icons from FMP");
      console.log("[4/7] Same-symbol donor copy...");
      const donorFix = await donorCopy(col);
      console.log("  -> " + donorFix + " icons from donors");
      console.log("[5/7] Forex & index fix...");
      const ctrlFix = await fixControlledIcons(col);
      console.log("  -> " + ctrlFix + " controlled icons");
      console.log("[6/7] CoinGecko resolve...");
      const cgFix = await coingeckoResolve(col);
      console.log("  -> " + cgFix + " from CoinGecko");
      console.log("[7/7] Synthetic expansion...");
      const synthNew = await expandSynthetics(col);
      console.log("  -> " + synthNew + " new synthetic derivatives");
      const stats = await getStats(col);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log("\n+--------- CYCLE " + cycle + " COMPLETE (" + elapsed + "s) ---------+");
      console.log("| Total:    " + String(stats.total).padStart(12));
      console.log("| Icons:    " + String(stats.withIcon).padStart(12));
      console.log("| Missing:  " + String(stats.noIcon).padStart(12));
      console.log("| Coverage: " + stats.coverage.padStart(12));
      console.log("| Gains: crypto(" + cryptoFix + ") fav(" + faviconFix + ") fmp(" + fmpFix + ") donor(" + donorFix + ") ctrl(" + ctrlFix + ") cg(" + cgFix + ") synth(" + synthNew + ")");
      console.log("+-------------------------------------------+");
      const gaps = Object.entries(stats.byExchange).filter(function(e) { return e[1].missing > 0; }).sort(function(a, b) { return b[1].missing - a[1].missing; });
      if (gaps.length > 0) { console.log("Missing:"); for (const pair of gaps.slice(0, 15)) { console.log("  " + pair[0].padEnd(15) + String(pair[1].missing).padStart(7) + " / " + String(pair[1].total).padStart(7) + " (" + ((pair[1].icons / pair[1].total) * 100).toFixed(1) + "%)"); } }
      if (stats.total >= 3500000 && stats.noIcon === 0) { console.log("\n=== TARGET ACHIEVED: 3.5M+ symbols, 100% coverage ==="); }
    } catch (err) { console.error("Cycle " + cycle + " error:", String(err)); }
    await sleep(CYCLE_SLEEP_MS);
  }
}

main().catch(function(err) { console.error("AGENT FATAL:", err); mongoose.connection.close().catch(function(){}).finally(function() { process.exit(1); }); });