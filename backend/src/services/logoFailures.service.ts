/**
 * logoFailures.service.ts — Track and reprocess logo resolution failures via Redis.
 */
import { redisClient, isRedisReady } from "../config/redis";
import { logger } from "../utils/logger";

const MISSING_SET = "logo:missing";
const MISSING_HASH_PREFIX = "logo:missing:";

/** Record a logo failure for tracking */
export async function trackLogoFailure(symbol: string, meta: { name?: string; exchange?: string; type?: string; tier?: number }): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await redisClient.sadd(MISSING_SET, symbol);
    await redisClient.hset(`${MISSING_HASH_PREFIX}${symbol}`, {
      name: meta.name || "",
      exchange: meta.exchange || "",
      type: meta.type || "",
      tier: String(meta.tier ?? 5),
      ts: new Date().toISOString(),
    });
  } catch { /* best-effort */ }
}

/** Remove a symbol from failures (it was resolved) */
export async function clearLogoFailure(symbol: string): Promise<void> {
  if (!isRedisReady()) return;
  try {
    await redisClient.srem(MISSING_SET, symbol);
    await redisClient.del(`${MISSING_HASH_PREFIX}${symbol}`);
  } catch { /* best-effort */ }
}

/** Get all symbols still missing logos */
export async function getMissingLogos(): Promise<string[]> {
  if (!isRedisReady()) return [];
  try {
    return await redisClient.smembers(MISSING_SET);
  } catch { return []; }
}

/** Get count of missing */
export async function getMissingCount(): Promise<number> {
  if (!isRedisReady()) return 0;
  try {
    return await redisClient.scard(MISSING_SET);
  } catch { return 0; }
}

/** Get details for a missing symbol */
export async function getMissingDetail(symbol: string): Promise<Record<string, string> | null> {
  if (!isRedisReady()) return null;
  try {
    const data = await redisClient.hgetall(`${MISSING_HASH_PREFIX}${symbol}`);
    return data && Object.keys(data).length > 0 ? data : null;
  } catch { return null; }
}

/** Clear all tracking data */
export async function clearAllFailures(): Promise<number> {
  if (!isRedisReady()) return 0;
  try {
    const members = await redisClient.smembers(MISSING_SET);
    if (members.length > 0) {
      const pipeline = redisClient.pipeline();
      for (const sym of members) pipeline.del(`${MISSING_HASH_PREFIX}${sym}`);
      pipeline.del(MISSING_SET);
      await pipeline.exec();
    }
    return members.length;
  } catch { return 0; }
}
