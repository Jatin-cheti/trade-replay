/**
 * Redis Shard Service — consistent hash-based sharding for millions of symbols.
 *
 * Provides O(1) reads/writes per symbol with deterministic shard placement.
 * Uses MurmurHash3-style hash for uniform distribution across N shards.
 */

import { redisClient, isRedisReady } from "../config/redis";
import { logger } from "../utils/logger";

// ── Config ───────────────────────────────────────────────────────────────

const DEFAULT_SHARD_COUNT = 16;
const MAX_SHARD_COUNT = 256;

let shardCount = DEFAULT_SHARD_COUNT;

export function setShardCount(n: number): void {
  shardCount = Math.max(1, Math.min(n, MAX_SHARD_COUNT));
}

export function getShardCount(): number {
  return shardCount;
}

// ── FNV-1a hash (fast, deterministic, good distribution) ─────────────────

function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0; // FNV prime, unsigned
  }
  return hash;
}

// ── Shard assignment ─────────────────────────────────────────────────────

export function getShardIndex(symbol: string): number {
  return fnv1aHash(symbol.toUpperCase()) % shardCount;
}

export function getShardKey(namespace: string, symbol: string): string {
  const shard = getShardIndex(symbol);
  return `${namespace}:shard:${shard}`;
}

// ── Sharded get/set ──────────────────────────────────────────────────────

export async function shardedGet(namespace: string, symbol: string): Promise<string | null> {
  if (!isRedisReady()) return null;

  const key = getShardKey(namespace, symbol);
  const field = symbol.toUpperCase();

  try {
    return await redisClient.hget(key, field);
  } catch {
    return null;
  }
}

export async function shardedSet(
  namespace: string,
  symbol: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> {
  if (!isRedisReady()) return;

  const key = getShardKey(namespace, symbol);
  const field = symbol.toUpperCase();

  try {
    await redisClient.hset(key, field, value);
    if (ttlSeconds) {
      // Set TTL on the shard hash (affects all keys in the shard)
      // Use EXPIRE only if not already set to avoid resetting TTL
      const currentTtl = await redisClient.ttl(key);
      if (currentTtl < 0) {
        await redisClient.expire(key, ttlSeconds);
      }
    }
  } catch {
    // Best-effort
  }
}

export async function shardedDel(namespace: string, symbol: string): Promise<void> {
  if (!isRedisReady()) return;

  const key = getShardKey(namespace, symbol);
  const field = symbol.toUpperCase();

  try {
    await redisClient.hdel(key, field);
  } catch {
    // Best-effort
  }
}

// ── Batch operations ─────────────────────────────────────────────────────

export async function shardedMGet(
  namespace: string,
  symbols: string[],
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (!isRedisReady() || symbols.length === 0) return result;

  // Group by shard for pipeline efficiency
  const shardGroups = new Map<string, string[]>();
  for (const symbol of symbols) {
    const key = getShardKey(namespace, symbol);
    const group = shardGroups.get(key) || [];
    group.push(symbol.toUpperCase());
    shardGroups.set(key, group);
  }

  try {
    const pipeline = redisClient.pipeline();
    const shardEntries = Array.from(shardGroups.entries());

    for (const [shardKey, fields] of shardEntries) {
      pipeline.hmget(shardKey, ...fields);
    }

    const responses = await pipeline.exec();
    if (!responses) return result;

    let responseIdx = 0;
    for (const [, fields] of shardEntries) {
      const [err, values] = responses[responseIdx] || [null, null];
      if (!err && Array.isArray(values)) {
        for (let i = 0; i < fields.length; i++) {
          result.set(fields[i], (values[i] as string) || null);
        }
      }
      responseIdx++;
    }
  } catch {
    // Best-effort, return what we have
  }

  return result;
}

export async function shardedMSet(
  namespace: string,
  entries: Array<{ symbol: string; value: string }>,
  ttlSeconds?: number,
): Promise<number> {
  if (!isRedisReady() || entries.length === 0) return 0;

  // Group by shard
  const shardGroups = new Map<string, Array<[string, string]>>();
  for (const entry of entries) {
    const key = getShardKey(namespace, entry.symbol);
    const group = shardGroups.get(key) || [];
    group.push([entry.symbol.toUpperCase(), entry.value]);
    shardGroups.set(key, group);
  }

  let written = 0;

  try {
    const pipeline = redisClient.pipeline();

    for (const [shardKey, fields] of shardGroups.entries()) {
      const args: string[] = [];
      for (const [field, value] of fields) {
        args.push(field, value);
      }
      pipeline.hmset(shardKey, ...args);
      if (ttlSeconds) {
        pipeline.expire(shardKey, ttlSeconds);
      }
      written += fields.length;
    }

    await pipeline.exec();
  } catch {
    // Best-effort
  }

  return written;
}

// ── Shard stats ──────────────────────────────────────────────────────────

export interface ShardStats {
  totalShards: number;
  shardSizes: Array<{ shard: number; size: number }>;
  totalKeys: number;
  avgKeysPerShard: number;
  maxKeysInShard: number;
  minKeysInShard: number;
}

export async function getShardStats(namespace: string): Promise<ShardStats> {
  const sizes: Array<{ shard: number; size: number }> = [];

  if (!isRedisReady()) {
    return {
      totalShards: shardCount,
      shardSizes: [],
      totalKeys: 0,
      avgKeysPerShard: 0,
      maxKeysInShard: 0,
      minKeysInShard: 0,
    };
  }

  try {
    const pipeline = redisClient.pipeline();
    for (let i = 0; i < shardCount; i++) {
      pipeline.hlen(`${namespace}:shard:${i}`);
    }

    const responses = await pipeline.exec();
    if (responses) {
      for (let i = 0; i < responses.length; i++) {
        const [err, val] = responses[i] || [null, 0];
        sizes.push({ shard: i, size: err ? 0 : Number(val) });
      }
    }
  } catch {
    // Return empty stats
  }

  const totalKeys = sizes.reduce((sum, s) => sum + s.size, 0);
  const maxKeysInShard = Math.max(0, ...sizes.map((s) => s.size));
  const minKeysInShard = sizes.length > 0 ? Math.min(...sizes.map((s) => s.size)) : 0;

  return {
    totalShards: shardCount,
    shardSizes: sizes,
    totalKeys,
    avgKeysPerShard: shardCount > 0 ? totalKeys / shardCount : 0,
    maxKeysInShard,
    minKeysInShard,
  };
}
