import { Queue } from "bullmq";
import { isRedisReady, redisClient } from "../config/redis";
import { redisConnectionOptions } from "../config/redis";
import { logger } from "../utils/logger";

type QueueSymbol = {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  type: "stock" | "crypto" | "forex" | "index";
  iconUrl?: string;
  s3Icon?: string;
  companyDomain?: string;
  popularity?: number;
  searchFrequency?: number;
  createdAt: number;
};

type QueueSymbolInput = Omit<QueueSymbol, "createdAt"> & { createdAt?: number };

const LOGO_QUEUE_NAME = "logo-enrichment";
const LOGO_QUEUE_JOB = "symbol-logo-enrichment";
const MAX_QUEUE_SIZE = 2000;
const BACKPRESSURE_QUEUE_THRESHOLD = 1000;
const MAX_ENQUEUE_PER_MINUTE = 500;
const ENQUEUE_DEDUPE_TTL_SECONDS = 20 * 60;

let queue: Queue<QueueSymbol> | null = null;
let currentEnqueueMinute = 0;
let jobsCreatedThisMinute = 0;
let skippedCounter = 0;
let droppedCounter = 0;

async function shouldEnqueueByDedupeWindow(fullSymbol: string): Promise<boolean> {
  if (!isRedisReady()) return true;

  try {
    const dedupeKey = `app:dedupe:logo:${fullSymbol}`;
    const result = await redisClient.set(dedupeKey, "1", "EX", ENQUEUE_DEDUPE_TTL_SECONDS, "NX");
    return result === "OK";
  } catch {
    // Graceful degradation when Redis is unavailable.
    return true;
  }
}

function getLogoQueue(): Queue<QueueSymbol> {
  if (queue) return queue;

  queue = new Queue<QueueSymbol>(LOGO_QUEUE_NAME, {
    connection: redisConnectionOptions,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 5000,
      removeOnFail: 5000,
      backoff: { type: "fixed", delay: 1000 },
    },
  });

  return queue;
}

function canEnqueueNow(): boolean {
  const minuteBucket = Math.floor(Date.now() / 60000);
  if (minuteBucket !== currentEnqueueMinute) {
    currentEnqueueMinute = minuteBucket;
    jobsCreatedThisMinute = 0;
  }

  if (jobsCreatedThisMinute >= MAX_ENQUEUE_PER_MINUTE) {
    return false;
  }

  jobsCreatedThisMinute += 1;
  return true;
}

function hasExistingIcon(symbol: { iconUrl?: string; s3Icon?: string }): boolean {
  return Boolean(symbol.iconUrl?.trim() || symbol.s3Icon?.trim());
}

function priorityOf(symbol: QueueSymbol): number {
  const basePriority = (symbol.popularity ?? 0) + (symbol.searchFrequency ?? 0);
  const ageBoost = Date.now() - symbol.createdAt;
  return Math.floor(basePriority + ageBoost * 0.0001);
}

async function enqueueSymbolLogoEnrichmentInternal(symbol: QueueSymbolInput): Promise<void> {
  if (hasExistingIcon(symbol)) return;

  const normalized: QueueSymbol = {
    ...symbol,
    symbol: symbol.symbol.toUpperCase(),
    fullSymbol: symbol.fullSymbol.toUpperCase(),
    exchange: symbol.exchange.toUpperCase(),
    createdAt: symbol.createdAt || Date.now(),
  };

  const shouldEnqueue = await shouldEnqueueByDedupeWindow(normalized.fullSymbol);
  if (!shouldEnqueue) {
    skippedCounter += 1;
    return;
  }

  const logoQueue = getLogoQueue();
  const waiting = await logoQueue.getWaitingCount();
  const active = await logoQueue.getActiveCount();
  const delayed = await logoQueue.getDelayedCount();
  const total = waiting + active + delayed;

  if (total >= MAX_QUEUE_SIZE) {
    droppedCounter += 1;
    logger.warn("logo_queue_full_drop", {
      queueSize: total,
      maxQueueSize: MAX_QUEUE_SIZE,
      fullSymbol: normalized.fullSymbol,
    });
    return;
  }

  if (total > BACKPRESSURE_QUEUE_THRESHOLD) {
    logger.warn("logo_queue_backpressure", {
      queueSize: total,
      threshold: BACKPRESSURE_QUEUE_THRESHOLD,
    });
  }

  if (!canEnqueueNow()) {
    droppedCounter += 1;
    logger.warn("logo_queue_enqueue_rate_limited", {
      perMinuteLimit: MAX_ENQUEUE_PER_MINUTE,
      fullSymbol: normalized.fullSymbol,
    });
    return;
  }

  await logoQueue.add(LOGO_QUEUE_JOB, normalized, {
    jobId: normalized.fullSymbol,
    priority: priorityOf(normalized),
  });
}

export function enqueueSymbolLogoEnrichment(symbol: QueueSymbolInput): void {
  void enqueueSymbolLogoEnrichmentInternal(symbol).catch((error) => {
    logger.error("logo_queue_enqueue_failed", {
      fullSymbol: symbol.fullSymbol,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export function enqueueSymbolLogoEnrichmentBatch(symbols: QueueSymbolInput[]): void {
  void Promise.all(
    symbols.map((symbol) => enqueueSymbolLogoEnrichmentInternal({ ...symbol, createdAt: Date.now() })),
  ).catch((error) => {
    logger.error("logo_queue_batch_enqueue_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
export function logLogoQueueStats(): void {
  logger.info("logo_queue_enqueue_stats", {
    skipped: skippedCounter,
    dropped: droppedCounter,
  });
}

export { getLogoQueue };
