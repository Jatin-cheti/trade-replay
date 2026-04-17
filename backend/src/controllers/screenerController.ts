import { Request, Response } from "express";
import { z } from "zod";
import { CleanAssetModel } from "../models/CleanAsset";
import { SymbolModel } from "../models/Symbol";
import { getPriceQuotes } from "../services/priceCache.service";
import { getLiveQuotes } from "../services/snapshotEngine.service";
import { enrichScreenerBatch, getFullSymbolData } from "../services/symbolAggregation.service";
import { redisClient, isRedisReady } from "../config/redis";
import { logger } from "../utils/logger";

/* ── Zod Validation ──────────────────────────────────────────────────── */
const listSchema = z.object({
  type: z.string().optional(),
  country: z.string().optional(),
  sector: z.string().optional(),
  exchange: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().default("priorityScore"),
  order: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().optional(),
  marketCapMin: z.coerce.number().optional(),
  marketCapMax: z.coerce.number().optional(),
  volumeMin: z.coerce.number().optional(),
  volumeMax: z.coerce.number().optional(),
  primary: z.string().optional(),
});

const ALLOWED_SORTS = new Set([
  "marketCap", "volume", "symbol", "name",
  "priorityScore", "liquidityScore", "popularity", "price",
]);

const CACHE_TTL = 30; // 30s for price freshness

/* ── Geo helpers ─────────────────────────────────────────────────────── */
function getUserCountry(req: Request): string {
  return (
    (req.headers["x-user-country"] as string) ||
    (req.headers["x-vercel-ip-country"] as string) ||
    (req.headers["cf-ipcountry"] as string) ||
    (req.headers["x-country"] as string) ||
    ""
  ).toUpperCase();
}

const GEO_EXCHANGE_MAP: Record<string, string[]> = {
  IN: ["NSE", "BSE"],
  US: ["NASDAQ", "NYSE", "AMEX", "OTCMARKETS"],
  GB: ["LSE", "LONDON"],
  DE: ["XETRA", "FRANKFURT"],
  JP: ["TSE", "TOKYO"],
  CN: ["SSE", "SZSE", "SHANGHAI", "SHENZHEN"],
  CA: ["TSX", "TSXV", "TORONTO"],
  AU: ["ASX"],
  FR: ["PARIS", "EURONEXT"],
  KR: ["KRX", "KOSPI", "KOSDAQ"],
  HK: ["HKEX"],
  SG: ["SGX"],
  BR: ["BOVESPA", "B3"],
};

/* ── Use CleanAsset (gold layer) as the screener data source ─────────── */
const ScreenerModel = CleanAssetModel;

/* ── Build filter query ──────────────────────────────────────────────── */
function buildQuery(filters: z.infer<typeof listSchema>) {
  const query: Record<string, unknown> = {};

  if (filters.type) query.type = filters.type.toLowerCase();
  if (filters.country) query.country = filters.country.toUpperCase();
  if (filters.exchange) query.exchange = filters.exchange.toUpperCase();
  if (filters.sector) query.sector = { $regex: filters.sector, $options: "i" };

  // Range filters
  if (filters.marketCapMin || filters.marketCapMax) {
    const cap: Record<string, number> = {};
    if (filters.marketCapMin) cap.$gte = filters.marketCapMin;
    if (filters.marketCapMax) cap.$lte = filters.marketCapMax;
    query.marketCap = cap;
  }
  if (filters.volumeMin || filters.volumeMax) {
    const vol: Record<string, number> = {};
    if (filters.volumeMin) vol.$gte = filters.volumeMin;
    if (filters.volumeMax) vol.$lte = filters.volumeMax;
    query.volume = vol;
  }

  if (filters.q) {
    const q = filters.q.trim();
    if (q.length > 0) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { symbol: { $regex: `^${escaped}`, $options: "i" } },
        { name: { $regex: escaped, $options: "i" } },
        { fullSymbol: { $regex: escaped, $options: "i" } },
      ];
    }
  }

  return query;
}

/* ── Cache key builder ───────────────────────────────────────────────── */
function buildCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  return `screener:${prefix}:${sorted}`;
}

function formatDoc(doc: any) {
  return {
    symbol: doc.symbol,
    fullSymbol: doc.fullSymbol,
    name: doc.name,
    exchange: doc.exchange,
    country: doc.country,
    type: doc.type,
    currency: doc.currency || "USD",
    iconUrl: doc.s3Icon || doc.iconUrl || "",
    companyDomain: doc.companyDomain || "",
    marketCap: doc.marketCap || 0,
    volume: doc.volume || 0,
    liquidityScore: doc.liquidityScore || 0,
    priorityScore: doc.priorityScore || 0,
    sector: doc.sector || "",
    popularity: doc.popularity || 0,
    source: doc.source || "",
    isPrimaryListing: doc.isPrimaryListing || false,
    price: 0,
    change: 0,
    changePercent: 0,
  };
}

const SELECT_FIELDS = "-searchPrefixes -logoAttempts -lastLogoAttemptAt -logoValidationNotes -logoQualityScore -__v";

/* ── LIST endpoint ───────────────────────────────────────────────────── */
export async function list(req: Request, res: Response) {
  try {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid parameters", details: parsed.error.issues });
    }

    const filters = parsed.data;
    const sortField = ALLOWED_SORTS.has(filters.sort) ? filters.sort : "priorityScore";
    const sortDir = filters.order === "asc" ? 1 : -1;

    // Redis cache check
    const cacheKey = buildCacheKey("list", { ...filters, sortField, sortDir });
    if (isRedisReady()) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
      } catch { /* cache miss */ }
    }

    const query = buildQuery(filters);

    const userCountry = getUserCountry(req);
    const geoExchanges = GEO_EXCHANGE_MAP[userCountry] || [];
    const useGeoBoost = geoExchanges.length > 0 && !filters.exchange && !filters.q && sortField === "priorityScore";

    let items: any[];
    let total: number;

    if (useGeoBoost) {
      const localQuery = { ...query, exchange: { $in: geoExchanges } };
      const restQuery = { ...query, exchange: { $nin: geoExchanges } };

      const [localItems, restItems, totalCount] = await Promise.all([
        ScreenerModel.find(localQuery).sort({ priorityScore: -1, symbol: 1 })
          .skip(0).limit(filters.limit + filters.offset).select(SELECT_FIELDS).lean(),
        ScreenerModel.find(restQuery).sort({ priorityScore: -1, symbol: 1 })
          .skip(0).limit(filters.limit + filters.offset).select(SELECT_FIELDS).lean(),
        ScreenerModel.countDocuments(query),
      ]);

      const merged = [...localItems, ...restItems];
      items = merged.slice(filters.offset, filters.offset + filters.limit);
      total = totalCount;
    } else {
      const sortObj: Record<string, 1 | -1> = { [sortField]: sortDir };
      if (sortField !== "priorityScore") sortObj.priorityScore = -1;

      const [docs, count] = await Promise.all([
        ScreenerModel.find(query).sort(sortObj).skip(filters.offset).limit(filters.limit)
          .select(SELECT_FIELDS).lean(),
        ScreenerModel.countDocuments(query),
      ]);
      items = docs;
      total = count;
    }

    // Unified aggregation: prices + fundamentals + logos in one pass
    const enriched = await enrichScreenerBatch(items);

    const result = {
      items: enriched,
      total,
      limit: filters.limit,
      offset: filters.offset,
      hasMore: filters.offset + items.length < total,
    };

    if (isRedisReady()) {
      redisClient.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL).catch(() => {});
    }

    return res.json(result);
  } catch (err) {
    logger.error("screener_list_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ── STATS endpoint ──────────────────────────────────────────────────── */
export async function stats(_req: Request, res: Response) {
  try {
    // Redis cache check
    const cacheKey = "screener:stats";

    if (isRedisReady()) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
      } catch { /* miss */ }
    }

    const agg = await ScreenerModel.aggregate([
      { $match: {} },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    const byType: Record<string, number> = {};
    let total = 0;
    for (const row of agg) {
      byType[row._id] = row.count;
      total += row.count;
    }

    const bqf = {};
    const [exchanges, countries, sectors] = await Promise.all([
      ScreenerModel.distinct("exchange", bqf),
      ScreenerModel.distinct("country", bqf),
      ScreenerModel.distinct("sector", bqf).then((s: string[]) => s.filter(Boolean)),
    ]);

    const result = {
      total,
      byType,
      exchanges: exchanges.sort(),
      countries: countries.sort(),
      sectors: sectors.sort(),
    };

    if (isRedisReady()) {
      redisClient.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL).catch(() => {});
    }

    return res.json(result);
  } catch (err) {
    logger.error("screener_stats_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ── SYMBOL DETAIL endpoint ──────────────────────────────────────────── */
export async function symbolDetail(req: Request, res: Response) {
  try {
    const { fullSymbol } = req.params;
    if (!fullSymbol) return res.status(400).json({ error: "fullSymbol required" });

    const normalized = decodeURIComponent(fullSymbol).toUpperCase();

    // Use unified aggregation service — returns full data with prices + fundamentals + logo
    const result = await getFullSymbolData(normalized);
    if (!result) return res.status(404).json({ error: "Symbol not found" });

    // Cache for 30s (aggregation service also caches, but this caches the final response)
    if (isRedisReady()) {
      redisClient.set(`screener:symbol:${normalized}`, JSON.stringify(result), "EX", CACHE_TTL).catch(() => {});
    }

    return res.json(result);
  } catch (err) {
    logger.error("screener_symbol_detail_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ── FILTER OPTIONS endpoint ─────────────────────────────────────────── */
export async function filterOptions(_req: Request, res: Response) {
  try {
    // Redis cache check
    const cacheKey = "screener:filters";

    if (isRedisReady()) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
      } catch { /* miss */ }
    }

    const bqf2 = {};
    const [exchanges, countries, sectors] = await Promise.all([
      ScreenerModel.distinct("exchange", bqf2),
      ScreenerModel.distinct("country", bqf2),
      ScreenerModel.distinct("sector", bqf2).then((s: string[]) => s.filter(Boolean)),
    ]);

    const result = { exchanges: exchanges.sort(), countries: countries.sort(), sectors: sectors.sort() };

    if (isRedisReady()) {
      redisClient.set(cacheKey, JSON.stringify(result), "EX", 600).catch(() => {});
    }

    return res.json(result);
  } catch (err) {
    logger.error("screener_filter_options_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}
