import { createHash } from "node:crypto";
import { env } from "../config/env";
import { isRedisReady, redisClient } from "../config/redis";

const memoryCache = new Map<string, { expiresAt: number; payload: unknown }>();

function cleanupMemory() {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (value.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

export function cacheKey(prefix: string, payload: unknown): string {
  const hash = createHash("sha1").update(JSON.stringify(payload)).digest("hex");
  return `chart-service:${prefix}:${hash}`;
}

export async function getCached<T>(key: string): Promise<T | null> {
  if (isRedisReady()) {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  cleanupMemory();
  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.payload as T;
}

export async function setCached<T>(key: string, payload: T): Promise<void> {
  if (isRedisReady()) {
    await redisClient.set(key, JSON.stringify(payload), "EX", Math.max(1, env.CHART_CACHE_TTL_SECONDS));
    return;
  }

  memoryCache.set(key, {
    expiresAt: Date.now() + Math.max(1, env.CHART_CACHE_TTL_SECONDS) * 1000,
    payload,
  });
}
