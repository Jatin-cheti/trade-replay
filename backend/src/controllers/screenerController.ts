import { Request, Response } from "express";
import { z } from "zod";
import { CleanAssetModel } from "../models/CleanAsset";
import { SymbolModel } from "../models/Symbol";
import { getPriceQuotes } from "../services/priceCache.service";
import { getLiveQuotes } from "../services/snapshotEngine.service";
import { enrichScreenerBatch, getFullSymbolData } from "../services/symbolAggregation.service";
import { redisClient, isRedisReady } from "../config/redis";
import { logger } from "../utils/logger";
import { buildScreenerCacheKey, getCachedRaw } from "../services/screenerCache.service";
import { trieSearchSymbols, isTrieReady } from "../services/trieSearch.service";
import { getFilterIndex } from "../services/filterCache.service";

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

const ScreenerModel = CleanAssetModel;

const SELECT_FIELDS = "-searchPrefixes -logoAttempts -lastLogoAttemptAt -logoValidationNotes -logoQualityScore -__v";

/* ── Build filter query ──────────────────────────────────────────────── */
function buildQuery(filters: z.infer<typeof listSchema>) {
  const query: Record<string, unknown> = {};

  if (filters.type) query.type = filters.type.toLowerCase();
  if (filters.country) query.country = filters.country.toUpperCase();
  if (filters.exchange) query.exchange = filters.exchange.toUpperCase();
  if (filters.sector) query.sector = { $regex: filters.sector, $options: "i" };

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

    const cacheParams: Record<string, unknown> = {
      limit: filters.limit,
      offset: filters.offset,
      sort: sortField,
      order: filters.order,
    };
    if (filters.type) cacheParams.type = filters.type;
    if (filters.country) cacheParams.country = filters.country;
    if (filters.exchange) cacheParams.exchange = filters.exchange;
    if (filters.sector) cacheParams.sector = filters.sector;
    if (filters.q) cacheParams.q = filters.q;
    if (filters.marketCapMin) cacheParams.marketCapMin = filters.marketCapMin;
    if (filters.marketCapMax) cacheParams.marketCapMax = filters.marketCapMax;
    if (filters.volumeMin) cacheParams.volumeMin = filters.volumeMin;
    if (filters.volumeMax) cacheParams.volumeMax = filters.volumeMax;
    if (filters.primary) cacheParams.primary = filters.primary;

    const cacheKey = buildScreenerCacheKey(cacheParams);

    // On-demand cache-aside: fetcher computes on miss
    const json = await getCachedRaw(cacheKey, async () => {
      // ── Trie fast-path for search queries ──
      if (filters.q && isTrieReady()) {
        const trieResults = trieSearchSymbols(filters.q, filters.limit);
        if (trieResults.length > 0) {
          const enriched = await enrichScreenerBatch(trieResults.map(r => ({
            symbol: r.symbol,
            fullSymbol: r.fullSymbol,
            name: r.name,
            exchange: r.exchange,
            country: r.country,
            type: r.type,
            iconUrl: r.iconUrl,
            marketCap: r.marketCap,
            priorityScore: r.priorityScore,
            isPrimaryListing: r.isPrimaryListing,
            volume: 0,
            liquidityScore: 0,
            popularity: 0,
            sector: "",
            source: "",
            companyDomain: "",
          })));

          return JSON.stringify({
            items: enriched,
            total: trieResults.length,
            limit: filters.limit,
            offset: filters.offset,
            hasMore: false,
          });
        }
      }

      // ── Standard MongoDB path ──
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

      const enriched = await enrichScreenerBatch(items);

      return JSON.stringify({
        items: enriched,
        total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + items.length < total,
      });
    });

    return res.type("json").send(json);
  } catch (err) {
    logger.error("screener_list_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ── STATS endpoint ──────────────────────────────────────────────────── */
export async function stats(_req: Request, res: Response) {
  try {
    const index = await getFilterIndex();
    return res.json({
      total: index.total,
      byType: index.byType,
      exchanges: index.exchanges,
      countries: index.countries,
      sectors: index.sectors,
    });
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

    const normalized = decodeURIComponent(String(fullSymbol)).toUpperCase();

    const result = await getFullSymbolData(normalized);
    if (!result) return res.status(404).json({ error: "Symbol not found" });

    return res.json(result);
  } catch (err) {
    logger.error("screener_symbol_detail_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ── FILTER OPTIONS endpoint ─────────────────────────────────────────── */
export async function filterOptions(_req: Request, res: Response) {
  try {
    const index = await getFilterIndex();
    return res.json({
      exchanges: index.exchanges,
      countries: index.countries,
      sectors: index.sectors,
    });
  } catch (err) {
    logger.error("screener_filter_options_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ── FAST SEARCH endpoint (trie-powered) ─────────────────────────────── */
export async function fastSearch(req: Request, res: Response) {
  try {
    const q = (req.query.q as string || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);

    if (!q || q.length === 0) {
      return res.json({ items: [], total: 0 });
    }

    if (!isTrieReady()) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

      return res.json({
        items: docs.map(d => ({
          symbol: d.symbol,
          fullSymbol: d.fullSymbol,
          name: d.name,
          exchange: d.exchange,
          country: d.country || "",
          type: d.type,
          iconUrl: d.s3Icon || d.iconUrl || "",
          priorityScore: d.priorityScore || 0,
          isPrimaryListing: (d as any).isPrimaryListing || false,
          marketCap: d.marketCap || 0,
        })),
        total: docs.length,
        source: "mongodb_fallback",
      });
    }

    const results = trieSearchSymbols(q, limit);
    return res.json({
      items: results,
      total: results.length,
      source: "trie",
    });
  } catch (err) {
    logger.error("screener_fast_search_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}