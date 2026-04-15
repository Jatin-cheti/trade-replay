import { IngestionStateModel } from "../models/IngestionState";
import { logger } from "../utils/logger";

/**
 * Checkpoint-based ingestion state manager.
 * Ensures crash recovery by persisting progress after each batch.
 */

export async function getIngestionState(provider: string) {
  return IngestionStateModel.findOne({ provider }).lean();
}

export async function startIngestion(provider: string) {
  await IngestionStateModel.updateOne(
    { provider },
    {
      $set: { status: "running", error: "" },
      $setOnInsert: {
        provider,
        lastCursor: "",
        lastOffset: 0,
        totalIngested: 0,
        totalSkipped: 0,
        lastSyncedAt: null,
        lastBatchSize: 0,
        metadata: {},
      },
    },
    { upsert: true },
  );
  logger.info("ingestion_started", { provider });
}

export async function saveCheckpoint(
  provider: string,
  update: {
    lastCursor?: string;
    lastOffset?: number;
    batchIngested?: number;
    batchSkipped?: number;
    lastBatchSize?: number;
    metadata?: Record<string, unknown>;
  },
) {
  const inc: Record<string, number> = {};
  if (update.batchIngested) inc.totalIngested = update.batchIngested;
  if (update.batchSkipped) inc.totalSkipped = update.batchSkipped;

  const set: Record<string, unknown> = {};
  if (update.lastCursor !== undefined) set.lastCursor = update.lastCursor;
  if (update.lastOffset !== undefined) set.lastOffset = update.lastOffset;
  if (update.lastBatchSize !== undefined) set.lastBatchSize = update.lastBatchSize;
  if (update.metadata) set.metadata = update.metadata;

  const ops: Record<string, unknown> = { $set: set };
  if (Object.keys(inc).length > 0) ops.$inc = inc;

  await IngestionStateModel.updateOne({ provider }, ops);
}

export async function completeIngestion(provider: string) {
  await IngestionStateModel.updateOne(
    { provider },
    { $set: { status: "completed", lastSyncedAt: new Date() } },
  );
  logger.info("ingestion_completed", { provider });
}

export async function failIngestion(provider: string, error: string) {
  await IngestionStateModel.updateOne(
    { provider },
    { $set: { status: "failed", error } },
  );
  logger.error("ingestion_failed", { provider, error });
}

export async function shouldSkipIngestion(
  provider: string,
  minIntervalMs: number = 3 * 60 * 60 * 1000, // 3 hours default
): Promise<boolean> {
  const state = await getIngestionState(provider) as Record<string, unknown> | null;
  if (!state) return false; // never ran
  if (state.status === "running") {
    // Check if stale (>1h means crashed)
    const updatedAt = state.updatedAt ? new Date(state.updatedAt as string).getTime() : 0;
    if (Date.now() - updatedAt > 60 * 60 * 1000) {
      logger.warn("ingestion_stale_detected", { provider, lastUpdate: state.updatedAt });
      return false; // allow resume
    }
    return true; // still running
  }
  if (state.status === "completed" && state.lastSyncedAt) {
    const elapsed = Date.now() - new Date(state.lastSyncedAt as string).getTime();
    if (elapsed < minIntervalMs) {
      logger.info("ingestion_skip_recent", { provider, elapsedMs: elapsed });
      return true;
    }
  }
  return false;
}

export async function getAllIngestionStates() {
  return IngestionStateModel.find().sort({ updatedAt: -1 }).lean();
}
