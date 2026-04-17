/**
 * cacheInvalidation.service.ts — Central event-driven cache invalidation.
 *
 * Single point of coordination:
 * - When prices update → invalidate affected screener cache keys
 * - When assets change → update trie + invalidate symbol cache + filter cache
 * - Uses Redis pub/sub for multi-instance consistency
 */
import { redisClient, isRedisReady, redisPublisher, redisSubscriber } from "../config/redis";
import { invalidate, invalidatePattern } from "./screenerCache.service";
import { upsertAsset, removeAsset } from "./trieSearch.service";
import { invalidateFilterCache } from "./filterCache.service";
import { logger } from "../utils/logger";

const CHANNEL = "cache:invalidate";

interface InvalidationEvent {
  type: "price_update" | "asset_upsert" | "asset_remove" | "bulk_update";
  symbols?: string[];
  asset?: any;
  fullSymbol?: string;
  symbol?: string;
  name?: string;
}

/* ── Local dispatch ──────────────────────────────────────────────── */

function handleEvent(event: InvalidationEvent): void {
  switch (event.type) {
    case "price_update":
      // Price changes: invalidate screener pages that contain these symbols.
      // Since we can't track which keys contain which symbols efficiently,
      // we invalidate all screener list caches (they have short TTL anyway).
      // This is cheap because L1 is small and L2 uses SCAN.
      if (event.symbols && event.symbols.length > 0) {
        // Invalidate per-symbol aggregation cache
        for (const sym of event.symbols) {
          invalidate(`agg:${sym}`);
        }
      }
      break;

    case "asset_upsert":
      if (event.asset) {
        upsertAsset(event.asset);
        if (event.asset.fullSymbol) {
          invalidate(`agg:${event.asset.fullSymbol}`);
        }
        invalidateFilterCache();
      }
      break;

    case "asset_remove":
      if (event.fullSymbol && event.symbol) {
        removeAsset(event.fullSymbol, event.symbol, event.name);
        invalidate(`agg:${event.fullSymbol}`);
        invalidateFilterCache();
      }
      break;

    case "bulk_update":
      // Nuclear option: clear all screener caches
      void invalidatePattern("sc:");
      invalidateFilterCache();
      break;
  }
}

/* ── Public API ───────────────────────────────────────────────────── */

export function emitInvalidation(event: InvalidationEvent): void {
  // Handle locally
  handleEvent(event);

  // Broadcast to other instances via Redis pub/sub
  if (isRedisReady()) {
    redisPublisher.publish(CHANNEL, JSON.stringify(event)).catch(() => {});
  }
}

/** Call on price batch updates */
export function onPriceUpdate(symbols: string[]): void {
  if (symbols.length === 0) return;
  emitInvalidation({ type: "price_update", symbols });
}

/** Call when an asset is created or updated */
export function onAssetUpsert(asset: any): void {
  emitInvalidation({ type: "asset_upsert", asset });
}

/** Call when an asset is removed */
export function onAssetRemove(fullSymbol: string, symbol: string, name?: string): void {
  emitInvalidation({ type: "asset_remove", fullSymbol, symbol, name });
}

/** Call after bulk imports/updates */
export function onBulkUpdate(): void {
  emitInvalidation({ type: "bulk_update" });
}

/** Invalidate all caches for a specific symbol (used by logo/scraper/simulation services) */
export async function invalidateSymbolCaches(fullSymbol: string): Promise<void> {
  invalidate(`agg:${fullSymbol}`);
  void invalidatePattern(`sc:`);
}

/* ── Multi-instance subscription ─────────────────────────────────── */

let subscribed = false;

export async function startInvalidationListener(): Promise<void> {
  if (subscribed || !isRedisReady()) return;

  try {
    await redisSubscriber.subscribe(CHANNEL);
    redisSubscriber.on("message", (ch: string, msg: string) => {
      if (ch !== CHANNEL) return;
      try {
        const event = JSON.parse(msg) as InvalidationEvent;
        handleEvent(event);
      } catch { /* ignore corrupt messages */ }
    });
    subscribed = true;
    logger.info("cache_invalidation_listener_started");
  } catch (err) {
    logger.warn("cache_invalidation_listener_error", { error: (err as Error).message });
  }
}