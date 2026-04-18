import { env } from "../config/env";
import { getRedisClient } from "../config/redis";

const memory = new Map<string, { value: unknown; expiresAt: number }>();

function now(): number {
  return Date.now();
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    const item = memory.get(key);
    if (!item || item.expiresAt < now()) {
      memory.delete(key);
      return null;
    }
    return item.value as T;
  }
}

export async function setCache<T>(key: string, value: T, ttlSeconds = env.CACHE_TTL_SECONDS): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    memory.set(key, { value, expiresAt: now() + (ttlSeconds * 1000) });
  }
}

export async function withCache<T>(key: string, producer: () => Promise<T>, ttlSeconds = env.CACHE_TTL_SECONDS): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }
  const fresh = await producer();
  await setCache(key, fresh, ttlSeconds);
  return fresh;
}
