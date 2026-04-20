/**
 * Enrich CleanAsset documents with company profile data from FMP.
 *
 * Fetches CEO, headquarters, IPO date, ISIN, industry, description, and
 * company domain for every stock/ETF in the clean_assets collection that is
 * missing this data.  Runs in a rate-limited loop (≤250 req/min FMP free tier).
 *
 * Usage:
 *   npx tsx scripts/enrichCompanyProfiles.ts [--limit 500] [--dry-run] [--force]
 *
 * Flags:
 *   --limit N   Max symbols to process this run (default 500).
 *   --dry-run   Fetch profile data but do NOT write to DB; just log results.
 *   --force     Re-enrich even if fields already populated.
 *   --symbol S  Enrich a single named symbol (e.g. MRF.NS → strip exchange).
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { CleanAssetModel } from "../src/models/CleanAsset.js";
import { fetchFmpCompanyProfile, mapFmpProfileToAssetFields } from "../src/services/symbolExpansion.fmp.js";
import { isFmpAvailable } from "../src/services/symbolExpansion.helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../../.env");
const secretsPath = path.resolve(__dirname, "../../../.env.secrets");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
if (fs.existsSync(secretsPath)) dotenv.config({ path: secretsPath, override: true });

const MONGO_URI = process.env.MONGO_URI_LOCAL || "mongodb://127.0.0.1:27017/tradereplay";
const LIMIT      = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "500", 10);
const DRY_RUN    = process.argv.includes("--dry-run");
const FORCE      = process.argv.includes("--force");
const SINGLE_SYM = process.argv.find((a) => a.startsWith("--symbol="))?.split("=")[1];

// FMP free tier: 250 calls/min → ~250ms gap is safe
const RATE_DELAY_MS = 260;
const CHUNK = 50; // write batch size

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("[enrich-profiles] Connected to MongoDB");

  if (!isFmpAvailable()) {
    console.error("[enrich-profiles] FMP_API_KEY not configured — set it in .env.secrets");
    process.exit(1);
  }

  // ── Build query ─────────────────────────────────────────────────────
  const query: Record<string, unknown> = {
    type: { $in: ["stock", "etf"] },
    isActive: true,
  };

  if (SINGLE_SYM) {
    query.symbol = SINGLE_SYM.toUpperCase();
  } else if (!FORCE) {
    // Only enrich symbols with at least one empty profile field
    query.$or = [
      { ceo: { $in: [null, ""] } },
      { industry: { $in: [null, ""] } },
      { isin: { $in: [null, ""] } },
    ];
  }

  const docs = await CleanAssetModel.find(query)
    .select("symbol exchange fullSymbol ceo industry isin headquarters ipoDate description companyDomain sector")
    .sort({ priorityScore: -1 })
    .limit(LIMIT)
    .lean();

  console.log(`[enrich-profiles] Found ${docs.length} symbols to enrich`);

  let updated = 0;
  let skipped = 0;
  let errors  = 0;

  const pendingWrites: Array<{ filter: object; update: object }> = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    // FMP expects plain symbol (no EXCHANGE: prefix)
    const fmpSymbol = doc.symbol;

    const profile = await fetchFmpCompanyProfile(fmpSymbol);
    await sleep(RATE_DELAY_MS);

    if (!profile) {
      console.log(`  [${i + 1}/${docs.length}] ${doc.fullSymbol} — no FMP profile, skipping`);
      skipped++;
      continue;
    }

    const fields = mapFmpProfileToAssetFields(profile);

    // Filter out empty values to avoid overwriting existing data with blanks
    const nonEmpty = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== "" && v !== null && v !== undefined),
    );

    if (Object.keys(nonEmpty).length === 0) {
      console.log(`  [${i + 1}/${docs.length}] ${doc.fullSymbol} — FMP profile empty, skipping`);
      skipped++;
      continue;
    }

    console.log(`  [${i + 1}/${docs.length}] ${doc.fullSymbol} — ceo="${profile.ceo || ""}" industry="${profile.industry || ""}"`);

    if (!DRY_RUN) {
      pendingWrites.push({
        filter: { _id: doc._id },
        update: { $set: nonEmpty },
      });
    }

    updated++;

    // Flush writes in chunks to avoid large single bulkWrite
    if (!DRY_RUN && pendingWrites.length >= CHUNK) {
      await CleanAssetModel.bulkWrite(
        pendingWrites.map((op) => ({ updateOne: op })),
        { ordered: false },
      );
      console.log(`  [flush] Wrote ${pendingWrites.length} documents`);
      pendingWrites.length = 0;
    }
  }

  // Flush remaining
  if (!DRY_RUN && pendingWrites.length > 0) {
    await CleanAssetModel.bulkWrite(
      pendingWrites.map((op) => ({ updateOne: op })),
      { ordered: false },
    );
    console.log(`  [flush] Wrote ${pendingWrites.length} documents`);
  }

  console.log(`\n[enrich-profiles] Done. updated=${updated} skipped=${skipped} errors=${errors}`);
  if (DRY_RUN) console.log("[enrich-profiles] DRY RUN — no DB changes written.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[enrich-profiles] Fatal:", err);
  process.exit(1);
});
