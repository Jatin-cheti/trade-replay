/**
 * Loop 3 IND-003 — AMFI Mutual Fund ingestion.
 *
 * Source:  https://www.amfiindia.com/spages/NAVAll.txt (pipe-delimited, public, no auth).
 * Target:  MongoDB `cleanassets` (primary symbol collection used by screener).
 * Merge:   Uses mergeFieldWithAudit from scripts/lib/merge-field-audit.cjs so every
 *          write is tracked in enrichment_audit_log.
 *
 * Record format emitted per scheme:
 *   {
 *     fullSymbol: "AMFI:<scheme_code>",
 *     symbol: <scheme_code>, ticker: <scheme_code>,
 *     name: <scheme_name>, amc: <amc_name>,
 *     exchange: "AMFI", country: "IN", type: "mutualfund",
 *     currency: "INR", price: <nav>, isin: <isin_growth>,
 *     isActive: true, source: "amfi_india", ingestedAt: <iso>
 *   }
 *
 * Run:  node scripts/ingest-amfi-mf.cjs [--limit=<N>] [--dry-run]
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const { MongoClient } = require("mongodb");
const { initAuditLog, mergeFieldWithAudit } = require(path.join(__dirname, "lib", "merge-field-audit.cjs"));

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

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.slice(2).split("="); return [k, v ?? "true"];
  })
);
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const DRY = args["dry-run"] === "true" || args.dryRun === "true";
const BATCH_ID = `amfi_ingest_${Date.now()}`;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";

function download(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname, path: u.pathname + u.search, timeout: 60000,
      headers: { "User-Agent": "Mozilla/5.0 TradeReplay/1.0 (+amfi-ingest)" }
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        resolve(download(next, redirects - 1));
        return;
      }
      const chunks = [];
      res.on("data", d => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

/**
 * AMFI NAVAll.txt is grouped sections. Structure:
 *   Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
 *   <blank line>
 *   Open Ended Schemes(...)
 *   <AMC Name>
 *   <data rows>
 */
function parseAmfi(body) {
  const lines = body.split(/\r?\n/);
  const out = [];
  let currentAmc = null;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    // Data row has 6 semi-colon fields and first is numeric scheme code.
    const parts = t.split(";");
    if (parts.length >= 6 && /^\d+$/.test(parts[0])) {
      const [code, isinGrowth, isinReinvest, name, nav, date] = parts;
      const navNum = Number(nav);
      out.push({
        code: code.trim(),
        isin: (isinGrowth || isinReinvest || "").trim() || null,
        name: name.trim(),
        nav: Number.isFinite(navNum) ? navNum : null,
        navDate: date.trim(),
        amc: currentAmc,
      });
      continue;
    }
    // Category heading like "Open Ended Schemes ( Equity Scheme - Large Cap Fund )"
    if (/^Open Ended|^Close Ended|^Interval/.test(t)) continue;
    // AMC name lines are plain text, no semicolons.
    if (!t.includes(";") && t.length > 3 && t.length < 200) {
      currentAmc = t;
    }
  }
  return out;
}

async function run() {
  console.log(`[amfi] fetching NAVAll.txt ...`);
  const resp = await download("https://www.amfiindia.com/spages/NAVAll.txt");
  if (resp.status !== 200) throw new Error(`amfi http ${resp.status}`);
  const schemes = parseAmfi(resp.body);
  console.log(`[amfi] parsed ${schemes.length} scheme rows`);

  if (DRY) {
    console.log("[amfi] DRY-RUN — sample of first 3:");
    console.log(JSON.stringify(schemes.slice(0, 3), null, 2));
    console.log(`[amfi] would upsert up to ${Math.min(schemes.length, LIMIT)} docs`);
    return { parsed: schemes.length, upserted: 0, dryRun: true };
  }

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try {
    const db = client.db();
    await initAuditLog(db);
    const col = db.collection("cleanassets");

    let upserted = 0, skipped = 0, errors = 0;
    const limit = Math.min(schemes.length, LIMIT);
    for (let i = 0; i < limit; i++) {
      const s = schemes[i];
      if (!s.code || !s.name) { skipped++; continue; }
      const fullSymbol = `AMFI:${s.code}`;
      const filter = { fullSymbol };

      try {
        const existing = await col.findOne(filter);
        if (!existing) {
          await col.insertOne({
            fullSymbol,
            symbol: s.code,
            ticker: s.code,
            name: s.name,
            amc: s.amc,
            exchange: "AMFI",
            country: "IN",
            type: "mutualfund",
            currency: "INR",
            price: s.nav,
            isin: s.isin,
            isActive: true,
            source: "amfi_india",
            ingestedAt: new Date(),
            navDate: s.navDate,
          });
          upserted++;
        } else {
          // Use mergeFieldWithAudit for mutable fields (price, name, amc).
          const fields = { price: s.nav, name: s.name, amc: s.amc, isin: s.isin, navDate: s.navDate };
          for (const [fieldName, incomingValue] of Object.entries(fields)) {
            if (incomingValue == null) continue;
            await mergeFieldWithAudit({
              db, collection: "cleanassets", symbolId: existing._id,
              filter, fieldName, incomingValue,
              incomingSource: "amfi_india", batchId: BATCH_ID, dryRun: false,
            });
          }
          upserted++;
        }
      } catch (e) {
        errors++;
        if (errors < 5) console.error(`[amfi] err ${fullSymbol}:`, e.message);
      }
    }

    const report = { parsed: schemes.length, upserted, skipped, errors, batchId: BATCH_ID };
    console.log("[amfi] done:", report);
    return report;
  } finally {
    await client.close();
  }
}

run().then(r => {
  fs.writeFileSync("/tmp/amfi_ingest_report.json", JSON.stringify(r, null, 2));
}).catch(e => {
  console.error("[amfi] fatal:", e);
  process.exit(1);
});
