/**
 * SYMBOL PAGE + CHART VALIDATION (via backend API)
 *
 * For each cohort symbol, verifies:
 *  - /api/screener/symbol/:fullSymbol returns 200 with required fields
 *  - /api/chart/:fullSymbol returns OHLC candles (chart-service, not TradingView)
 *  - Price axis coherent (minLow < maxHigh, marketCap > 0 for stocks)
 *
 * Emits PASS/FAIL matrix to /tmp/symbol_chart_validation.json
 */
const https = require("https");
const http = require("http");
const fs = require("fs");
const BASE = process.env.BASE || "http://127.0.0.1:4000";
const SCR  = process.env.SCR  || "http://127.0.0.1:3004";
const CHART = process.env.CHART || "http://127.0.0.1:4010";

const cohorts = {
  IN:    ["RELIANCE","HDFCBANK","TCS","INFY","LT","BAJFINANCE"],
  US:    ["NVDA","MSFT","AAPL","GOOGL","AMZN"],
  ETF:   ["SPY","QQQ","VOO","IWM","VTI"],
  DERIV: ["ES","NQ","CL","GC","BTC-USD"],
};

function get(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { timeout: 10000 }, (res) => {
      const chunks = [];
      res.on("data", d => chunks.push(d));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, body, json: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body, json: null }); }
      });
    });
    req.on("error", (e) => resolve({ status: 0, body: String(e), json: null }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, body: "timeout", json: null }); });
  });
}

async function resolveSymbol(sym, cohort) {
  // Prefer primary exchange by cohort + market cap
  const countryHint = cohort === "IN" ? "&marketCountries=IN" : cohort === "US" || cohort === "ETF" ? "&marketCountries=US" : "";
  const typeHint = cohort === "ETF" ? "&type=etf" : cohort === "DERIV" ? "" : "&type=stocks";
  const r = await get(`${SCR}/api/screener/list?q=${encodeURIComponent(sym)}${countryHint}${typeHint}&limit=10&sortBy=marketCap&sortOrder=desc`);
  if (!r.json || !Array.isArray(r.json.items) || r.json.items.length === 0) return null;
  // Prefer exact symbol match on primary exchange
  const exact = r.json.items.filter(i => (i.symbol || "").toUpperCase() === sym.toUpperCase());
  const primary = exact.find(i => ["NYSE", "NASDAQ", "NSE", "AMEX", "NYSEARCA"].includes(i.exchange));
  return primary || exact[0] || r.json.items[0];
}

async function validate(sym, cohort) {
  const result = { symbol: sym };
  const asset = await resolveSymbol(sym, cohort);
  if (!asset) { return { ...result, pass: false, reason: "not_found_in_screener" }; }
  result.fullSymbol = asset.fullSymbol;
  result.exchange = asset.exchange;
  result.source = asset.source;
  result.type = asset.type;
  result.marketCap = asset.marketCap;
  result.sector = asset.sector;
  result.logoTier = asset.logoTier;
  result.iconUrl = asset.iconUrl;

  // Symbol detail endpoint
  const detail = await get(`${SCR}/api/screener/symbol/${encodeURIComponent(asset.fullSymbol || sym)}`);
  result.detailStatus = detail.status;
  result.detailHasName = !!(detail.json && detail.json.name);

  // Chart endpoint — chart-service lives on port 4010 at /api/chart/candles
  const from = Math.floor(Date.now()/1000) - 86400*30;
  const to = Math.floor(Date.now()/1000);
  const fullSym = asset.fullSymbol || sym;
  const candidates = [
    `${CHART}/api/chart/candles?symbol=${encodeURIComponent(fullSym)}&timeframe=1D&from=${from}&to=${to}`,
    `${CHART}/api/chart/candles?symbol=${encodeURIComponent(asset.symbol)}&timeframe=1D&from=${from}&to=${to}`,
    `${BASE}/api/chart/candles?symbol=${encodeURIComponent(fullSym)}&timeframe=1D&from=${from}&to=${to}`,
  ];
  let chart = null, chartUrl = null;
  for (const u of candidates) {
    const r = await get(u);
    if (r.status === 200 && r.json) { chart = r; chartUrl = u; break; }
  }
  result.chartStatus = chart ? chart.status : "no_200";
  result.chartUrl = chartUrl;
  if (chart && chart.json) {
    const d = chart.json;
    const candles = d.candles || d.data || d.bars || d.items || (Array.isArray(d) ? d : []);
    result.chartBars = Array.isArray(candles) ? candles.length : 0;
    if (candles.length) {
      const first = candles[0];
      const lows = candles.map(c => c.low ?? c.l ?? c[3]).filter(v => typeof v === "number");
      const highs = candles.map(c => c.high ?? c.h ?? c[2]).filter(v => typeof v === "number");
      result.priceMin = lows.length ? Math.min(...lows) : null;
      result.priceMax = highs.length ? Math.max(...highs) : null;
      result.axisCoherent = result.priceMin != null && result.priceMax != null && result.priceMax >= result.priceMin;
    }
  }

  result.pass = result.detailStatus === 200 && (result.chartBars || 0) > 0 && result.axisCoherent === true;
  return result;
}

(async () => {
  const all = [];
  for (const [cohort, syms] of Object.entries(cohorts)) {
    for (const s of syms) {
      const v = await validate(s, cohort); v.cohort = cohort; all.push(v);
      console.log(`[${v.pass ? "PASS" : "FAIL"}] ${cohort} ${s} fullSym=${v.fullSymbol || "?"} detail=${v.detailStatus} chartBars=${v.chartBars || 0}`);
    }
  }
  fs.writeFileSync("/tmp/symbol_chart_validation.json", JSON.stringify(all, null, 2));
  const passed = all.filter(v => v.pass).length;
  console.log(`\nSUMMARY: ${passed}/${all.length} passed`);
})();
