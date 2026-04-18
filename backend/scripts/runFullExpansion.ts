/**
 * runFullExpansion.ts — One-shot full symbol expansion + clean asset rebuild
 *
 * Runs ALL expansion sources (FMP, CoinGecko, Binance, Coinbase, Kraken,
 * OKX, Gate.io, KuCoin, MEXC, Bitfinex, Huobi, Crypto.com, Alpha Vantage,
 * SEC, NSE, BSE, OpenFIGI, Wikidata) then syncs GlobalMaster → Symbols
 * and rebuilds the clean_assets gold layer.
 *
 * Usage: npx tsx scripts/runFullExpansion.ts
 */
import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { logger } from "../src/utils/logger";
import {
  ingestGlobalSymbolsIncremental,
  syncGlobalMasterToSymbols,
  getExpansionStats,
} from "../src/services/symbolExpansion.service";
import { buildCleanAssets } from "../src/services/cleanAsset.service";

async function main(): Promise<void> {
  await connectDB();

  const before = await mongoose.connection.db!.collection("symbols").estimatedDocumentCount();
  const cleanBefore = await mongoose.connection.db!.collection("cleanassets").estimatedDocumentCount();

  console.log("\n=== FULL SYMBOL EXPANSION ===");
  console.log(`Symbols before: ${before}`);
  console.log(`Clean assets before: ${cleanBefore}\n`);

  // Phase 1: Run incremental expansion (FMP + all exchanges + crypto + forex)
  console.log("--- Phase 1: FMP + Exchange Expansion ---");
  const report = await ingestGlobalSymbolsIncremental();

  console.log("\nExpansion Results:");
  console.log(`  Before: ${report.totalBefore}`);
  console.log(`  After:  ${report.totalAfter}`);
  console.log(`  Gain:   +${report.netGain}`);
  console.log(`  Sources: ${report.sources.length}`);
  console.log(`  Duration: ${(report.totalDurationMs / 1000).toFixed(1)}s\n`);

  for (const s of report.sources) {
    if (s.fetched > 0 || s.errors > 0) {
      console.log(`  ${s.source.padEnd(30)} fetched=${s.fetched} new=${s.newInserted} skip=${s.existingSkipped} err=${s.errors}`);
    }
  }

  // Phase 2: Sync GlobalMaster → Symbols table
  console.log("\n--- Phase 2: Sync GlobalMaster → Symbols ---");
  let totalSynced = 0;
  for (let i = 0; i < 20; i++) {
    const { synced } = await syncGlobalMasterToSymbols(5000);
    totalSynced += synced;
    if (synced === 0) break;
    console.log(`  Batch ${i + 1}: synced ${synced} (total: ${totalSynced})`);
  }
  console.log(`  Total synced: ${totalSynced}`);

  // Phase 3: Rebuild clean assets
  console.log("\n--- Phase 3: Rebuild Clean Assets ---");
  const cleanResult = await buildCleanAssets();
  console.log(`  Processed: ${cleanResult.processed}`);
  console.log(`  Promoted:  ${cleanResult.promoted}`);
  console.log(`  Skipped:   ${cleanResult.skipped}`);
  console.log(`  Duration:  ${(cleanResult.duration / 1000).toFixed(1)}s`);

  // Phase 4: Final stats
  const after = await mongoose.connection.db!.collection("symbols").estimatedDocumentCount();
  const cleanAfter = await mongoose.connection.db!.collection("cleanassets").estimatedDocumentCount();
  const stats = await getExpansionStats();

  console.log("\n=== FINAL STATS ===");
  console.log(`Raw symbols:   ${before} → ${after} (+${after - before})`);
  console.log(`Clean assets:  ${cleanBefore} → ${cleanAfter} (+${cleanAfter - cleanBefore})`);
  console.log(`GlobalMaster:  ${stats.globalMasterCount}`);
  console.log(`\nBy type:`);
  for (const t of stats.byType) {
    console.log(`  ${t.type.padEnd(15)} ${t.count}`);
  }
  console.log(`\nTop countries:`);
  for (const c of stats.byCountry.slice(0, 10)) {
    console.log(`  ${c.country.padEnd(10)} ${c.count}`);
  }
  console.log(`\nTop sources:`);
  for (const s of stats.bySource.slice(0, 15)) {
    console.log(`  ${s.source.padEnd(30)} ${s.count}`);
  }
  console.log("\n=== EXPANSION COMPLETE ===\n");

  await mongoose.connection.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Expansion failed:", error);
    process.exit(1);
  });
