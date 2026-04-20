/**
 * Quick FMP field probe
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

async function main() {
  const ratios = await fetchJSON(`https://financialmodelingprep.com/stable/ratios?symbol=NVDA&apikey=${KEY}`);
  if (Array.isArray(ratios) && ratios[0]) {
    const obj = ratios[0];
    console.log("=== RATIOS KEYS ===");
    for (const k of Object.keys(obj).sort()) {
      if (obj[k] !== null && obj[k] !== undefined && obj[k] !== 0) {
        console.log(`  ${k}: ${obj[k]}`);
      }
    }
    console.log("\nAll keys:", Object.keys(obj).join(", "));
  } else {
    console.log("Ratios response:", JSON.stringify(ratios).slice(0, 400));
  }

  // Also probe key-metrics
  const km = await fetchJSON(`https://financialmodelingprep.com/stable/key-metrics?symbol=NVDA&apikey=${KEY}`);
  if (Array.isArray(km) && km[0]) {
    const obj = km[0];
    console.log("\n=== KEY-METRICS relevant fields ===");
    const relevant = ["returnOnEquity", "revenueGrowth", "returnOnEquityTTM", "roe", "roeTTM", "revenueGrowthYoy", "revenueGrowthAnnual"];
    for (const k of Object.keys(obj).sort()) {
      if (/roe|return|revenue|growth|earnings|eps/i.test(k)) {
        console.log(`  ${k}: ${obj[k]}`);
      }
    }
    console.log("\nAll key-metrics keys:", Object.keys(obj).join(", "));
  } else {
    console.log("Key-metrics response:", JSON.stringify(km).slice(0, 400));
  }

  if (Array.isArray(grades) && grades[0]) {
    console.log("\n=== GRADES-CONSENSUS ===");
    console.log(JSON.stringify(grades[0]));
  } else {
    console.log("Grades response:", JSON.stringify(grades).slice(0, 400));
  }
}

main().catch(console.error);
