/**
 * Loop 4 IN-02 — BSE all-listed ingestion (main board + SME merged; SME flagged).
 *
 * Source:  https://api.bseindia.com/BseIndiaAPI/api/ListOfScripCd/w?Group=&Scripcode=&industry=&segment=Equity&status=Active
 *          (public JSON endpoint, used by bseindia.com front-end)
 * Fallback: scripmaster text if available.
 *
 * Dedup strategy: BSE fullSymbol = "BSE:<securityCode>" (numeric), NEVER collides with NSE
 * tickers. When ISIN matches an existing NSE record, we STILL create a separate BSE record
 * (both listings are real) but populate `nseSymbol` cross-ref from the NSE record.
 *
 * Run: node scripts/ingest-bse-all.cjs [--limit=N] [--dry-run]
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
const BATCH_ID = `bse_all_ingest_${Date.now()}`;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";

const BSE_URL_PRIMARY = "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active";
const BSE_URL_FALLBACK = "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=";

function download(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname, path: u.pathname + u.search, timeout: 60000,
      insecureHTTPParser: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.bseindia.com/",
        "Origin": "https://www.bseindia.com",
      }
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

const ISIN_IN_RE = /^IN[A-Z0-9]{9,10}$/;
const BSE_CODE_RE = /^\d{5,7}$/;

function normalize(records) {
  // BSE field names seen in the public API: SCRIP_CD, Scrip_Name, ISSUER_NAME, Status,
  // GROUP, ISIN_NUMBER, INDUSTRY, Segment, Market_Lot, NSURL, etc.
  const out = [];
  for (const r of records) {
    const code = String(r.SCRIP_CD ?? r.Scrip_Cd ?? r.scrip_cd ?? "").trim();
    if (!BSE_CODE_RE.test(code)) continue;
    // BSE fields (from probe): SCRIP_CD, Scrip_Name (issuer name), scrip_id (alpha ticker),
    // Status, GROUP, FACE_VALUE, ISIN_NUMBER, INDUSTRY, Segment, NSURL.
    out.push({
      code,
      ticker: String(r.scrip_id ?? r.Scrip_Name ?? "").trim(),
      name: String(r.Scrip_Name ?? r.ISSUER_NAME ?? "").trim(),
      isin: String(r.ISIN_NUMBER ?? r.Isin_Number ?? "").trim().toUpperCase() || null,
      industry: String(r.INDUSTRY ?? r.Industry ?? "").trim() || null,
      group: String(r.GROUP ?? r.Group ?? "").trim() || null,
      status: String(r.Status ?? r.STATUS ?? "Active").trim(),
      segment: String(r.Segment ?? "Equity").trim(),
      faceValue: Number(r.FACE_VALUE) || null,
    });
  }
  return out;
}

function validate(r) {
  if (!r.code) return "NO_CODE";
  if (!r.name) return "NO_NAME";
  if (r.isin && !ISIN_IN_RE.test(r.isin)) return "BAD_ISIN";
  return null;
}

async function run() {
  let resp, usedUrl = BSE_URL_PRIMARY;
  try {
    console.log(`[bse] fetching ${BSE_URL_PRIMARY}`);
    resp = await download(BSE_URL_PRIMARY);
  } catch (e) {
    console.log(`[bse] primary failed (${e.message}); trying fallback`);
    usedUrl = BSE_URL_FALLBACK;
    resp = await download(BSE_URL_FALLBACK);
  }
  if (resp.status !== 200) throw new Error(`bse http ${resp.status} via ${usedUrl}`);
  const ctSnippet = resp.body.slice(0, 200);
  let json;
  try { json = JSON.parse(resp.body); }
  catch (e) { throw new Error(`bse not JSON via ${usedUrl} (first 200 chars): ${ctSnippet}`); }
  const records = Array.isArray(json) ? json : (json.Table || json.result || []);
  console.log(`[bse] received ${records.length} records`);

  const normalized = normalize(records);
  const failed = [];
  const valid = [];
  for (const r of normalized) {
    const err = validate(r);
    if (err) { failed.push({ code: r.code, name: r.name, reason: err }); continue; }
    valid.push(r);
  }
  console.log(`[bse] normalized=${normalized.length} valid=${valid.length} failed=${failed.length}`);

  if (DRY) {
    console.log("[bse] sample:", JSON.stringify(valid.slice(0,3), null, 2));
    return { received: records.length, valid: valid.length, failed: failed.length, upserted: 0, dryRun: true };
  }

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try {
    const db = client.db();
    await initAuditLog(db);
    const col = db.collection("cleanassets");

    let inserted = 0, updated = 0, errors = 0, crossRefAdded = 0;
    const limit = Math.min(valid.length, LIMIT);
    for (let i = 0; i < limit; i++) {
      const r = valid[i];
      const fullSymbol = `BSE:${r.code}`;
      const filter = { fullSymbol };
      const segment = (r.group === "M" || r.group === "MS" || r.group === "MT" || /SME/i.test(r.segment || "")) ? "SME" : "MAIN";

      let nseSymbol = null;
      if (r.isin) {
        const nseDoc = await col.findOne({ isin: r.isin, exchange: "NSE", country: "IN" }, { projection: { fullSymbol: 1 } });
        if (nseDoc) { nseSymbol = nseDoc.fullSymbol; crossRefAdded++; }
      }

      try {
        const existing = await col.findOne(filter);
        if (!existing) {
          await col.insertOne({
            fullSymbol, symbol: r.code, ticker: r.ticker || r.code,
            bseCode: r.code,
            name: r.name, companyName: r.name,
            exchange: "BSE", country: "IN", type: "stock",
            assetClass: "equity", currency: "INR",
            isin: r.isin, industry: r.industry,
            group: r.group, segment,
            status: r.status, isActive: r.status === "Active",
            nseSymbol,
            source: "bse_official", sourceName: "bse_official", sourceConfidence: 1.0,
            ingestedAt: new Date(),
          });
          inserted++;
        } else {
          const fields = {
            name: r.name, companyName: r.name, isin: r.isin,
            industry: r.industry, group: r.group, segment, bseCode: r.code,
            nseSymbol: nseSymbol,
          };
          for (const [fn, val] of Object.entries(fields)) {
            if (val == null || val === "") continue;
            await mergeFieldWithAudit({
              db, collection: "cleanassets", symbolId: existing._id,
              filter, fieldName: fn, incomingValue: val,
              incomingSource: "bse_official", batchId: BATCH_ID, dryRun: false,
            });
          }
          updated++;
        }
      } catch (e) {
        errors++;
        if (errors < 5) console.error(`[bse] err ${fullSymbol}:`, e.message);
      }
    }

    const report = {
      received: records.length, valid: valid.length, failed: failed.length,
      inserted, updated, errors, crossRefAdded, upserted: inserted + updated,
      batchId: BATCH_ID, failedSample: failed.slice(0, 20),
    };
    console.log("[bse] done:", JSON.stringify(report, null, 2));
    return report;
  } finally {
    await client.close();
  }
}

run().then(r => {
  try { fs.writeFileSync("/tmp/bse_all_ingest_report.json", JSON.stringify(r, null, 2)); } catch {}
}).catch(e => {
  console.error("[bse] fatal:", e);
  process.exit(1);
});
