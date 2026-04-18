import { CleanAssetModel } from "../models/CleanAsset.js";
import { getRedis } from "../config/redis.js";

const CACHE_TTL_S = 8;

interface ListParams {
  type: string;
  query?: string;
  countries: string[];
  exchanges: string[];
  sectors: string[];
  primaryOnly: boolean;
  marketCapMin?: number;
  marketCapMax?: number;
  sort: string;
  order: "asc" | "desc";
  limit: number;
  offset: number;
}

export async function listScreenerAssets(params: ListParams) {
  const cacheKey = `scr:list:${JSON.stringify(params)}`;
  const redis = getRedis();

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const typeMap: Record<string, string[]> = {
    stocks: ["stock"], etfs: ["etf"], "crypto-coins": ["crypto"],
    forex: ["forex"], indices: ["index"], futures: ["derivative"],
    bonds: ["bond"], options: ["option"],
  };

  const filter: Record<string, unknown> = { isActive: true };
  const assetTypes = typeMap[params.type] || ["stock"];
  filter.type = assetTypes.length === 1 ? assetTypes[0] : { $in: assetTypes };

  if (params.countries.length) filter.country = { $in: params.countries.map((c) => c.toUpperCase()) };
  if (params.exchanges.length) filter.exchange = { $in: params.exchanges.map((e) => e.toUpperCase()) };
  if (params.sectors.length) filter.sector = { $in: params.sectors };
  if (params.primaryOnly) filter.isPrimaryListing = true;
  if (params.marketCapMin || params.marketCapMax) {
    const mc: Record<string, number> = {};
    if (params.marketCapMin) mc.$gte = params.marketCapMin;
    if (params.marketCapMax) mc.$lte = params.marketCapMax;
    filter.marketCap = mc;
  }

  if (params.query) {
    const escaped = params.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { symbol: { $regex: `^${escaped}`, $options: "i" } },
      { name: { $regex: escaped, $options: "i" } },
    ];
  }

  const sortObj: Record<string, 1 | -1> = { [params.sort]: params.order === "asc" ? 1 : -1 };

  const [items, total] = await Promise.all([
    CleanAssetModel.find(filter).sort(sortObj).skip(params.offset).limit(params.limit).lean(),
    CleanAssetModel.countDocuments(filter),
  ]);

  const result = { items, total, limit: params.limit, offset: params.offset, hasMore: params.offset + params.limit < total };

  try { await redis.setex(cacheKey, CACHE_TTL_S, JSON.stringify(result)); } catch {}

  return result;
}

export async function getScreenerStats() {
  const [total, typeAgg, countryAgg, sectorAgg, exchangeAgg] = await Promise.all([
    CleanAssetModel.estimatedDocumentCount(),
    CleanAssetModel.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
    CleanAssetModel.aggregate([{ $group: { _id: "$country", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 50 }]),
    CleanAssetModel.aggregate([{ $match: { sector: { $ne: "" } } }, { $group: { _id: "$sector", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    CleanAssetModel.aggregate([{ $group: { _id: "$exchange", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 50 }]),
  ]);

  const toMap = (agg: { _id: string; count: number }[]) => agg.reduce((m, r) => ({ ...m, [r._id]: r.count }), {} as Record<string, number>);

  return {
    total,
    byType: toMap(typeAgg),
    countries: countryAgg.map((r) => r._id as string),
    exchanges: exchangeAgg.map((r) => r._id as string),
    sectors: sectorAgg.map((r) => r._id as string),
  };
}

export async function fastSearchAssets(query: string, limit: number) {
  if (!query) return { items: [], total: 0 };
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const docs = await CleanAssetModel.find({
    $or: [
      { symbol: { $regex: `^${escaped}`, $options: "i" } },
      { name: { $regex: escaped, $options: "i" } },
    ],
  })
    .sort({ priorityScore: -1 })
    .limit(limit)
    .select("symbol fullSymbol name exchange country type iconUrl s3Icon priorityScore isPrimaryListing marketCap")
    .lean();

  return { items: docs, total: docs.length };
}

export async function getSymbolDetail(symbol: string) {
  return CleanAssetModel.findOne({
    $or: [
      { symbol: symbol.toUpperCase() },
      { fullSymbol: symbol.toUpperCase() },
    ],
  }).lean();
}
