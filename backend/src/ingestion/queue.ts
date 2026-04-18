/**
 * ingestion/queue.ts — BullMQ queue for deterministic, resumable data ingestion.
 *
 * Each source becomes one or more jobs. CoinGecko is split into 50 page-jobs
 * so rate-limiting doesn't block the rest of the pipeline.
 */
import { Queue, type JobsOptions } from "bullmq";
import { redisQueueConnectionOptions } from "../config/redis";
import { logger } from "../utils/logger";

export const INGESTION_QUEUE_NAME = "ingestion-jobs";

const defaultJobOpts: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 500,
  removeOnFail: 1000,
};

let ingestionQueue: Queue | null = null;

export function getIngestionQueue(): Queue {
  if (ingestionQueue) return ingestionQueue;
  ingestionQueue = new Queue(INGESTION_QUEUE_NAME, {
    connection: redisQueueConnectionOptions,
    defaultJobOptions: defaultJobOpts,
  });
  return ingestionQueue;
}

/* ── Source definitions ─────────────────────────────────────────────── */

export type SourceName =
  | "nasdaq-trader"
  | "alpha-vantage"
  | "coingecko-markets"
  | "coingecko-list"
  | "binance"
  | "coinbase"
  | "kraken"
  | "okx"
  | "bybit"
  | "gateio"
  | "kucoin"
  | "mexc"
  | "nse"
  | "bse"
  | "sec-edgar"
  | "forex"
  | "indices"
  | "bonds-economy"
  | "etfs";

export interface IngestionJobData {
  source: SourceName;
  page?: number;        // for paginated sources (coingecko-markets)
  totalPages?: number;  // total pages expected
}

/**
 * Enqueue all ingestion jobs. Idempotent — skips already-queued jobs.
 * CoinGecko gets 50 individual page jobs (non-blocking).
 */
export async function enqueueAllJobs(): Promise<number> {
  const q = getIngestionQueue();

  // Clear any stale jobs from previous runs
  await q.obliterate({ force: true });

  const jobs: { name: string; data: IngestionJobData; opts?: JobsOptions }[] = [];

  // Single-fetch sources (fast, no pagination)
  const singleSources: SourceName[] = [
    "nasdaq-trader",
    "alpha-vantage",
    "binance",
    "coinbase",
    "kraken",
    "okx",
    "bybit",
    "gateio",
    "kucoin",
    "mexc",
    "nse",
    "bse",
    "sec-edgar",
    "forex",
    "indices",
    "bonds-economy",
    "etfs",
  ];

  for (const source of singleSources) {
    jobs.push({ name: source, data: { source } });
  }

  // CoinGecko markets — 50 individual page jobs with custom delay for rate limits
  for (let page = 1; page <= 50; page++) {
    jobs.push({
      name: `coingecko-markets-p${page}`,
      data: { source: "coingecko-markets", page, totalPages: 50 },
      opts: {
        attempts: 5,
        backoff: { type: "exponential", delay: 10000 },
        // Stagger pages so they don't hit rate limits simultaneously
        delay: (page - 1) * 1500,
      },
    });
  }

  // CoinGecko coins/list (separate, runs after market pages)
  jobs.push({
    name: "coingecko-list",
    data: { source: "coingecko-list" },
    opts: { attempts: 5, backoff: { type: "exponential", delay: 15000 } },
  });

  // Bulk add
  await q.addBulk(jobs);
  logger.info("ingestion_jobs_enqueued", { count: jobs.length });
  return jobs.length;
}
