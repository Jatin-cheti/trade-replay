import { CleanAssetModel } from "../models/CleanAsset.js";
import { getRedis } from "../config/redis.js";

const CACHE_TTL_S = 30;

interface SearchParams {
  query: string;
  type?: string;
  country?: string;
  limit: number;
  offset: number;
}

interface SearchResult {
  items: Record<string, unknown>[];
  total: number;
  hasMore: boolean;
}

export async function searchSymbols(params: SearchParams): Promise<SearchResult> {
  const { query, type, country, limit, offset } = params;

  const cacheKey = `asset:search:${query}:${type || ""}:${country || ""}:${limit}:${offset}`;
  const redis = getRedis();

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as SearchResult;
  } catch {}

  const filter: Record<string, unknown> = { isActive: true };
  if (type) filter.type = type;
  if (country) filter.country = country.toUpperCase();

  if (query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { symbol: { $regex: `^${escaped}`, $options: "i" } },
      { name: { $regex: escaped, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    CleanAssetModel.find(filter)
      .sort({ priorityScore: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    CleanAssetModel.countDocuments(filter),
  ]);

  const result: SearchResult = {
    items: items as Record<string, unknown>[],
    total,
    hasMore: offset + limit < total,
  };

  try {
    await redis.setex(cacheKey, CACHE_TTL_S, JSON.stringify(result));
  } catch {}

  return result;
}

export async function getSymbolByTicker(
  ticker: string,
): Promise<Record<string, unknown> | null> {
  return CleanAssetModel.findOne({
    symbol: ticker.toUpperCase(),
  })
    .lean() as Promise<Record<string, unknown> | null>;
}
