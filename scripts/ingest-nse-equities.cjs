/**
 * Loop 4 IN-01 — NSE equities full segment ingestion.
 *
 * Source:  https://archives.nseindia.com/content/equities/EQUITY_L.csv
 *          CSV columns: SYMBOL,NAME OF COMPANY,SERIES,DATE OF LISTING,
 *                       PAID UP VALUE,MARKET LOT,ISIN NUMBER,FACE VALUE
 * Target:  cleanassets (mongo)
 * Merge:   existing rows updated via mergeFieldWithAudit.
 *
 * fullSymbol = "NSE:<ticker>"
 *
 * Run:  node scripts/ingest-nse-equities.cjs [--limit=N] [--dry-run]
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
const BATCH_ID = `nse_eq_ingest_${Date.now()}`;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";

const NSE_EQUITY_URL = "https://archives.nseindia.com/content/equities/EQUITY_L.csv";
const ISIN_IN_RE = /^IN[A-Z0-9]{9,10}$/;
const TICKER_RE = /^[A-Z0-9&\-]{1,20}$/;
const ALLOWED_SERIES = new Set(["EQ","BE","BL","BT","BZ","GC","IL","IQ","IV","RJ","SM","ST","SZ","TB","W1","W2","W3"]);

function download(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({
      hostname: u.hostname, path: u.pathname + u.search, timeout: 60000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/csv,text/plain,*/*",
        "Referer": "https://www.nseindia.com/"
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

function parseCsv(body) {
  // Trivial CSV: NSE does not quote values for this file.
  const lines = body.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map(s => s.trim());
  const idx = Object.fromEntries(header.map((h,i) => [h, i]));
  const get = (row, name) => {
    const i = idx[name]; return i == null ? "" : (row[i] ?? "").trim();
  };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    if (!row.length) continue;
    const symbol = get(row, "SYMBOL");
    if (!symbol) continue;
    out.push({
      ticker: symbol,
      name: get(row, "NAME OF COMPANY"),
      series: get(row, " SERIES") || get(row, "SERIES"),
      listingDate: get(row, " DATE OF LISTING") || get(row, "DATE OF LISTING"),
      isin: (get(row, " ISIN NUMBER") || get(row, "ISIN NUMBER") || "").toUpperCase(),
      faceValue: Number(get(row, " FACE VALUE") || get(row, "FACE VALUE")) || null,
    });
  }
  return out;
}

function validate(rec) {
  if (!TICKER_RE.test(rec.ticker)) return "BAD_TICKER";
  if (!rec.name) return "NO_NAME";
  if (rec.isin && !ISIN_IN_RE.test(rec.isin)) return "BAD_ISIN";
  const series = (rec.series || "").toUpperCase();
  if (series && !ALLOWED_SERIES.has(series)) return "UNKNOWN_SERIES";
  return null;
}

async function run() {
  console.log(`[nse-eq] fetching ${NSE_EQUITY_URL}`);
  const resp = await download(NSE_EQUITY_URL);
  if (resp.status !== 200) throw new Error(`nse http ${resp.status} body-len=${resp.body.length}`);
  const rows = parseCsv(resp.body);
  console.log(`[nse-eq] parsed ${rows.length} rows`);

  const failed = [];
  const valid = [];
  for (const r of rows) {
    const err = validate(r);
    if (err) { failed.push({ ticker: r.ticker, name: r.name, reason: err }); continue; }
    valid.push(r);
  }
  console.log(`[nse-eq] valid=${valid.length} failed=${failed.length}`);

  if (DRY) {
    console.log("[nse-eq] sample:", JSON.stringify(valid.slice(0,3), null, 2));
    return { parsed: rows.length, valid: valid.length, failed: failed.length, upserted: 0, inserted: 0, updated: 0, dryRun: true };
  }

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try {
    const db = client.db();
    await initAuditLog(db);
    const col = db.collection("cleanassets");

    let inserted = 0, updated = 0, errors = 0;
    const limit = Math.min(valid.length, LIMIT);
    for (let i = 0; i < limit; i++) {
      const r = valid[i];
      const fullSymbol = `NSE:${r.ticker}`;
      const filter = { fullSymbol };
      const series = (r.series || "").toUpperCase();
      const segment = (series === "SM" || series === "ST" || series === "SZ") ? "SME" : "MAIN";
      try {
        const existing = await col.findOne(filter);
        if (!existing) {
          await col.insertOne({
            fullSymbol, symbol: r.ticker, ticker: r.ticker,
            name: r.name, companyName: r.name,
            exchange: "NSE", country: "IN", type: "stock",
            assetClass: "equity", currency: "INR",
            isin: r.isin || null, series: series || null,
            segment, faceValue: r.faceValue,
            listingDate: r.listingDate || null,
            tradeType: series === "BE" ? "T2T" : null,
            isActive: true,
            source: "nse_official", sourceName: "nse_official", sourceConfidence: 1.0,
            ingestedAt: new Date(),
          });
          inserted++;
        } else {
          const fields = {
            name: r.name, companyName: r.name,
            isin: r.isin || null, series: series || null,
            segment, faceValue: r.faceValue, listingDate: r.listingDate || null,
          };
          for (const [fn, val] of Object.entries(fields)) {
            if (val == null || val === "") continue;
            await mergeFieldWithAudit({
              db, collection: "cleanassets", symbolId: existing._id,
              filter, fieldName: fn, incomingValue: val,
              incomingSource: "nse_official", batchId: BATCH_ID, dryRun: false,
            });
          }
          updated++;
        }
      } catch (e) {
        errors++;
        if (errors < 5) console.error(`[nse-eq] err ${fullSymbol}:`, e.message);
      }
    }

    const report = {
      parsed: rows.length, valid: valid.length, failed: failed.length,
      inserted, updated, errors, upserted: inserted + updated,
      batchId: BATCH_ID, failedSample: failed.slice(0, 20),
    };
    console.log("[nse-eq] done:", JSON.stringify(report, null, 2));
    return report;
  } finally {
    await client.close();
  }
}

run().then(r => {
  try { fs.writeFileSync("/tmp/nse_eq_ingest_report.json", JSON.stringify(r, null, 2)); } catch {}
}).catch(e => {
  console.error("[nse-eq] fatal:", e);
  process.exit(1);
});
