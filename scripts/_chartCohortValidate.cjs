/**
 * Loop 3 CHART-002 — validate all 21 cohort symbols receive REAL OHLCV from Yahoo.
 * Mirrors scripts/symbol-chart-validate.cjs but targets the Yahoo path directly so
 * it works without the chart-service HTTP server running.
 */
const https = require("https");

const COHORT = [
  "NSE:RELIANCE","NSE:HDFCBANK","NSE:TCS","NSE:INFY","NSE:LT","NSE:BAJFINANCE",
  "NASDAQ:AAPL","NASDAQ:MSFT","NASDAQ:GOOGL","NYSE:JPM","NASDAQ:TSLA",
  "NSE:NIFTYBEES","NYSE:SPY","NASDAQ:QQQ",
  "NSE:NIFTY50","CBOE:SPX",
  "CRYPTO:BTCUSDT","CRYPTO:ETHUSDT",
  "FOREX:USDINR",
  "NSE:BANKNIFTY","NSE:NIFTY",
];

function mapToYahoo(raw) {
  if (!raw.includes(":")) return raw;
  const [ex, t] = raw.split(":", 2);
  const tu = t.toUpperCase();
  const idx = {"NIFTY":"^NSEI","NIFTY50":"^NSEI","BANKNIFTY":"^NSEBANK","SENSEX":"^BSESN","SPX":"^GSPC","NDX":"^NDX","DJI":"^DJI","VIX":"^VIX"};
  if (idx[tu]) return idx[tu];
  switch (ex.toUpperCase()) {
    case "NSE": return `${t}.NS`;
    case "BSE": return `${t}.BO`;
    case "NASDAQ": case "NYSE": case "NYSEARCA": case "AMEX": case "CBOE": return t;
    case "CRYPTO": { const m = t.match(/^([A-Z0-9]+?)(USDT|USDC|USD)$/i); return m ? `${m[1].toUpperCase()}-USD` : t; }
    case "FOREX": return `${t}=X`;
    default: return t;
  }
}

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, timeout: 10000,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0" }
    }, res => { const b=[]; res.on("data",d=>b.push(d)); res.on("end",()=>resolve({s:res.statusCode, body:Buffer.concat(b).toString()})); })
      .on("error", reject).on("timeout", function(){ this.destroy(); reject(new Error("timeout")); });
  });
}

function isSynthetic(candles) {
  if (candles.length < 3) return false;
  const opens = candles.map(c=>c.open), vols = candles.map(c=>c.volume);
  if (vols.every(v=>v===1834)) return true;
  return Math.abs(opens[0]-100)<20 && opens.every((v,i)=>i===0||Math.abs(v-opens[i-1])<2) && opens.length>10;
}

async function check(full) {
  const y = mapToYahoo(full);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(y)}?interval=1d&range=1mo`;
  try {
    const r = await get(url);
    if (r.s !== 200) return { full, y, status: "FAIL", reason: `HTTP ${r.s}`, n: 0 };
    const j = JSON.parse(r.body);
    const res = j.chart?.result?.[0];
    const ts = res?.timestamp ?? [];
    const q = res?.indicators?.quote?.[0];
    if (!ts.length || !q) return { full, y, status: "FAIL", reason: "empty result", n: 0 };
    const candles = [];
    for (let i=0; i<ts.length; i++) {
      const o=q.open?.[i], h=q.high?.[i], l=q.low?.[i], c=q.close?.[i], v=q.volume?.[i];
      if (o==null||h==null||l==null||c==null) continue;
      candles.push({open:+o,high:+h,low:+l,close:+c,volume:+(v??0)});
    }
    if (!candles.length) return { full, y, status: "FAIL", reason: "no valid candles", n: 0 };
    if (isSynthetic(candles)) return { full, y, status: "FAIL", reason: "SYNTHETIC DETECTED", n: candles.length };
    return { full, y, status: "PASS", reason: `real OHLCV n=${candles.length} last=${candles[candles.length-1].close.toFixed(2)}`, n: candles.length };
  } catch (e) {
    return { full, y, status: "FAIL", reason: e.message, n: 0 };
  }
}

(async () => {
  const results = [];
  for (const s of COHORT) {
    const r = await check(s);
    console.log(`${r.status.padEnd(4)} ${r.full.padEnd(18)} -> ${r.y.padEnd(14)} | ${r.reason}`);
    results.push(r);
    await new Promise(r=>setTimeout(r, 150));
  }
  const pass = results.filter(r=>r.status==="PASS").length;
  console.log(`\n=== ${pass}/${results.length} cohort symbols return REAL Yahoo OHLCV ===`);
  require("fs").writeFileSync("/tmp/chart_cohort_loop3.json", JSON.stringify(results, null, 2));
})();
