/**
 * screenerCache.service.ts — L1 (memory) + L2 (Redis) on-demand cache.
 *
 * Architecture:
 * - L1 = bounded in-process Map (fast, per-instance accelerator)
 * - L2 = Redis (source of truth, consistent across instances)
 * - NO background precompute loops
 * - All entries are on-demand: cache-aside with fetcher function
 * - Event-driven invalidation via invalidate() / invalidatePattern()
 */
import { redisClient, isRedisReady } from "../config/redis";
import { logger } from "../utils/logger";

/* ── Configuration ─────────────────────────────────────────────────── */

const L1_MAX_ENTRIES = 200;       // bounded memory footprint
const L1_TTL_MS = 30_000;        // 30s L1 (short — L2 is truth)
const L2_TTL_S = 60;             // 60s in Redis
const L2_HOT_TTL_S = 120;        // 120s for hot queries (hit > 2x)

/* ── L1 In-Memory Cache ──────────────────────────────────────────── */

interface L1Entry {
  data: string;
  expiresAt: number;
  hits: number;
}

const l1 = new Map<string, L1Entry>();

function l1Get(key: string): string | null {
  const entry = l1.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    l1.delete(key);
    return null;
  }
  entry.hits++;
  return entry.data;
}

function l1Set(key: string, data: string): void {
  if (l1.size >= L1_MAX_ENTRIES) {
    // Evict lowest-hit entry
    let evictKey = "";
    let minHits = Infinity;
    for (const [k, v] of l1) {
      if (Date.now() > v.expiresAt) { l1.delete(k); continue; }
      if (v.hits < minHits) { minHits = v.hits; evictKey = k; }
    }
    if (evictKey && l1.size >= L1_MAX_ENTRIES) l1.delete(evictKey);
  }
  l1.set(key, { data, expiresAt: Date.now() + L1_TTL_MS, hits: 1 });
}

function l1Del(key: string): void {
  l1.delete(key);
}

/* ── Cache Key Builder ────────────────────────────────────────────── */

export function buildScreenerCacheKey(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== "")
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("&");
  return `sc:${sorted}`;
}

/* ── Core: getCached with fetcher (cache-aside) ──────────────────── */

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  // L1 hit
  const mem = l1Get(key);
  if (mem) return JSON.parse(mem) as T;

  // L2 hit (Redis = source of truth)
  if (isRedisReady()) {
    try {
      const redisData = await redisClient.get(key);
      if (redisData) {
        l1Set(key, redisData);
        return JSON.parse(redisData) as T;
      }
    } catch { /* miss — compute below */ }
  }

  // Cache miss — compute via fetcher
  const result = await fetcher();
  const json = JSON.stringify(result);

  // Write-through: L2 first (truth), then L1
  if (isRedisReady()) {
    redisClient.set(key, json, "EX", L2_TTL_S).catch(() => {});
  }
  l1Set(key, json);

  return result;
}

/**
 * getCachedRaw — same as getCached but returns the raw JSON string.
 * Avoids double-serialize for endpoints that send JSON directly.
 */
export async function getCachedRaw(
  key: string,
  fetcher: () => Promise<string>,
): Promise<string> {
  // L1 hit
  const mem = l1Get(key);
  if (mem) return mem;

  // L2 hit
  if (isRedisReady()) {
    try {
      const redisData = await redisClient.get(key);
      if (redisData) {
        l1Set(key, redisData);
        return redisData;
      }
    } catch { /* miss */ }
  }

  // Compute
  const json = await fetcher();

  if (isRedisReady()) {
    redisClient.set(key, json, "EX", L2_TTL_S).catch(() => {});
  }
  l1Set(key, json);

  return json;
}

/* ── Invalidation (event-driven) ─────────────────────────────────── */

export function invalidate(key: string): void {
  l1Del(key);
  if (isRedisReady()) {
    redisClient.del(key).catch(() => {});
  }
}

export async function invalidatePattern(pattern: string): Promise<number> {
  let deleted = 0;

  // L1: scan and delete matching keys
  for (const key of l1.keys()) {
    if (key.includes(pattern)) {
      l1.delete(key);
      deleted++;
    }
  }

  // L2: use SCAN (safe for production, no KEYS *)
  if (isRedisReady()) {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redisClient.scan(
          cursor, "MATCH", `*${pattern}*`, "COUNT", 100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          const pipeline = redisClient.pipeline();
          for (const k of keys) pipeline.del(k);
          await pipeline.exec();
          deleted += keys.length;
        }
      } while (cursor !== "0");
    } catch (err) {
      logger.warn("cache_invalidate_pattern_error", {
        pattern,
        error: (err as Error).message,
      });
    }
  }

  return deleted;
}

/* ── Stats ────────────────────────────────────────────────────────── */

export function getCacheStats(): {
  l1Size: number;
  l1MaxEntries: number;
  l1TtlMs: number;
  l2TtlS: number;
} {
  return {
    l1Size: l1.size,
    l1MaxEntries: L1_MAX_ENTRIES,
    l1TtlMs: L1_TTL_MS,
    l2TtlS: L2_TTL_S,
  };
}