import { isRedisReady, redisClient } from "../config/redis";
import { logger } from "../utils/logger";
import { invalidateL1CacheByPattern } from "./cache.service";

async function deleteByPattern(pattern: string): Promise<number> {
  if (!isRedisReady()) return 0;

  let cursor = "0";
  let deleted = 0;

  do {
    const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", pattern, "COUNT", 200);
    cursor = nextCursor;

    if (keys.length) {
      deleted += await redisClient.del(...keys);
    }
  } while (cursor !== "0");

  return deleted;
}

export async function invalidateSymbolCaches(symbolId: string): Promise<void> {
  if (!isRedisReady()) return;

  const normalized = symbolId.toUpperCase();
  const l1ById = invalidateL1CacheByPattern(`app:symbol:${normalized}`)
    + invalidateL1CacheByPattern(`symbols:${normalized}`)
    + invalidateL1CacheByPattern(`symbol:${normalized}`);
  const l1Search = invalidateL1CacheByPattern("app:symbols:search:*")
    + invalidateL1CacheByPattern("symbols:search:*")
    + invalidateL1CacheByPattern("symbol:*")
    + invalidateL1CacheByPattern("search:*")
    + invalidateL1CacheByPattern("search-candidates:*");

  const deletedById = await redisClient.del(`app:symbol:${normalized}`, `symbols:${normalized}`, `symbol:${normalized}`);
  const deletedSearch = await deleteByPattern("app:symbols:search:*");
  const deletedLegacySearch = (await deleteByPattern("symbols:search:*"))
    + (await deleteByPattern("symbol:*"))
    + (await deleteByPattern("search:*"))
    + (await deleteByPattern("search-candidates:*"));

  logger.info("cache_invalidate_symbol", {
    symbolId: normalized,
    deletedById,
    deletedSearch,
    deletedLegacySearch,
    l1ById,
    l1Search,
  });
}

export async function invalidatePortfolioCache(userId: string): Promise<void> {
  if (!isRedisReady()) return;

  const l1Deleted = invalidateL1CacheByPattern(`app:portfolio:${userId}`)
    + invalidateL1CacheByPattern(`portfolio:${userId}`)
    + invalidateL1CacheByPattern(`user:${userId}:portfolio`);
  const deleted = await redisClient.del(`app:portfolio:${userId}`, `portfolio:${userId}`, `user:${userId}:portfolio`);
  logger.info("cache_invalidate_portfolio", { userId, deleted, l1Deleted });
}
