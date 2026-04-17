/**
 * syncCleanAssetsToAtlas.cjs — Migrate local CleanAssets → Atlas production.
 *
 * Usage:
 *   node backend/scripts/syncCleanAssetsToAtlas.cjs
 *
 * Reads from LOCAL_MONGO, writes to ATLAS_MONGO.
 * Drops old `clean_assets` collection on Atlas for storage savings.
 * Replaces Atlas `cleanassets` with full dataset from local (102K).
 */

const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// Load env
const envPath = path.resolve(__dirname, "../../.env");
const secretsPath = path.resolve(__dirname, "../../.env.secrets");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(secretsPath)) dotenv.config({ path: secretsPath, override: true });

const LOCAL_URI = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const ATLAS_URI = process.env.MONGO_URI_PRODUCTION;

if (!ATLAS_URI) {
  console.error("MONGO_URI_PRODUCTION not set. Add it to .env or pass as env var.");
  process.exit(1);
}

const BATCH_SIZE = 2000;

async function run() {
  console.log("Connecting to local MongoDB...");
  const localClient = new MongoClient(LOCAL_URI);
  await localClient.connect();
  const localDb = localClient.db();

  console.log("Connecting to Atlas...");
  const atlasClient = new MongoClient(ATLAS_URI);
  await atlasClient.connect();
  const atlasDb = atlasClient.db();

  // ── Step 1: Count source data ──
  const localCount = await localDb.collection("cleanassets").countDocuments();
  const atlasCount = await atlasDb.collection("cleanassets").countDocuments();
  console.log(`Local cleanassets: ${localCount}`);
  console.log(`Atlas cleanassets: ${atlasCount}`);

  if (localCount === 0) {
    console.error("No local cleanassets found. Run ingestion locally first.");
    process.exit(1);
  }

  // ── Step 2: Drop old `clean_assets` collection on Atlas (legacy naming) ──
  try {
    const oldCount = await atlasDb.collection("clean_assets").countDocuments();
    if (oldCount > 0) {
      console.log(`Dropping legacy clean_assets collection (${oldCount} docs)...`);
      await atlasDb.collection("clean_assets").drop();
      console.log("Dropped clean_assets (saved ~40MB)");
    }
  } catch (e) {
    console.log("No legacy clean_assets to drop:", e.message);
  }

  // ── Step 3: Read all local cleanassets in batches and upsert to Atlas ──
  console.log(`\nMigrating ${localCount} cleanassets to Atlas in batches of ${BATCH_SIZE}...`);

  let processed = 0;
  let upserted = 0;
  let errors = 0;
  const cursor = localDb.collection("cleanassets").find({}).batchSize(BATCH_SIZE);

  let batch = [];
  for await (const doc of cursor) {
    // Remove _id to allow upsert, use fullSymbol as the key
    const { _id, ...data } = doc;
    batch.push({
      updateOne: {
        filter: { fullSymbol: data.fullSymbol },
        update: { $set: data },
        upsert: true,
      },
    });

    if (batch.length >= BATCH_SIZE) {
      try {
        const result = await atlasDb.collection("cleanassets").bulkWrite(batch, { ordered: false });
        upserted += (result.upsertedCount || 0) + (result.modifiedCount || 0);
      } catch (e) {
        errors += batch.length;
        console.error(`Batch error at ${processed}: ${e.message}`);
      }
      processed += batch.length;
      batch = [];
      process.stdout.write(`  ${processed}/${localCount} (${((processed/localCount)*100).toFixed(1)}%)\r`);
    }
  }

  // Final batch
  if (batch.length > 0) {
    try {
      const result = await atlasDb.collection("cleanassets").bulkWrite(batch, { ordered: false });
      upserted += (result.upsertedCount || 0) + (result.modifiedCount || 0);
    } catch (e) {
      errors += batch.length;
      console.error(`Final batch error: ${e.message}`);
    }
    processed += batch.length;
  }

  // ── Step 4: Verify ──
  const finalCount = await atlasDb.collection("cleanassets").countDocuments();
  const sectorCount = await atlasDb.collection("cleanassets").distinct("sector").then(s => s.filter(Boolean).length);
  const typeCount = await atlasDb.collection("cleanassets").distinct("type").then(t => t.length);

  console.log(`\n\n=== MIGRATION COMPLETE ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Upserted/Updated: ${upserted}`);
  console.log(`Errors: ${errors}`);
  console.log(`Atlas cleanassets now: ${finalCount}`);
  console.log(`Sectors: ${sectorCount}`);
  console.log(`Types: ${typeCount}`);
  console.log(`Match: ${finalCount === localCount ? "✅ PERFECT" : `⚠️ ${finalCount} vs ${localCount}`}`);

  // ── Step 5: Also sync symbols collection (only isCleanAsset=true ones) ──
  const localSymCleanCount = await localDb.collection("symbols").countDocuments({ isCleanAsset: true });
  const atlasSymCount = await atlasDb.collection("symbols").countDocuments();
  console.log(`\nLocal symbols (isCleanAsset): ${localSymCleanCount}`);
  console.log(`Atlas symbols (total): ${atlasSymCount}`);

  await localClient.close();
  await atlasClient.close();
}

run().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
