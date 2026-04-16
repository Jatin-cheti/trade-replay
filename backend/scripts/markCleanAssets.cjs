/**
 * markCleanAssets.cjs
 * Marks symbols in the `symbols` collection that have a matching entry in `clean_assets`.
 * Sets isCleanAsset=true on matching symbols and false on the rest.
 */
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const BATCH_SIZE = 5000;

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  const cleanAssets = db.collection("clean_assets");
  const symbols = db.collection("symbols");

  // Step 1: Get all fullSymbols from clean_assets
  console.log("Fetching clean_assets fullSymbols...");
  const cleanDocs = await cleanAssets.find({}, { projection: { fullSymbol: 1 } }).toArray();
  const cleanFullSymbols = cleanDocs.map((d) => d.fullSymbol);
  console.log(`Found ${cleanFullSymbols.length} clean assets`);

  // Step 2: Reset all isCleanAsset to false first
  console.log("Resetting all symbols to isCleanAsset=false...");
  const resetResult = await symbols.updateMany(
    { isCleanAsset: true },
    { $set: { isCleanAsset: false } }
  );
  console.log(`Reset ${resetResult.modifiedCount} symbols`);

  // Step 3: Mark matching symbols in batches
  let marked = 0;
  for (let i = 0; i < cleanFullSymbols.length; i += BATCH_SIZE) {
    const batch = cleanFullSymbols.slice(i, i + BATCH_SIZE);
    const result = await symbols.updateMany(
      { fullSymbol: { $in: batch } },
      { $set: { isCleanAsset: true } }
    );
    marked += result.modifiedCount;
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: marked ${result.modifiedCount} (total: ${marked})`);
  }

  console.log(`\nDone! Marked ${marked} symbols as clean assets`);

  // Step 4: Verify counts
  const totalClean = await symbols.countDocuments({ isCleanAsset: true });
  const totalSymbols = await symbols.estimatedDocumentCount();
  console.log(`Verification: ${totalClean} clean / ${totalSymbols} total (${((totalClean / totalSymbols) * 100).toFixed(1)}%)`);

  // Step 5: Ensure indexes exist
  console.log("Ensuring indexes...");
  await symbols.createIndex(
    { isCleanAsset: 1, searchPrefixes: 1, priorityScore: -1 },
    { name: "clean_asset_prefixes_idx", sparse: true }
  );
  await symbols.createIndex(
    { isCleanAsset: 1, priorityScore: -1 },
    { name: "clean_asset_priority_idx", sparse: true }
  );
  await symbols.createIndex(
    { isCleanAsset: 1, symbol: 1, priorityScore: -1 },
    { name: "clean_asset_symbol_idx", sparse: true }
  );
  console.log("Indexes created");

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
