/**
 * filterCache.service.ts — On-demand filter index with L1+L2 cache.
 *
 * No periodic refresh timer. Built on first request, cached in Redis.
 * Invalidated when assets are added/updated/removed.
 */
import { CleanAssetModel } from "../models/CleanAsset";
import { redisClient, isRedisReady } from "../config/redis";
import { logger } from "../utils/logger";

/* ── Types ─────────────────────────────────────────────────────────── */

interface FilterIndex {
  total: number;
  byType: Record<string, number>;
  byCountry: Record<string, number>;
  byExchange: Record<string, number>;
  bySector: Record<string, number>;
  exchanges: string[];
  countries: string[];
  sectors: string[];
  builtAt: number;
}

/* ── State ─────────────────────────────────────────────────────────── */

let cached: FilterIndex | null = null;
const REDIS_KEY = "screener:filter_index";
const REDIS_TTL_S = 300; // 5 min in Redis

/* ── Build ────────────────────────────────────────────────────────── */

async function buildFilterIndex(): Promise<FilterIndex> {
  const startMs = Date.now();

  const [typeAgg, countryAgg, exchangeAgg, sectorAgg] = await Promise.all([
    CleanAssetModel.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
    CleanAssetModel.aggregate([{ $group: { _id: "$country", count: { $sum: 1 } } }]),
    CleanAssetModel.aggregate([{ $group: { _id: "$exchange", count: { $sum: 1 } } }]),
    CleanAssetModel.aggregate([
      { $match: { sector: { $nin: [null, ""] } } },
      { $group: { _id: "$sector", count: { $sum: 1 } } },
    ]),
  ]);

  const byType: Record<string, number> = {};
  let total = 0;
  for (const r of typeAgg) { byType[r._id] = r.count; total += r.count; }

  const byCountry: Record<string, number> = {};
  for (const r of countryAgg) { if (r._id) byCountry[r._id] = r.count; }

  const byExchange: Record<string, number> = {};
  for (const r of exchangeAgg) { if (r._id) byExchange[r._id] = r.count; }

  const bySector: Record<string, number> = {};
  for (const r of sectorAgg) { if (r._id) bySector[r._id] = r.count; }

  const index: FilterIndex = {
    total, byType, byCountry, byExchange, bySector,
    exchanges: Object.keys(byExchange).sort(),
    countries: Object.keys(byCountry).sort(),
    sectors: Object.keys(bySector).sort(),
    builtAt: Date.now(),
  };

  logger.info("filter_index_built", {
    total,
    types: Object.keys(byType).length,
    exchanges: index.exchanges.length,
    countries: index.countries.length,
    sectors: index.sectors.length,
    durationMs: Date.now() - startMs,
  });

  return index;
}

/* ── Public API ───────────────────────────────────────────────────── */

export async function initFilterCache(): Promise<void> {
  cached = await buildFilterIndex();
  if (isRedisReady()) {
    redisClient.set(REDIS_KEY, JSON.stringify(cached), "EX", REDIS_TTL_S).catch(() => {});
  }
}

export async function getFilterIndex(): Promise<FilterIndex> {
  // L1
  if (cached) return cached;

  // L2
  if (isRedisReady()) {
    try {
      const raw = await redisClient.get(REDIS_KEY);
      if (raw) { cached = JSON.parse(raw); return cached!; }
    } catch { /* miss */ }
  }

  // Compute on demand
  cached = await buildFilterIndex();
  if (isRedisReady()) {
    redisClient.set(REDIS_KEY, JSON.stringify(cached), "EX", REDIS_TTL_S).catch(() => {});
  }
  return cached;
}

/** Event-driven invalidation — call when assets change */
export function invalidateFilterCache(): void {
  cached = null;
  if (isRedisReady()) {
    redisClient.del(REDIS_KEY).catch(() => {});
  }
}

export function getFilterStats() {
  return { hasCached: cached !== null, builtAt: cached?.builtAt || 0 };
}