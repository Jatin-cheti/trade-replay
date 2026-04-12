import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { logger } from "../utils/logger";
import { runInfiniteGlobalExpansionLoop } from "../services/globalSymbolExpansion.service";
import { getMissingLogosBatch, repopulateMissingLogos } from "../services/missingLogo.service";
import { processLogoBatchWithConcurrency } from "../services/logoProcessing.service";
import { computeFallbackRatio } from "../services/logoValidation.service";

const LOOP_SLEEP_MS = 45000;
const LOGO_BATCH_SIZE = 700;
const LOGO_CONCURRENCY = 80;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startLogoRecoveryLoop(): Promise<void> {
  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const repopulated = await repopulateMissingLogos();
      logger.info("infinite_logo_repopulate", repopulated);

      // eslint-disable-next-line no-await-in-loop
      const batch = await getMissingLogosBatch(LOGO_BATCH_SIZE, { includeUnresolved: true });
      if (batch.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        const result = await processLogoBatchWithConcurrency(batch, LOGO_CONCURRENCY, "deep_enrichment", {
          minConfidence: 0,
          popularityForceThreshold: 0,
        });

        logger.info("infinite_logo_batch", {
          batch: batch.length,
          processed: result.processed,
          resolved: result.resolved,
          concurrency: LOGO_CONCURRENCY,
        });
      }

      // eslint-disable-next-line no-await-in-loop
      const ratio = await computeFallbackRatio();
      logger.info("infinite_logo_coverage", {
        totalSymbols: ratio.totalSymbols,
        unresolved: ratio.fallbackCount,
        coveragePercent: Number(((1 - ratio.ratio) * 100).toFixed(4)),
      });
    } catch (error) {
      logger.error("infinite_logo_loop_failed", {
        message: String(error),
      });
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(LOOP_SLEEP_MS);
  }
}

async function main(): Promise<void> {
  await connectDB();

  logger.info("global_infinite_expansion_start", {
    targetSymbols: 3500000,
    realLogosOnly: true,
    fallbackAllowed: false,
  });

  await Promise.all([
    runInfiniteGlobalExpansionLoop({
      intervalMs: LOOP_SLEEP_MS,
      targetPerCycle: 400000,
      maxUniverseSymbols: 3500000,
      baseLimit: 30000,
    }),
    startLogoRecoveryLoop(),
  ]);
}

main().catch((error) => {
  logger.error("global_infinite_expansion_crashed", {
    message: String(error),
  });
  mongoose.connection
    .close()
    .catch(() => {})
    .finally(() => process.exit(1));
});