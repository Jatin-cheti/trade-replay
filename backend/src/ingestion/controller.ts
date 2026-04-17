/**
 * ingestion/controller.ts — API endpoints for the ingestion pipeline.
 *
 * GET  /api/ingestion/status  - Pipeline progress & per-source stats
 * POST /api/ingestion/start   - Enqueue all jobs (fresh run)
 * POST /api/ingestion/resume  - Re-enqueue only failed/incomplete jobs
 * POST /api/ingestion/stop    - Stop the worker gracefully
 */
import type { Request, Response } from "express";
import { logger } from "../utils/logger";
import { enqueueAllJobs, getIngestionQueue } from "./queue";
import { getProgress, resetProgress, setState } from "./checkpoint";
import { startIngestionWorker, stopIngestionWorker } from "./worker";

export async function getIngestionStatus(_req: Request, res: Response): Promise<void> {
  const progress = await getProgress();

  // Also get queue stats
  const q = getIngestionQueue();
  const [waiting, active, delayed, completed, failed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getDelayedCount(),
    q.getCompletedCount(),
    q.getFailedCount(),
  ]);

  res.json({
    pipeline: progress,
    queue: { waiting, active, delayed, completed, failed },
  });
}

export async function startIngestion(_req: Request, res: Response): Promise<void> {
  const progress = await getProgress();
  if (progress.state === "running") {
    res.status(409).json({ error: "Pipeline already running", state: progress.state });
    return;
  }

  logger.info("ingestion_start_requested");

  // Reset progress & enqueue all jobs
  const count = await enqueueAllJobs();
  await resetProgress(count);

  // Start worker if not running
  startIngestionWorker();

  res.json({ status: "started", jobsEnqueued: count });
}

export async function resumeIngestion(_req: Request, res: Response): Promise<void> {
  const progress = await getProgress();
  if (progress.state === "running") {
    res.status(409).json({ error: "Pipeline already running" });
    return;
  }

  logger.info("ingestion_resume_requested");

  // Re-enqueue all (obliterate clears stale, checkpoints prevent re-fetch for CoinGecko)
  const count = await enqueueAllJobs();
  await setState("running");

  // Start worker if not running
  startIngestionWorker();

  res.json({ status: "resumed", jobsEnqueued: count });
}

export async function stopIngestion(_req: Request, res: Response): Promise<void> {
  stopIngestionWorker();
  await setState("idle");
  res.json({ status: "stopped" });
}
