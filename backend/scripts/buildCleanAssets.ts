/**
 * Data Reduction Pipeline — Build clean_assets Gold Layer
 *
 * Scores all 1.5M symbols → keeps top 100K → writes to clean_assets collection
 * This is the GOLD LAYER — all queries should use this instead of raw symbols.
 *
 * Usage: npx tsx scripts/buildCleanAssets.ts [--limit 100000] [--dry-run]
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../../.env");
const secretsPath = path.resolve(__dirname, "../../../.env.secrets");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: false });
if (fs.existsSync(secretsPath)) dotenv.config({ path: secretsPath, override: true });

const MONGO_URI = process.env.MONGO_URI_LOCAL || "mongodb://127.0.0.1:27017/tradereplay";
const TARGET_LIMIT = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "100000", 10);
const DRY_RUN = process.argv.includes("--dry-run");

interface SymbolDoc {
  _id: mongoose.Types.ObjectId;
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency: string;
  iconUrl: string;
  companyDomain: string;
  s3Icon: string;
  logoSource: string;
  logoVerificationStatus: string;
  logoQualityScore: number;
  popularity: number;
  userUsage: number;
  priorityScore: number;
  marketCap: number;
  volume: number;
  liquidityScore: number;
  isSynthetic: boolean;
  baseSymbol: string;
  searchPrefixes: string[];
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Compute a composite score for ranking.
 */
function computeScore(doc: SymbolDoc): number {
  let score = 0;

  // Base priority score
  score += (doc.priorityScore || 0) * 10;

  // Market cap weight (log scale)
  if (doc.marketCap > 0) {
    score += Math.log10(doc.marketCap) * 5;
  }

  // Volume weight (log scale)
  if (doc.volume > 0) {
    score += Math.log10(doc.volume) * 3;
  }

  // User engagement boost
  score += (doc.userUsage || 0) * 20;
  score += (doc.popularity || 0) * 5;

  // Liquidity score
  score += (doc.liquidityScore || 0) * 2;

  // Type bonuses — core asset types score higher
  const typeBonus: Record<string, number> = {
    stock: 15,
    etf: 12,
    crypto: 10,
    index: 8,
    forex: 6,
    future: 4,
    bond: 2,
    economy: 1,
    option: 0,
    derivative: -10,
  };
  score += typeBonus[doc.type] ?? 0;

  // Icon presence bonus
  if (doc.iconUrl && doc.iconUrl.length > 0) score += 5;

  // Validated logo bonus
  if (doc.logoVerificationStatus === "validated") score += 10;

  // Penalty for synthetic/derivative
  if (doc.isSynthetic) score -= 20;

  // Major exchange bonus
  const majorExchanges = new Set(["NASDAQ", "NYSE", "AMEX", "NSE", "BSE", "LSE", "TSX", "ASX"]);
  if (majorExchanges.has(doc.exchange)) score += 8;

  return score;
}

async function main() {
  console.log(`\n=== DATA REDUCTION PIPELINE ===`);
  console.log(`Target: ${TARGET_LIMIT} clean assets`);
  console.log(`Dry run: ${DRY_RUN}\n`);

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  const symbolsCol = db.collection("symbols");

  // Step 1: Count raw symbols
  const totalRaw = await symbolsCol.countDocuments();
  console.log(`Raw symbols: ${totalRaw.toLocaleString()}`);

  // Step 2: Filter criteria — exclude junk
  const filterCriteria = {
    isSynthetic: { $ne: true },
    name: { $exists: true, $ne: "" },
    symbol: { $exists: true, $ne: "" },
    // Keep only primary asset types
    type: { $in: ["stock", "etf", "crypto", "forex", "index", "future", "bond", "economy"] },
  };

  const filteredCount = await symbolsCol.countDocuments(filterCriteria);
  console.log(`After filter (non-synthetic, valid types): ${filteredCount.toLocaleString()}`);

  // Step 3: Score and rank all filtered symbols
  console.log(`\nScoring ${filteredCount.toLocaleString()} symbols...`);

  const scored: Array<{ _id: mongoose.Types.ObjectId; score: number; doc: any }> = [];
  const cursor = symbolsCol.find(filterCriteria).batchSize(5000);

  let processed = 0;
  for await (const doc of cursor) {
    const score = computeScore(doc as any);
    scored.push({ _id: doc._id as mongoose.Types.ObjectId, score, doc });
    processed++;
    if (processed % 50000 === 0) {
      console.log(`  Scored ${processed.toLocaleString()}...`);
    }
  }

  console.log(`  Scored ${processed.toLocaleString()} total`);

  // Step 4: Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  const topAssets = scored.slice(0, TARGET_LIMIT);

  console.log(`\nTop ${topAssets.length.toLocaleString()} selected`);
  console.log(`Score range: ${topAssets[0]?.score.toFixed(1)} → ${topAssets[topAssets.length - 1]?.score.toFixed(1)}`);

  // Step 5: Stats breakdown
  const typeBreakdown: Record<string, number> = {};
  const countryBreakdown: Record<string, number> = {};
  let withIcon = 0;
  let validated = 0;

  for (const item of topAssets) {
    const doc = item.doc;
    typeBreakdown[doc.type] = (typeBreakdown[doc.type] || 0) + 1;
    countryBreakdown[doc.country] = (countryBreakdown[doc.country] || 0) + 1;
    if (doc.iconUrl && doc.iconUrl.length > 0) withIcon++;
    if (doc.logoVerificationStatus === "validated") validated++;
  }

  console.log(`\nType breakdown:`);
  for (const [type, count] of Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count.toLocaleString()}`);
  }

  console.log(`\nTop countries:`);
  for (const [country, count] of Object.entries(countryBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${country}: ${count.toLocaleString()}`);
  }

  console.log(`\nIcon coverage: ${withIcon.toLocaleString()} / ${topAssets.length.toLocaleString()} (${((withIcon / topAssets.length) * 100).toFixed(1)}%)`);
  console.log(`Validated: ${validated.toLocaleString()}`);

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would write ${topAssets.length.toLocaleString()} docs to clean_assets. Exiting.`);
    await mongoose.disconnect();
    return;
  }

  // Step 6: Write to clean_assets collection
  console.log(`\nWriting to clean_assets collection...`);
  const cleanCol = db.collection("clean_assets");

  // Drop existing collection
  try {
    await cleanCol.drop();
  } catch {
    // Doesn't exist yet
  }

  // Insert in batches
  const BATCH_SIZE = 2000;
  let written = 0;
  for (let i = 0; i < topAssets.length; i += BATCH_SIZE) {
    const batch = topAssets.slice(i, i + BATCH_SIZE);
    const docs = batch.map((item) => ({
      ...item.doc,
      _id: item._id,
      assetScore: item.score,
      goldLayerAt: new Date(),
    }));
    await cleanCol.insertMany(docs);
    written += docs.length;
    if (written % 10000 === 0 || written === topAssets.length) {
      console.log(`  Written ${written.toLocaleString()} / ${topAssets.length.toLocaleString()}`);
    }
  }

  // Step 7: Create indexes on clean_assets
  console.log(`\nCreating indexes...`);
  await cleanCol.createIndex({ fullSymbol: 1 }, { unique: true });
  await cleanCol.createIndex({ symbol: 1, type: 1, country: 1 });
  await cleanCol.createIndex({ assetScore: -1 });
  await cleanCol.createIndex({ type: 1, country: 1, assetScore: -1 });
  await cleanCol.createIndex({ searchPrefixes: 1, assetScore: -1 });

  const finalCount = await cleanCol.countDocuments();
  console.log(`\n=== DONE ===`);
  console.log(`clean_assets: ${finalCount.toLocaleString()} documents`);
  console.log(`Reduction: ${totalRaw.toLocaleString()} → ${finalCount.toLocaleString()} (${((1 - finalCount / totalRaw) * 100).toFixed(1)}% removed)`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
