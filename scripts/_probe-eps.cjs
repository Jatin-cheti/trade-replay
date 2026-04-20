/**
 * Probe FMP endpoints for EPS, revenueGrowth, avgVolume fields
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

function loadEnv() {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    if (!k || process.env[k]) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}
loadEnv();

const KEY = process.env.FMP_API_KEY || process.env.FMP_KEY_1;

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 15000 }, (res) => {
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(String(data).slice(0, 300))); }
      });
    }).on("error", reject).on("timeout", () => reject(new Error("Timeout")));
  });
}

async function probe(label, url, filterFn) {
  console.log(`\n=== ${label} ===`);
  try {
    const data = await fetchJSON(url);
    const obj = Array.isArray(data) ? data[0] : data;
    if (!obj) { console.log("No data"); return; }
    for (const k of Object.keys(obj).sort()) {
      if (!filterFn || filterFn(k, obj[k])) console.log(`  ${k}: ${obj[k]}`);
    }
  } catch (e) {
    console.log("Error:", e.message.slice(0, 200));
  }
}

const SYM = "NVDA";

async function main() {
  const epsFilter = (k) => /eps|revenue|growth|avg|volume|income|share/i.test(k);
  
  await probe("income-statement (TTM)", 
    `https://financialmodelingprep.com/stable/income-statement?symbol=${SYM}&period=ttm&limit=1&apikey=${KEY}`,
    epsFilter);

  await probe("key-metrics-ttm",
    `https://financialmodelingprep.com/stable/key-metrics-ttm?symbol=${SYM}&apikey=${KEY}`,
    epsFilter);

  await probe("analyst-estimates",
    `https://financialmodelingprep.com/stable/analyst-estimates?symbol=${SYM}&limit=1&apikey=${KEY}`,
    epsFilter);

  await probe("financial-growth",
    `https://financialmodelingprep.com/stable/financial-growth?symbol=${SYM}&limit=1&apikey=${KEY}`,
    epsFilter);
}

main().catch(console.error);
