import { FilterQuery, Types } from "mongoose";
import { SymbolDocument, SymbolModel } from "../models/Symbol";
import { resolveStaticIcon } from "../config/staticIconMap";
import { isRedisReady } from "../config/redis";
import { getOrSetCachedJsonWithLock } from "./cache.service";
import { enqueueSymbolLogoEnrichmentBatch } from "./logoQueue.service";
import { clusterScopedKey, stableHash } from "./redisKey.service";
import { recordSymbolIconResult, recordSymbolSearchLatency } from "./metrics.service";
import { intelligentSearch, trackRecentSymbol, type ScoredSymbol } from "./searchIntelligence.service";

import {
  type SymbolType,
  type StableCursor,
  type CursorDecodeResult,
  CACHE_TTL_SECONDS,
  SEARCH_PRECACHE_QUERIES,
  coerceSymbolType,
  normalizeQuery,
  buildFilter,
  escapeRegex,
  fallbackSymbolIconUrl,
  toTypeLabel,
  encodeCursor,
  decodeCursor,
  resolveCursorAnchor,
} from "./symbol.helpers";

export interface SymbolRegistryItem {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: SymbolType;
  currency: string;
  iconUrl?: string;
  companyDomain?: string;
  s3Icon?: string;
  popularity: number;
  searchFrequency?: number;
  isFallback?: boolean;
  realIconUrl?: string;
  fallbackIconUrl?: string;
  displayIconUrl?: string;
}

export interface SymbolSearchResult {
  items: SymbolRegistryItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextCursor?: string | null;
  matchBreakdown?: { exact: number; prefix: number; fuzzy: number; name: number; sector: number };
  clusters?: Record<string, string[]>;
}

type SymbolRegistryRow = SymbolRegistryItem & { _id: Types.ObjectId };

export async function searchSymbols(params: {
  query: string;
  type?: string;
  country?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
  userId?: string;
  userCountry?: string;
  skipLogoEnrichment?: boolean;
  disablePrefetch?: boolean;
  skipSearchFrequencyUpdate?: boolean;
  trackMetrics?: boolean;
}): Promise<SymbolSearchResult> {
  const startedAt = Date.now();
  const query = normalizeQuery(params.query);
  const limit = Math.max(1, Math.min(100, params.limit ?? 50));
  const offset = Math.max(0, params.offset ?? 0);
  const decodedCursor = decodeCursor(params.cursor);
  if (!decodedCursor.ok) {
    throw new Error("INVALID_CURSOR_TOKEN");
  }
  const cursor = await resolveCursorAnchor(decodedCursor.cursor);

  // --- INTELLIGENT SEARCH: first page uses prefix+fuzzy+clustering ---
  if (query && !cursor && !params.cursor) {
    const smartResult = await intelligentSearch({
      query,
      type: params.type,
      country: params.country,
      limit,
      userId: params.userId,
      userCountry: params.userCountry,
    });

    const smartItems: SymbolRegistryItem[] = smartResult.items.map((item) => {
      const staticIcon = resolveStaticIcon(item.symbol);
      const realIconUrl = item.iconUrl || item.s3Icon || staticIcon || "";
      const fallbackIcon = fallbackSymbolIconUrl(item.exchange);
      const isFallback = !realIconUrl;
      const displayIconUrl = isFallback ? fallbackIcon : realIconUrl;
      return {
        symbol: item.symbol,
        fullSymbol: item.fullSymbol,
        name: item.name,
        exchange: item.exchange,
        country: item.country,
        type: item.type as SymbolType,
        currency: item.currency,
        iconUrl: realIconUrl,
        companyDomain: item.companyDomain,
        s3Icon: item.s3Icon,
        popularity: item.popularity,
        searchFrequency: item.searchFrequency,
        realIconUrl,
        fallbackIconUrl: fallbackIcon,
        isFallback,
        displayIconUrl,
      };
    });

    const smartResponse: SymbolSearchResult = {
      items: smartItems,
      total: smartResult.total,
      limit,
      offset: 0,
      hasMore: smartResult.hasMore,
      nextCursor: null,
    };

    if (!params.skipLogoEnrichment && isRedisReady()) {
      enqueueSymbolLogoEnrichmentBatch(smartResponse.items.slice(0, 20));
    }

    if (smartResponse.items.length > 0 && !params.skipSearchFrequencyUpdate) {
      const ids = smartResponse.items.slice(0, 20).map((item) => item.fullSymbol);
      void SymbolModel.updateMany({ fullSymbol: { $in: ids } }, { $inc: { searchFrequency: 1 } })
        .then(() => recalculatePriorityScores(ids))
        .catch(() => {});
    }

    if (params.userId && smartResponse.items.length > 0) {
      void trackRecentSymbol(params.userId, smartResponse.items[0].fullSymbol).catch(() => {});
    }

    if (params.trackMetrics !== false) {
      for (const item of smartResponse.items) {
        recordSymbolIconResult(Boolean(item.isFallback));
      }
      recordSymbolSearchLatency(Date.now() - startedAt);
    }

    return smartResponse;
  }
  // --- END INTELLIGENT SEARCH ---

  const partition = stableHash(`${query.toLowerCase()}:${params.type ?? "all"}:${params.country ?? "all"}`);
  const cacheKey = clusterScopedKey(
    "app:symbols:search",
    partition,
    `${query.toLowerCase()}:${params.type ?? "all"}:${params.country ?? "all"}:${limit}:${params.cursor ?? `offset:${offset}`}`,
  );

  const response = await getOrSetCachedJsonWithLock<SymbolSearchResult>(cacheKey, CACHE_TTL_SECONDS, async () => {
    const baseFilter = buildFilter({ query, type: params.type, country: params.country });
    let filter: FilterQuery<SymbolDocument> = baseFilter;

    if (cursor) {
      const cursorWindow: FilterQuery<SymbolDocument> = {
        $or: [
          { createdAt: { $lt: cursor.createdAt } },
          {
            createdAt: cursor.createdAt,
            _id: { $lt: cursor._id },
          },
        ],
      };
      filter = { $and: [baseFilter, cursorWindow] };
    }

    const queryBuilder = SymbolModel.find(filter)
      .select({
        symbol: 1,
        fullSymbol: 1,
        name: 1,
        exchange: 1,
        country: 1,
        type: 1,
        currency: 1,
        iconUrl: 1,
        companyDomain: 1,
        s3Icon: 1,
        popularity: 1,
        searchFrequency: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean<Array<SymbolRegistryRow & { createdAt: Date }>>();

    if (!cursor && offset > 0) {
      queryBuilder.skip(offset);
    }

    const [regexRows, exactRows] = await Promise.all([
      queryBuilder,
      SymbolModel.find({
        symbol: query.toUpperCase(),
        ...(params.type ? { type: coerceSymbolType(params.type) || params.type } : {}),
        ...(params.country ? { country: params.country.toUpperCase() } : {}),
      })
        .select({
          symbol: 1, fullSymbol: 1, name: 1, exchange: 1, country: 1, type: 1,
          currency: 1, iconUrl: 1, companyDomain: 1, s3Icon: 1, popularity: 1,
          searchFrequency: 1, priorityScore: 1, createdAt: 1,
        })
        .sort({ priorityScore: -1, createdAt: -1 })
        .limit(5)
        .lean<Array<SymbolRegistryRow & { createdAt: Date }>>(),
    ]);
    const pinnedFullSymbols = new Set(exactRows.map((r) => r.fullSymbol));
    const deduped = regexRows.filter((r) => !pinnedFullSymbols.has(r.fullSymbol));
    const rows = [...exactRows, ...deduped];

    const hasMore = rows.length > limit;
    const pagedRows = hasMore ? rows.slice(0, limit) : rows;
    const last = pagedRows[pagedRows.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor({ createdAt: last.createdAt, _id: last._id })
      : null;
    const paged: SymbolRegistryItem[] = pagedRows.map(({ _id: _unused, createdAt: _createdAt, ...rest }) => {
      const staticIcon = resolveStaticIcon(rest.symbol);
      const realIconUrl = rest.iconUrl || rest.s3Icon || staticIcon || "";
      const fallbackIcon = fallbackSymbolIconUrl(rest.exchange);
      const isFallback = !realIconUrl;
      const displayIconUrl = isFallback ? fallbackIcon : realIconUrl;
      return {
        ...rest,
        iconUrl: realIconUrl,
        realIconUrl,
        fallbackIconUrl: fallbackIcon,
        isFallback,
        displayIconUrl,
      };
    });

    return {
      items: paged,
      total: -1,
      limit,
      offset,
      hasMore,
      nextCursor,
    };
  });

  if (!params.skipLogoEnrichment && isRedisReady()) {
    enqueueSymbolLogoEnrichmentBatch(response.items.slice(0, 20));
  }

  if (response.items.length > 0 && !params.skipSearchFrequencyUpdate) {
    const ids = response.items.slice(0, 20).map((item) => item.fullSymbol);
    void SymbolModel.updateMany({ fullSymbol: { $in: ids } }, { $inc: { searchFrequency: 1 } })
      .then(() => recalculatePriorityScores(ids))
      .catch(() => {
      // Search path should not fail on frequency update issues.
    });
  }

  if (response.nextCursor && !params.disablePrefetch) {
    const nextKey = clusterScopedKey(
      "app:symbols:search",
      partition,
      `${query.toLowerCase()}:${params.type ?? "all"}:${params.country ?? "all"}:${limit}:${response.nextCursor}`,
    );

    void getOrSetCachedJsonWithLock<SymbolSearchResult>(nextKey, CACHE_TTL_SECONDS, async () => {
      return searchSymbols({
        query,
        type: params.type,
        country: params.country,
        limit,
        cursor: response.nextCursor ?? undefined,
        skipLogoEnrichment: true,
        disablePrefetch: true,
        skipSearchFrequencyUpdate: true,
        trackMetrics: false,
      });
    }).catch(() => {
      // Prefetch must never fail user requests.
    });
  }

  if (params.trackMetrics !== false) {
    for (const item of response.items) {
      recordSymbolIconResult(Boolean(item.isFallback));
    }
    recordSymbolSearchLatency(Date.now() - startedAt);
  }
  return response;
}

export async function warmSymbolSearchCache(): Promise<{ warmed: number; failed: number }> {
  let warmed = 0;
  let failed = 0;

  await Promise.all(
    SEARCH_PRECACHE_QUERIES.map(async (query) => {
      try {
        await searchSymbols({
          query,
          limit: 40,
          skipLogoEnrichment: true,
          trackMetrics: false,
        });
        warmed += 1;
      } catch {
        failed += 1;
      }
    }),
  );

  return { warmed, failed };
}

export async function fetchSymbolFilters(type?: string): Promise<{
  countries: Array<{ value: string; label: string }>;
  types: Array<{ value: string; label: string }>;
}> {
  const filter: FilterQuery<SymbolDocument> = {};
  const resolvedType = coerceSymbolType(type);
  if (resolvedType) {
    filter.type = resolvedType;
  }

  const [countryRows, typeRows] = await Promise.all([
    SymbolModel.aggregate<{ _id: string; count: number }>([
      { $match: filter },
      { $group: { _id: "$country", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    SymbolModel.aggregate<{ _id: string; count: number }>([
      { $match: filter },
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    countries: [{ value: "all", label: "All Countries" }, ...countryRows.map((row) => ({ value: row._id, label: row._id }))],
    types: [{ value: "all", label: "All Types" }, ...typeRows.map((row) => ({ value: row._id, label: toTypeLabel(row._id) }))],
  };
}

export function mapCategoryToSymbolType(category?: string): SymbolType | undefined {
  if (!category) return undefined;
  const normalized = category.toLowerCase();
  if (normalized === "stocks" || normalized === "funds" || normalized === "bonds" || normalized === "options") return "stock";
  if (normalized === "crypto") return "crypto";
  if (normalized === "forex") return "forex";
  if (normalized === "indices" || normalized === "futures" || normalized === "economy") return "index";
  return undefined;
}

export function toAssetSearchItem(symbol: SymbolRegistryItem) {
  const category = symbol.type === "stock"
    ? "stocks"
    : symbol.type === "crypto"
      ? "crypto"
      : symbol.type === "forex"
        ? "forex"
        : "indices";

  const market = category === "stocks"
    ? "Stocks"
    : category === "crypto"
      ? "Crypto"
      : category === "forex"
        ? "Forex"
        : "Indices";

  const persistedIcon = symbol.realIconUrl || symbol.iconUrl || symbol.s3Icon || resolveStaticIcon(symbol.symbol) || "";
  const fallbackIcon = symbol.fallbackIconUrl || fallbackSymbolIconUrl(symbol.exchange);
  const isFallback = symbol.isFallback ?? !persistedIcon;
  const displayIconUrl = symbol.displayIconUrl || (isFallback ? fallbackIcon : persistedIcon);

  return {
    ticker: symbol.symbol,
    symbol: symbol.symbol,
    name: symbol.name,
    exchange: symbol.exchange,
    region: symbol.country,
    instrumentType: symbol.type,
    type: symbol.type,
    category,
    assetType: category,
    market,
    country: symbol.country,
    sector: "",
    exchangeType: symbol.type === "crypto" ? "cex" : "",
    icon: "",
    exchangeIcon: "",
    exchangeLogoUrl: "",
    iconUrl: persistedIcon,
    logoUrl: displayIconUrl,
    displayIconUrl,
    isFallback,
    source: "symbol-registry",
  };
}

const PRIORITY_SCORE_PIPELINE = [
  {
    $set: {
      priorityScore: {
        $add: [
          { $multiply: [{ $ifNull: ["$searchFrequency", 0] }, 0.5] },
          { $multiply: [{ $ifNull: ["$userUsage", 0] }, 0.3] },
          {
            $cond: [
              { $or: [{ $gt: ["$iconUrl", ""] }, { $gt: ["$s3Icon", ""] }] },
              50,
              0,
            ],
          },
        ],
      },
    },
  },
];

export async function recalculatePriorityScores(fullSymbols?: string[]): Promise<void> {
  const filter = fullSymbols ? { fullSymbol: { $in: fullSymbols } } : {};
  await SymbolModel.updateMany(filter, PRIORITY_SCORE_PIPELINE);
}

export async function incrementUserUsage(symbols: string[]): Promise<void> {
  if (!symbols.length) return;
  await SymbolModel.updateMany(
    { symbol: { $in: symbols.map((s) => s.toUpperCase()) } },
    { $inc: { userUsage: 1 } },
  );
  const docs = await SymbolModel.find({ symbol: { $in: symbols.map((s) => s.toUpperCase()) } })
    .select({ fullSymbol: 1 })
    .lean<Array<{ fullSymbol: string }>>();
  await recalculatePriorityScores(docs.map((d) => d.fullSymbol));
}