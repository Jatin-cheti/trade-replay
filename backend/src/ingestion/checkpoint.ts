/**
 * ingestion/checkpoint.ts — Redis-backed checkpointing & progress tracking.
 *
 * Stores per-source progress so the pipeline can resume after restarts.
 * Also tracks global pipeline state for the monitoring endpoint.
 */
import { redisClient, isRedisReady } from "../config/redis";
import { logger } from "../utils/logger";

const PREFIX = "ingestion:checkpoint";
const PROGRESS_KEY = "ingestion:progress";
const STATE_KEY = "ingestion:state";

/* ── Per-source checkpoint ─────────────────────────────────────────── */

export async function setCheckpoint(source: string, page: number): Promise<void> {
  if (!isRedisReady()) return;
  await redisClient.set(`${PREFIX}:${source}`, String(page), "EX", 86400);
}

export async function getCheckpoint(source: string): Promise<number> {
  if (!isRedisReady()) return 0;
  const val = await redisClient.get(`${PREFIX}:${source}`);
  return val ? parseInt(val, 10) : 0;
}

export async function clearCheckpoint(source: string): Promise<void> {
  if (!isRedisReady()) return;
  await redisClient.del(`${PREFIX}:${source}`);
}

/* ── Global progress tracking ──────────────────────────────────────── */

export interface IngestionProgress {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  processedSymbols: number;
  newSymbols: number;
  startedAt: string;
  updatedAt: string;
  state: "idle" | "running" | "validating" | "building-gold" | "complete" | "failed";
  errors: string[];
  sourceStats: Record<string, { fetched: number; new: number; status: string }>;
}

const DEFAULT_PROGRESS: IngestionProgress = {
  totalJobs: 0,
  completedJobs: 0,
  failedJobs: 0,
  processedSymbols: 0,
  newSymbols: 0,
  startedAt: "",
  updatedAt: "",
  state: "idle",
  errors: [],
  sourceStats: {},
};

export async function getProgress(): Promise<IngestionProgress> {
  if (!isRedisReady()) return { ...DEFAULT_PROGRESS };
  const raw = await redisClient.get(PROGRESS_KEY);
  if (!raw) return { ...DEFAULT_PROGRESS };
  try { return JSON.parse(raw); } catch { return { ...DEFAULT_PROGRESS }; }
}

export async function setProgress(update: Partial<IngestionProgress>): Promise<void> {
  if (!isRedisReady()) return;
  const current = await getProgress();
  const merged: IngestionProgress = {
    ...current,
    ...update,
    updatedAt: new Date().toISOString(),
    sourceStats: { ...current.sourceStats, ...(update.sourceStats || {}) },
    errors: update.errors ?? current.errors,
  };
  await redisClient.set(PROGRESS_KEY, JSON.stringify(merged), "EX", 86400);
}

export async function recordSourceResult(
  source: string,
  fetched: number,
  newCount: number,
  status: "done" | "failed",
): Promise<void> {
  const current = await getProgress();
  current.sourceStats[source] = { fetched, new: newCount, status };
  current.processedSymbols += fetched;
  current.newSymbols += newCount;
  if (status === "done") current.completedJobs++;
  else current.failedJobs++;
  await setProgress(current);
}

export async function addError(msg: string): Promise<void> {
  const current = await getProgress();
  current.errors = [...current.errors.slice(-49), msg]; // keep last 50
  await setProgress(current);
}

export async function setState(state: IngestionProgress["state"]): Promise<void> {
  await setProgress({ state });
}

export async function resetProgress(totalJobs: number): Promise<void> {
  await setProgress({
    totalJobs,
    completedJobs: 0,
    failedJobs: 0,
    processedSymbols: 0,
    newSymbols: 0,
    startedAt: new Date().toISOString(),
    state: "running",
    errors: [],
    sourceStats: {},
  });
}
