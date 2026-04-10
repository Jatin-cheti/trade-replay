import { Queue } from "bullmq";
import { isRedisReady, redisClient } from "../config/redis";
import { redisConnectionOptions } from "../config/redis";
import { logger } from "../utils/logger";
import { clusterScopedKey } from "./redisKey.service";

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
  missingIconCount?: number;
  createdAt: number;
};

type QueueSymbolInput = Omit<QueueSymbol, "createdAt"> & { createdAt?: number };

const LOGO_QUEUE_NAME = "logo-enrichment";
const LOGO_QUEUE_JOB = "symbol-logo-enrichment";
const MAX_QUEUE_SIZE = 2000;
const BACKPRESSURE_QUEUE_THRESHOLD = 1000;
const MAX_ENQUEUE_PER_MINUTE = 500;
const ENQUEUE_DEDUPE_TTL_SECONDS = 10 * 60;

let queue: Queue<QueueSymbol> | null = null;
let currentEnqueueMinute = 0;
let jobsCreatedThisMinute = 0;
let skippedCounter = 0;
let droppedCounter = 0;

async function shouldEnqueueByDedupeWindow(fullSymbol: string): Promise<boolean> {
  if (!isRedisReady()) return true;

  try {
    const dedupeKey = clusterScopedKey("app:dedupe:logo", fullSymbol);
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
  return Math.max(1, (symbol.missingIconCount ?? 0) + (symbol.searchFrequency ?? 0));
}

function safeJobId(fullSymbol: string): string {
  return fullSymbol.replace(/[^a-zA-Z0-9._-]/g, "-");
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
    jobId: safeJobId(normalized.fullSymbol),
    priority: priorityOf(normalized),
  });

  logger.info("logo_queue_enqueued", {
    fullSymbol: normalized.fullSymbol,
    queueSize: total + 1,
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
  void (async () => {
    const queueRef = getLogoQueue();
    const now = Date.now();
    const unresolved = symbols
      .filter((symbol) => !hasExistingIcon(symbol))
      .map((symbol) => ({
        ...symbol,
        symbol: symbol.symbol.toUpperCase(),
        fullSymbol: symbol.fullSymbol.toUpperCase(),
        exchange: symbol.exchange.toUpperCase(),
        createdAt: symbol.createdAt || now,
      }));

    if (unresolved.length === 0) {
      return;
    }

    const [waiting, active, delayed] = await Promise.all([
      queueRef.getWaitingCount(),
      queueRef.getActiveCount(),
      queueRef.getDelayedCount(),
    ]);
    const currentDepth = waiting + active + delayed;
    const capacity = Math.max(0, MAX_QUEUE_SIZE - currentDepth);

    if (capacity === 0) {
      droppedCounter += unresolved.length;
      logger.warn("logo_queue_full_drop", { queueSize: currentDepth, maxQueueSize: MAX_QUEUE_SIZE });
      return;
    }

    const candidates = unresolved.slice(0, capacity);
    const deduped: QueueSymbol[] = [];
    for (const symbol of candidates) {
      const shouldEnqueue = await shouldEnqueueByDedupeWindow(symbol.fullSymbol);
      if (!shouldEnqueue) {
        skippedCounter += 1;
        continue;
      }
      if (!canEnqueueNow()) {
        droppedCounter += 1;
        continue;
      }
      deduped.push(symbol);
    }

    if (deduped.length === 0) {
      return;
    }

    const missingIconCount = deduped.length;
    await queueRef.addBulk(
      deduped.map((symbol) => ({
        name: LOGO_QUEUE_JOB,
        data: {
          ...symbol,
          missingIconCount,
        },
        opts: {
          jobId: safeJobId(symbol.fullSymbol),
          priority: priorityOf({ ...symbol, missingIconCount }),
        },
      })),
    );

    logger.info("logo_queue_batch_enqueued", {
      enqueued: deduped.length,
      unresolvedCandidates: unresolved.length,
      queueSize: currentDepth + deduped.length,
      missingIconCount,
    });
  })().catch((error) => {
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
