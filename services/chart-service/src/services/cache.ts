import { env } from "../config/env";
import { isRedisReady, redisClient } from "../config/redis";
import { incrementCounter } from "./metrics";
import { logWarn } from "./logger";

type CacheEnvelope<T> = {
  payload: T;
  createdAt: number;
  staleAt: number;
  expiresAt: number;
};

type CachePolicy = {
  freshTtlSeconds: number;
  staleTtlSeconds: number;
};

const memoryCache = new Map<string, CacheEnvelope<unknown>>();
const refreshInFlight = new Set<string>();

function cleanupMemory() {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (value.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

function resolveTtlPolicy(kind: "live" | "historical"): CachePolicy {
  const fresh = kind === "live" ? env.CHART_CACHE_LIVE_TTL_SECONDS : env.CHART_CACHE_HISTORICAL_TTL_SECONDS;
  const stale = Math.max(1, env.CHART_CACHE_SWR_SECONDS);

  return {
    freshTtlSeconds: Math.max(1, fresh || env.CHART_CACHE_TTL_SECONDS),
    staleTtlSeconds: stale,
  };
}

function isHistoricalRange(to?: string): boolean {
  if (!to) return false;
  const epochMs = Date.parse(to);
  if (!Number.isFinite(epochMs)) return false;
  return epochMs < (Date.now() - 15 * 60 * 1000);
}

export function ttlPolicyFromSource(source?: { to?: string }): CachePolicy {
  return resolveTtlPolicy(isHistoricalRange(source?.to) ? "historical" : "live");
}

async function getCacheEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
  if (isRedisReady()) {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEnvelope<T>;
  }

  cleanupMemory();
  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry as CacheEnvelope<T>;
}

async function setCacheEnvelope<T>(key: string, envelope: CacheEnvelope<T>): Promise<void> {
  const ttlSeconds = Math.max(1, Math.ceil((envelope.expiresAt - Date.now()) / 1000));

  if (isRedisReady()) {
    await redisClient.set(key, JSON.stringify(envelope), "EX", ttlSeconds);
    return;
  }

  memoryCache.set(key, envelope as CacheEnvelope<unknown>);
}

function runRefresh<T>(key: string, policy: CachePolicy, loader: () => Promise<T>): void {
  if (refreshInFlight.has(key)) {
    return;
  }

  refreshInFlight.add(key);
  void loader()
    .then(async (freshPayload) => {
      await setCached(key, freshPayload, policy);
      incrementCounter("cache.refresh.success");
    })
    .catch((error) => {
      incrementCounter("cache.refresh.failure");
      logWarn("cache_refresh_failed", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      refreshInFlight.delete(key);
    });
}

export async function setCached<T>(key: string, payload: T, policy: CachePolicy): Promise<void> {
  const now = Date.now();
  const envelope: CacheEnvelope<T> = {
    payload,
    createdAt: now,
    staleAt: now + policy.freshTtlSeconds * 1000,
    expiresAt: now + (policy.freshTtlSeconds + policy.staleTtlSeconds) * 1000,
  };
  await setCacheEnvelope(key, envelope);
}

export async function getCached<T>(key: string): Promise<T | null> {
  const entry = await getCacheEnvelope<T>(key);
  if (!entry) {
    incrementCounter("cache.miss");
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    incrementCounter("cache.expired");
    return null;
  }

  incrementCounter("cache.hit");
  return entry.payload;
}

export async function getWithStaleWhileRevalidate<T>(
  key: string,
  policy: CachePolicy,
  loader: () => Promise<T>,
): Promise<{ payload: T; cached: boolean; stale: boolean }> {
  const entry = await getCacheEnvelope<T>(key);
  const now = Date.now();

  if (!entry || entry.expiresAt <= now) {
    incrementCounter("cache.miss");
    const payload = await loader();
    await setCached(key, payload, policy);
    return { payload, cached: false, stale: false };
  }

  if (entry.staleAt > now) {
    incrementCounter("cache.hit.fresh");
    return { payload: entry.payload, cached: true, stale: false };
  }

  incrementCounter("cache.hit.stale");
  runRefresh(key, policy, loader);
  return { payload: entry.payload, cached: true, stale: true };
}

export async function invalidateSymbolTimeframeCaches(symbol: string, timeframe: string): Promise<void> {
  const marker = `:${symbol}:${timeframe}:`;

  if (isRedisReady()) {
    let cursor = "0";
    let removed = 0;

    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", "v1:chart:*", "COUNT", 200);
      cursor = nextCursor;
      const targets = keys.filter((key) => key.includes(marker));
      if (targets.length > 0) {
        removed += targets.length;
        await redisClient.del(...targets);
      }
    } while (cursor !== "0");

    if (removed > 0) {
      incrementCounter("cache.invalidate.redis");
    }
    return;
  }

  let removed = 0;
  for (const key of memoryCache.keys()) {
    if (key.includes(marker)) {
      memoryCache.delete(key);
      removed += 1;
    }
  }

  if (removed > 0) {
    incrementCounter("cache.invalidate.memory");
  }
}
