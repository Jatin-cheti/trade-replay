import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { logger } from "../utils/logger";
import { getMissingLogosBatch, repopulateMissingLogos } from "../services/missingLogo.service";
import { processLogoBatchWithConcurrency } from "../services/logoProcessing.service";
import { computeFallbackRatio } from "../services/logoValidation.service";
import { ingestGlobalSymbolsOnce } from "../services/globalSymbolIngestion.service";

const LOOP_SLEEP_MS = 60_000;
const BASE_BATCH_SIZE = 400;
const BASE_CONCURRENCY = 20;
const MAX_BATCH_SIZE = 500;
const MAX_CONCURRENCY = 50;
const STALL_THRESHOLD = 3;
const REPOPULATE_EVERY_CYCLES = 5;
const GROWTH_THRESHOLD_PERCENT = 0.5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  await connectDB();
  logger.info("global_logo_coverage_loop_start");

  let lastFallbackCount: number | null = null;
  let lastCoveragePercent: number | null = null;
  let stallStreak = 0;
  let cyclesSinceRepopulate = REPOPULATE_EVERY_CYCLES;

  while (true) {
    try {
      if (cyclesSinceRepopulate >= REPOPULATE_EVERY_CYCLES) {
        // eslint-disable-next-line no-await-in-loop
        const repopulated = await repopulateMissingLogos();
        cyclesSinceRepopulate = 0;
        logger.info("global_logo_repopulate_pass", repopulated);
      }

      const adaptiveBatchSize = Math.min(MAX_BATCH_SIZE, BASE_BATCH_SIZE + stallStreak * 50);
      const adaptiveConcurrency = Math.min(MAX_CONCURRENCY, BASE_CONCURRENCY + stallStreak * 5);

      // eslint-disable-next-line no-await-in-loop
      const batch = await getMissingLogosBatch(adaptiveBatchSize, { includeUnresolved: stallStreak >= 2 });
      if (batch.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        const result = await processLogoBatchWithConcurrency(batch, adaptiveConcurrency, "deep_enrichment");
        logger.info("global_logo_coverage_batch", {
          processed: result.processed,
          resolved: result.resolved,
          batchSize: adaptiveBatchSize,
          concurrency: adaptiveConcurrency,
          stallStreak,
        });
      }

      // eslint-disable-next-line no-await-in-loop
      const fallbackRatio = await computeFallbackRatio();
      const coveragePercent = Number(((1 - fallbackRatio.ratio) * 100).toFixed(3));
      logger.info("global_logo_coverage_snapshot", fallbackRatio);

      if (lastCoveragePercent !== null) {
        const growth = Number((coveragePercent - lastCoveragePercent).toFixed(3));
        if (growth < GROWTH_THRESHOLD_PERCENT) {
          stallStreak += 1;
        }
        logger.info("global_logo_coverage_growth", {
          previousCoveragePercent: lastCoveragePercent,
          coveragePercent,
          growth,
          growthThreshold: GROWTH_THRESHOLD_PERCENT,
        });
      }

      if (lastFallbackCount !== null && fallbackRatio.fallbackCount >= lastFallbackCount) {
        stallStreak += 1;
      } else {
        stallStreak = 0;
      }

      if (stallStreak >= STALL_THRESHOLD) {
        logger.warn("global_logo_coverage_stalled", {
          stallStreak,
          fallbackCount: fallbackRatio.fallbackCount,
          totalSymbols: fallbackRatio.totalSymbols,
          action: "expand_data_sources",
        });

        // eslint-disable-next-line no-await-in-loop
        await ingestGlobalSymbolsOnce();
        stallStreak = 0;
      }

      lastFallbackCount = fallbackRatio.fallbackCount;
      lastCoveragePercent = coveragePercent;
      cyclesSinceRepopulate += 1;
    } catch (error) {
      logger.error("global_logo_coverage_loop_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      cyclesSinceRepopulate = Math.min(REPOPULATE_EVERY_CYCLES, cyclesSinceRepopulate + 1);
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(LOOP_SLEEP_MS);
  }
}

main().catch((error) => {
  logger.error("global_logo_coverage_loop_crashed", {
    message: error instanceof Error ? error.message : String(error),
  });
  mongoose.connection
    .close()
    .catch(() => {})
    .finally(() => process.exit(1));
});
