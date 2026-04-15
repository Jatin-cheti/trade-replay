import { createConsumer, MessageHandler } from "../consumer";
import { KAFKA_TOPICS, KafkaEvent, MarketTickPayload } from "../topics";
import { isHotSymbol, updatePriceFromTick } from "../../services/priceCache.service";
import { recordKafkaLag } from "../../services/metrics.service";
import { logger } from "../../utils/logger";

const MARKET_TICK_MAX_BATCH = Number(process.env.MARKET_TICK_MAX_BATCH || 1500);
const MARKET_TICK_MAX_BATCH_TIME_MS = Number(process.env.MARKET_TICK_MAX_BATCH_TIME_MS || 45);
const MARKET_TICK_DEGRADED_LAG_MS = Number(process.env.MARKET_TICK_DEGRADED_LAG_MS || 6000);
const MARKET_TICK_DEFER_LAG_MS = Number(process.env.MARKET_TICK_DEFER_LAG_MS || 15000);
const LOW_PRIORITY_FLUSH_INTERVAL_MS = Number(process.env.LOW_PRIORITY_FLUSH_INTERVAL_MS || 500);
const LOW_PRIORITY_MAX_QUEUE = Number(process.env.LOW_PRIORITY_MAX_QUEUE || 5000);
const LOW_PRIORITY_BATCH_SIZE = Number(process.env.LOW_PRIORITY_BATCH_SIZE || 50);

// ── Dual-priority queue: hot symbols processed immediately, others deferred ──

type DeferredTick = {
  symbol: string;
  price: number;
  timestamp: number;
};

const lowPriorityQueue: DeferredTick[] = [];
let lowPriorityFlushTimer: NodeJS.Timeout | null = null;

async function flushLowPriorityBatch(): Promise<void> {
  if (lowPriorityQueue.length === 0) return;

  const batch = lowPriorityQueue.splice(0, LOW_PRIORITY_BATCH_SIZE);

  for (const tick of batch) {
    try {
      await updatePriceFromTick({
        symbol: tick.symbol,
        price: tick.price,
        timestamp: tick.timestamp,
      });
    } catch (error) {
      logger.warn("low_priority_tick_process_error", {
        symbol: tick.symbol,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (batch.length > 0) {
    logger.info("low_priority_tick_batch_flushed", {
      processed: batch.length,
      remaining: lowPriorityQueue.length,
    });
  }
}

function enqueueLowPriority(tick: DeferredTick): void {
  // If queue is full, evict oldest entries (coalesce — keep latest per symbol)
  if (lowPriorityQueue.length >= LOW_PRIORITY_MAX_QUEUE) {
    // Deduplicate: keep only the latest tick per symbol
    const seen = new Map<string, number>();
    for (let i = lowPriorityQueue.length - 1; i >= 0; i--) {
      const entry = lowPriorityQueue[i]!;
      if (!seen.has(entry.symbol)) {
        seen.set(entry.symbol, i);
      }
    }
    const dedupedIndices = new Set(seen.values());
    const deduped: DeferredTick[] = [];
    for (let i = 0; i < lowPriorityQueue.length; i++) {
      if (dedupedIndices.has(i)) {
        deduped.push(lowPriorityQueue[i]!);
      }
    }
    lowPriorityQueue.length = 0;
    lowPriorityQueue.push(...deduped);

    logger.warn("low_priority_queue_coalesced", {
      before: deduped.length + (lowPriorityQueue.length - deduped.length),
      after: lowPriorityQueue.length,
    });
  }

  lowPriorityQueue.push(tick);
}

const handleMarketTick: MessageHandler = async (event: KafkaEvent) => {
  const payload = event.payload as MarketTickPayload;
  if (!payload.symbol || typeof payload.price !== "number") {
    logger.warn("market_price_tick_invalid_payload", { eventId: event.eventId });
    return;
  }

  const eventTimestampMs = typeof payload.timestamp === "number"
    ? payload.timestamp
    : (typeof event.timestamp === "number" ? event.timestamp : Date.now());
  const lagMs = Math.max(0, Date.now() - eventTimestampMs);
  recordKafkaLag(lagMs);

  // Under high lag, defer non-hot symbols to low-priority queue (NO drop)
  if (lagMs >= MARKET_TICK_DEFER_LAG_MS && !isHotSymbol(payload.symbol)) {
    enqueueLowPriority({
      symbol: payload.symbol,
      price: payload.price,
      timestamp: payload.timestamp || eventTimestampMs,
    });
    return;
  }

  if (lagMs >= MARKET_TICK_DEGRADED_LAG_MS) {
    logger.warn("market_price_tick_consumer_degraded_lag", {
      lagMs,
      degradedLagMs: MARKET_TICK_DEGRADED_LAG_MS,
      symbol: payload.symbol,
    });
  }

  await updatePriceFromTick({
    symbol: payload.symbol,
    price: payload.price,
    timestamp: payload.timestamp || event.timestamp,
  });
};

export async function startMarketPriceCacheProcessor(): Promise<void> {
  await createConsumer({
    groupId: "tradereplay-market-price-cache",
    topics: [KAFKA_TOPICS.MARKET_TICK],
    handler: handleMarketTick,
    maxBatchSize: Number.isFinite(MARKET_TICK_MAX_BATCH) ? MARKET_TICK_MAX_BATCH : 1500,
    maxProcessingTimeMs: Number.isFinite(MARKET_TICK_MAX_BATCH_TIME_MS) ? MARKET_TICK_MAX_BATCH_TIME_MS : 45,
  });

  // Start low-priority flush loop (eventual consistency, no data loss)
  if (!lowPriorityFlushTimer) {
    lowPriorityFlushTimer = setInterval(() => {
      void flushLowPriorityBatch();
    }, LOW_PRIORITY_FLUSH_INTERVAL_MS);
    lowPriorityFlushTimer.unref();
  }

  logger.info("kafka_market_price_cache_processor_started", {
    deferLagMs: MARKET_TICK_DEFER_LAG_MS,
    lowPriorityMaxQueue: LOW_PRIORITY_MAX_QUEUE,
    lowPriorityBatchSize: LOW_PRIORITY_BATCH_SIZE,
    lowPriorityFlushIntervalMs: LOW_PRIORITY_FLUSH_INTERVAL_MS,
  });
}