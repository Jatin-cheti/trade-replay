/**
 * Asset Service — Dedicated PM2 process for ingestion + gold-layer lifecycle.
 *
 * Responsibilities:
 * 1. Continuous symbol ingestion via globalInfiniteExpansionLoop
 * 2. Periodic gold-layer (clean_assets) rebuild
 * 3. Logo recovery loop
 * 4. Ingestion health checks
 *
 * Does NOT handle: HTTP API, search, user auth, portfolio, alerts
 */

import mongoose from "mongoose";
import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { bootstrapKafkaProducerOnly, shutdownKafka } from "./kafka";
import { logger } from "./utils/logger";
import { runInfiniteGlobalExpansionLoop } from "./services/globalSymbolExpansion.service";
import { getMissingLogosBatch, repopulateMissingLogos } from "./services/missingLogo.service";
import { processLogoBatchWithConcurrency } from "./services/logoProcessing.service";
import { computeFallbackRatio } from "./services/logoValidation.service";
import { buildCleanAssets, getCleanAssetStats } from "./services/cleanAsset.service";
import { ingestGlobalSymbols } from "./services/ingestion.service";
import { SymbolModel } from "./models/Symbol";

// ─── Env config ──────────────────────────────────────────
function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const LOOP_SLEEP_MS = readPositiveIntEnv("GLOBAL_LOOP_SLEEP_MS", 45_000);
const LOGO_BATCH_SIZE = readPositiveIntEnv("GLOBAL_LOGO_BATCH_SIZE", 700);
const LOGO_CONCURRENCY = readPositiveIntEnv("GLOBAL_LOGO_CONCURRENCY", 80);
const TARGET_SYMBOLS = readPositiveIntEnv("GLOBAL_TARGET_SYMBOLS", 250_000);
const TARGET_PER_CYCLE = readPositiveIntEnv("GLOBAL_TARGET_PER_CYCLE", 30_000);
const BASE_LIMIT = readPositiveIntEnv("GLOBAL_BASE_LIMIT", 5_000);
const GOLD_LAYER_INTERVAL_MS = readPositiveIntEnv("GOLD_LAYER_INTERVAL_MS", 600_000); // 10 min default

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Gold-layer rebuild loop ─────────────────────────────
async function goldLayerLoop(): Promise<void> {
  // Initial build immediately on startup
  try {
    const stats = await buildCleanAssets();
    logger.info("asset_svc_gold_layer_initial", stats);
  } catch (err) {
    logger.error("asset_svc_gold_layer_initial_error", { error: String(err) });
  }

  while (true) {
    await sleep(GOLD_LAYER_INTERVAL_MS);
    try {
      const stats = await buildCleanAssets();
      logger.info("asset_svc_gold_layer_rebuild", stats);

      const assetStats = await getCleanAssetStats();
      logger.info("asset_svc_gold_layer_stats", {
        total: assetStats.total,
        types: assetStats.byType?.length,
        countries: assetStats.topCountries?.length,
      });
    } catch (err) {
      logger.error("asset_svc_gold_layer_error", { error: String(err) });
    }
  }
}

// ─── Logo recovery loop ─────────────────────────────────
async function logoRecoveryLoop(): Promise<void> {
  while (true) {
    try {
      const repopulated = await repopulateMissingLogos();
      logger.info("asset_svc_logo_repopulate", repopulated);

      const batch = await getMissingLogosBatch(LOGO_BATCH_SIZE, { includeUnresolved: true });
      if (batch.length > 0) {
        const result = await processLogoBatchWithConcurrency(batch, LOGO_CONCURRENCY, "deep_enrichment", {
          minConfidence: 0,
          popularityForceThreshold: 0,
        });

        logger.info("asset_svc_logo_batch", {
          batch: batch.length,
          processed: result.processed,
          resolved: result.resolved,
          concurrency: LOGO_CONCURRENCY,
        });
      }

      const ratio = await computeFallbackRatio();
      logger.info("asset_svc_logo_coverage", {
        totalSymbols: ratio.totalSymbols,
        unresolved: ratio.fallbackCount,
        coveragePercent: Number(((1 - ratio.ratio) * 100).toFixed(4)),
      });
    } catch (error) {
      logger.error("asset_svc_logo_loop_error", { message: String(error) });
    }

    await sleep(LOOP_SLEEP_MS);
  }
}

// ─── Bootstrap safety: ensure base symbols exist ─────────
async function ensureBaseSymbols(): Promise<void> {
  const count = await SymbolModel.estimatedDocumentCount();
  if (count > 0) {
    logger.info("asset_svc_symbols_exist", { count });
    return;
  }

  logger.warn("asset_svc_bootstrap_ingest", { reason: "empty_symbols_collection" });
  const result = await ingestGlobalSymbols();
  logger.info("asset_svc_bootstrap_ingest_done", result);
}

// ─── Main ────────────────────────────────────────────────
async function main(): Promise<void> {
  logger.info("asset_svc_start", {
    targetSymbols: TARGET_SYMBOLS,
    loopSleepMs: LOOP_SLEEP_MS,
    goldLayerIntervalMs: GOLD_LAYER_INTERVAL_MS,
  });

  await connectDB();
  await connectRedis();
  await bootstrapKafkaProducerOnly();
  await ensureBaseSymbols();

  // Run all loops concurrently
  await Promise.all([
    runInfiniteGlobalExpansionLoop({
      intervalMs: LOOP_SLEEP_MS,
      targetPerCycle: TARGET_PER_CYCLE,
      maxUniverseSymbols: TARGET_SYMBOLS,
      baseLimit: BASE_LIMIT,
    }),
    logoRecoveryLoop(),
    goldLayerLoop(),
  ]);
}

// ─── Graceful shutdown ───────────────────────────────────
const shutdown = async () => {
  logger.info("asset_svc_shutdown");
  await shutdownKafka();
  await mongoose.connection.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

main().catch((error) => {
  logger.error("asset_svc_crashed", { message: String(error) });
  mongoose.connection
    .close()
    .catch(() => {})
    .finally(() => process.exit(1));
});
