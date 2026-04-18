import { FilterQuery, Types } from "mongoose";
import { SymbolDocument, SymbolModel } from "../models/Symbol";
import { resolveStaticIcon } from "../config/staticIconMap";
import { isRedisReady } from "../config/redis";
import { getOrSetCachedJsonWithLock } from "./cache.service";
import { enqueueSymbolLogoEnrichmentBatch, isLogoQueueEnabled } from "./logoQueue.service";
import { clusterScopedKey, stableHash } from "./redisKey.service";
import { recordSymbolIconResult, recordSymbolSearchLatency } from "./metrics.service";
import { intelligentSearch, trackRecentSymbol, type ScoredSymbol } from "./searchIntelligence.service";
import { lookupSymbolsFromIndex, type SearchIndexLookupResult } from "./searchIndex.service";
import { overlayRealtimePrices } from "./priceCache.service";
import {
  fetchExternalSymbols,
  persistExternalSymbolsAsync,
  type ExternalSymbolCandidate,
} from "./externalSymbolSearch.service";
import { PortfolioModel } from "../models/Portfolio";
import { logger } from "../utils/logger";

import {
  type SymbolType,
  type StableCursor,
  type CursorDecodeResult,
  CACHE_TTL_SECONDS,
  SEARCH_PRECACHE_QUERIES,
  coerceSymbolType,
  buildCountryFilterInput,
  matchesCountryFlexible,
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
  baseSymbol?: string;
  exchange: string;
  country: string;
  updatedAt?: Date;
  type: SymbolType;
  currency: string;
  iconUrl?: string;
  companyDomain?: string;
  s3Icon?: string;
  source?: string;
  isSynthetic?: boolean;
  popularity: number;
  searchFrequency?: number;
  userUsage?: number;
  priorityScore?: number;
  marketCap?: number;
  volume?: number;
  liquidityScore?: number;
  price?: number;
  change?: number;
  changePercent?: number;
  pnl?: number;
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
const FINAL_SEARCH_CACHE_TTL_SECONDS = 10;

function estimateMarketCap(item: SymbolRegistryItem): number {
  if ((item.marketCap ?? 0) > 0) return item.marketCap as number;
  return Math.max(0,
    ((item.priorityScore ?? 0) * 5_000_000)
    + ((item.searchFrequency ?? 0) * 250_000)
    + (item.popularity * 100_000),
  );
}

function computeLiquidityScore(item: SymbolRegistryItem, marketCap: number, volume: number): number {
  if ((item.liquidityScore ?? 0) > 0) return item.liquidityScore as number;
  const marketComponent = marketCap > 0 ? Math.log10(marketCap + 1) * 8 : 0;
  const volumeComponent = volume > 0 ? Math.log10(volume + 1) * 12 : 0;
  const behaviorComponent = ((item.searchFrequency ?? 0) * 0.5) + ((item.userUsage ?? 0) * 0.3);
  return Number((marketComponent + volumeComponent + behaviorComponent).toFixed(3));
}

async function enrichWithRealtimePrices(items: SymbolRegistryItem[]): Promise<SymbolRegistryItem[]> {
  if (!items.length) return items;

  const withRealtime = await overlayRealtimePrices(items);

  return withRealtime.map((item) => {
    const volume = item.volume ?? 0;
    const marketCap = estimateMarketCap(item);
    const liquidityScore = computeLiquidityScore(item, marketCap, volume);

    return {
      ...item,
      marketCap,
      volume,
      liquidityScore,
      price: item.price ?? 0,
      change: item.change ?? 0,
      changePercent: item.changePercent ?? 0,
      pnl: item.pnl ?? item.change ?? 0,
    };
  });
}

function prioritizeMarketDataCompleteness(items: SymbolRegistryItem[]): SymbolRegistryItem[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    const aHas = Number.isFinite(a.price ?? NaN) && Number.isFinite(a.change ?? NaN);
    const bHas = Number.isFinite(b.price ?? NaN) && Number.isFinite(b.change ?? NaN);
    if (aHas !== bHas) return Number(bHas) - Number(aHas);
    return 0;
  });
  return sorted;
}

function toQueueCompatibleType(type: SymbolType): "stock" | "crypto" | "forex" | "index" {
  if (type === "etf" || type === "bond") return "stock";
  if (type === "derivative" || type === "economy") return "index";
  return type;
}

function toQueueItems(items: SymbolRegistryItem[]): Array<{
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  type: "stock" | "crypto" | "forex" | "index";
  iconUrl?: string;
  s3Icon?: string;
  companyDomain?: string;
  popularity?: number;
  searchFrequency?: number;
}> {
  return items.map((item) => ({
    symbol: item.symbol,
    fullSymbol: item.fullSymbol,
    name: item.name,
    exchange: item.exchange,
    type: toQueueCompatibleType(item.type),
    iconUrl: item.iconUrl,
    s3Icon: item.s3Icon,
    companyDomain: item.companyDomain,
    popularity: item.popularity,
    searchFrequency: item.searchFrequency,
  }));
}

function normalizeCompanyName(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.toUpperCase();
  cleaned = cleaned.replace(/\b(LIMITED|LTD\.?|INC\.?|CORP\.?|CORPORATION|CO\.?|PLC|HOLDINGS?)\b/g, " ");
  cleaned = cleaned.replace(/\b(FUTURE|FUTURES|OPTION|OPTIONS|PERPETUAL|PERP|CALL|PUT)\b/g, " ");
  cleaned = cleaned.replace(/\b\d{6}\b/g, " ");
  cleaned = cleaned.replace(/[^A-Z0-9 ]/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

function isOptionLikeSymbol(value: { symbol?: string; name?: string; exchange?: string }): boolean {
  const symbol = String(value.symbol || "").toUpperCase();
  const name = String(value.name || "").toUpperCase();
  const exchange = String(value.exchange || "").toUpperCase();
  return (
    exchange === "OPT"
    || /-\d{6}-[CP]-/.test(symbol)
    || /(^|[-_.])(CE|PE)([-_.]|$)/.test(symbol)
    || /\b(OPTION|OPTIONS|CALL|PUT)\b/.test(name)
  );
}

function isFutureLikeSymbol(value: { symbol?: string; name?: string }): boolean {
  const symbol = String(value.symbol || "").toUpperCase();
  const name = String(value.name || "").toUpperCase();
  return (
    symbol.includes("-FUT")
    || symbol.includes("-PERP")
    || /-F-\d{6}$/.test(symbol)
    || /\b(FUTURE|FUTURES|PERPETUAL|PERP)\b/.test(name)
  );
}

function isDerivativeLikeSymbol(value: { type?: string; symbol?: string; exchange?: string; source?: string; isSynthetic?: boolean; name?: string }): boolean {
  if (value.type === "derivative") return true;
  if (value.isSynthetic) return true;
  const symbol = String(value.symbol || "").toUpperCase();
  const exchange = String(value.exchange || "").toUpperCase();
  const source = String(value.source || "").toLowerCase();
  return (
    exchange === "OPT"
    || exchange === "DERIV"
    || exchange === "CFD"
    || symbol.includes("-PERP")
    || symbol.includes("-FUT")
    || /-F-\d{6}$/.test(symbol)
    || /-\d{6}-[CP]-/.test(symbol)
    || /(^|[-_.])(CE|PE)([-_.]|$)/.test(symbol)
    || source === "synthetic-derivatives"
    || isOptionLikeSymbol(value)
    || isFutureLikeSymbol(value)
  );
}

function deriveCompanyKeyFromItem(item: { symbol?: string; baseSymbol?: string; name?: string }): string {
  const raw = String(item.baseSymbol || item.symbol || "").toUpperCase();
  const noDeriv = raw
    .replace(/-F-\d{6}$/g, "")
    .replace(/-\d{6}-[CP]-.+$/g, "")
    .replace(/-PERP$/g, "")
    .replace(/-FUT$/g, "");
  const dotIndex = noDeriv.indexOf(".");
  const normalizedBase = (dotIndex > 0 ? noDeriv.slice(0, dotIndex) : noDeriv).replace(/[^A-Z0-9]/g, "");
  if (normalizedBase) return normalizedBase;

  const normalizedName = normalizeCompanyName(String(item.name || ""));
  if (normalizedName) return normalizedName;

  return raw;
}

function exchangePrimaryBoost(item: { exchange?: string; country?: string }, userCountry?: string): number {
  const exchange = String(item.exchange || "").toUpperCase();
  const country = (userCountry || item.country || "").toUpperCase();

  if (country === "IN") {
    if (exchange === "NSE") return 40;
    if (exchange === "BSE") return 28;
  }
  if (country === "US") {
    if (exchange === "NASDAQ") return 34;
    if (exchange === "NYSE") return 34;
    if (exchange === "AMEX") return 18;
  }
  return 0;
}

function computeCursorRank(item: SymbolRegistryRow & { updatedAt?: Date }, userCountry?: string, query?: string): number {
  const marketCap = Number(item.marketCap || 0);
  const volume = Number(item.volume || 0);
  const liquidity = Number(item.liquidityScore || 0);
  const priority = Number(item.priorityScore || 0);
  const searchFrequency = Number(item.searchFrequency || 0);
  const userUsage = Number(item.userUsage || 0);
  const freshness = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;

  const topEntityBoost: Record<string, number> = {
    RELIANCE: 90,
    TCS: 86,
    HDFCBANK: 84,
    INFY: 82,
    ICICIBANK: 80,
    ADANIENT: 76,
    AAPL: 88,
    MSFT: 86,
    GOOG: 84,
    GOOGL: 84,
    AMZN: 82,
    BTC: 85,
    ETH: 78,
  };

  const companyKey = deriveCompanyKeyFromItem(item);
  const geoCountry = userCountry?.toUpperCase();
  const geoMatchBoost = geoCountry && item.country === geoCountry ? 15 : 0;
  const derivativePenalty = isDerivativeLikeSymbol(item) ? -24 : 8;
  let queryBonus = 0;
  if (query) {
    const upperQuery = query.toUpperCase();
    const symbol = String(item.symbol || "").toUpperCase();
    const name = String(item.name || "").toUpperCase();
    const canonicalCrypto = new Set(["BTC", "ETH", "SOL", "XRP", "BNB"]);
    if (symbol === upperQuery) {
      const bluechipEntities = new Set(["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "ADANIENT", "AAPL", "MSFT", "GOOG", "GOOGL", "AMZN", "BTC", "ETH"]);
      queryBonus += upperQuery.length <= 3 ? 85 : 170;
      if (bluechipEntities.has(companyKey)) queryBonus += 70;
    }
    else if (symbol.startsWith(upperQuery)) queryBonus += 44;
    else if (name.includes(upperQuery)) queryBonus += 12;

    if (companyKey === upperQuery) {
      queryBonus += 120;
      if (canonicalCrypto.has(upperQuery)) {
        queryBonus += item.type === "crypto" ? 220 : -30;
      }
    }
  }

  return (
    (priority * 3.2)
    + (searchFrequency * 1.6)
    + (userUsage * 1.2)
    + (Math.log10(marketCap + 1) * 7)
    + (Math.log10(volume + 1) * 5)
    + (liquidity * 2.5)
    + (topEntityBoost[companyKey] ?? 0)
    + exchangePrimaryBoost(item, userCountry)
    + geoMatchBoost
    + derivativePenalty
    + queryBonus
    + (freshness / 1e14)
  );
}

function classifySearchCategory(item: Pick<SymbolRegistryItem, "type" | "symbol" | "name" | "exchange" | "source" | "isSynthetic">): "stocks" | "funds" | "futures" | "forex" | "crypto" | "indices" | "bonds" | "economy" | "options" {
  const source = String(item.source || "").toLowerCase();
  const name = String(item.name || "").toLowerCase();

  if (item.type === "crypto") return "crypto";
  if (item.type === "forex") return "forex";
  if (item.type === "etf") return "funds";
  if (item.type === "bond") return "bonds";
  if (item.type === "economy") return "economy";

  const exchange = String(item.exchange || "").toUpperCase();
  if (/\b(bond|gilt|treasury|debenture|note|bund|t-note|t-bill)\b/.test(name)
    || exchange === "UST" || exchange === "FINRA"
    || source.includes("treasury") || source.includes("finra") || source === "bund") {
    return "bonds";
  }

  if (item.type === "index") {
    if (
      source.includes("economic")
      || /\b(gdp|inflation|cpi|pmi|unemployment|interest\s*rate|consumer\s*price|manufacturing)\b/.test(name)
    ) {
      return "economy";
    }
    return "indices";
  }

  if (isOptionLikeSymbol(item)) return "options";
  if (isFutureLikeSymbol(item) || item.type === "derivative") return "futures";

  return "stocks";
}

function toSymbolTypeFromExternal(type: ExternalSymbolCandidate["type"]): SymbolType {
  if (type === "stock") return "stock";
  if (type === "etf") return "etf";
  if (type === "crypto") return "crypto";
  if (type === "forex") return "forex";
  return "index";
}

function toRegistryItemFromExternal(candidate: ExternalSymbolCandidate): SymbolRegistryItem {
  const staticIcon = resolveStaticIcon(candidate.symbol);
  const realIconUrl = candidate.iconUrl || staticIcon || "";
  const fallbackIcon = fallbackSymbolIconUrl(candidate.exchange);
  const isFallback = !realIconUrl;
  const displayIconUrl = isFallback ? fallbackIcon : realIconUrl;

  return {
    symbol: candidate.symbol,
    fullSymbol: candidate.fullSymbol,
    name: candidate.name,
    exchange: candidate.exchange,
    country: candidate.country,
    type: toSymbolTypeFromExternal(candidate.type),
    currency: candidate.currency,
    iconUrl: realIconUrl,
    companyDomain: candidate.companyDomain,
    source: candidate.source,
    popularity: Math.max(0, candidate.popularity ?? Math.floor(candidate.rankScore / 100)),
    searchFrequency: 0,
    userUsage: 0,
    priorityScore: Math.max(1, Math.floor(candidate.rankScore / 100)),
    marketCap: candidate.marketCap ?? 0,
    volume: candidate.volume ?? 0,
    liquidityScore: 0,
    isFallback,
    realIconUrl,
    fallbackIconUrl: fallbackIcon,
    displayIconUrl,
  };
}

function mergeLocalAndExternalResults(params: {
  localItems: SymbolRegistryItem[];
  externalCandidates: ExternalSymbolCandidate[];
  limit: number;
}): { items: SymbolRegistryItem[]; addedCount: number; hasMore: boolean } {
  const { localItems, externalCandidates, limit } = params;

  const seen = new Set(localItems.map((item) => item.fullSymbol.toUpperCase()));
  const localScored = localItems.map((item, index) => ({ item, score: 12000 - (index * 30) }));

  const externalScored = externalCandidates
    .filter((candidate) => !seen.has(candidate.fullSymbol.toUpperCase()))
    .map((candidate) => ({ item: toRegistryItemFromExternal(candidate), score: candidate.rankScore }));

  const merged = [...localScored, ...externalScored]
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(limit, localItems.length));

  const items = merged.map((entry) => entry.item).slice(0, limit);
  return {
    items,
    addedCount: Math.max(0, items.length - localItems.length),
    hasMore: localItems.length > limit || externalScored.length > 0,
  };
}

function hasStrongLocalMatch(items: SymbolRegistryItem[], query: string): boolean {
  const normalizedQuery = String(query || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalizedQuery) return false;

  return items.some((item) => {
    const symbol = String(item.symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const name = String(item.name || "").toUpperCase();
    return symbol === normalizedQuery
      || symbol.startsWith(normalizedQuery)
      || name.includes(normalizedQuery);
  });
}

// Watchlist boost: cached user portfolio symbols for search ranking
const watchlistCache = new Map<string, { symbols: Set<string>; loadedAt: number }>();
const WATCHLIST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getUserWatchlistSymbols(userId?: string): Promise<Set<string> | undefined> {
  if (!userId) return undefined;
  const cached = watchlistCache.get(userId);
  if (cached && (Date.now() - cached.loadedAt) < WATCHLIST_CACHE_TTL_MS) {
    return cached.symbols;
  }
  try {
    const portfolio = await PortfolioModel.findOne({ userId })
      .select({ holdings: 1 })
      .lean<{ holdings?: Array<{ symbol: string }> }>();
    const symbols = new Set(
      (portfolio?.holdings ?? []).map((h) => h.symbol.toUpperCase()),
    );
    watchlistCache.set(userId, { symbols, loadedAt: Date.now() });
    // Cap watchlist cache size
    if (watchlistCache.size > 1000) {
      const oldest = watchlistCache.keys().next().value as string;
      watchlistCache.delete(oldest);
    }
    return symbols.size > 0 ? symbols : undefined;
  } catch {
    return undefined;
  }
}

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
  const limit = Math.max(1, Math.min(1000, params.limit ?? 50));
  const offset = Math.max(0, params.offset ?? 0);
  const normalizedCountry = buildCountryFilterInput(params.country)?.code;
  const normalizedUserCountry = buildCountryFilterInput(params.userCountry)?.code ?? params.userCountry?.toUpperCase();
  const decodedCursor = decodeCursor(params.cursor);
  if (!decodedCursor.ok) {
    throw new Error("INVALID_CURSOR_TOKEN");
  }
  const cursor = await resolveCursorAnchor(decodedCursor.cursor);
  let searchSource:
    | "index"
    | "intelligent-db"
    | "cursor-db"
    | "index+external"
    | "intelligent-db+external"
    | "cursor-db+external"
    = "index";

  // --- INTELLIGENT SEARCH: first page uses prefix+fuzzy+clustering ---
  if (query && !cursor && !params.cursor) {
    const finalCacheKey = clusterScopedKey(
      "search",
      query.toLowerCase(),
      `${params.type ?? "all"}:${normalizedCountry ?? "all"}:${normalizedUserCountry ?? "GLOBAL"}:${limit}`,
    );

    const smartResponse = await getOrSetCachedJsonWithLock<SymbolSearchResult>(
      finalCacheKey,
      FINAL_SEARCH_CACHE_TTL_SECONDS,
      async () => {
        const watchlistSymbols = await getUserWatchlistSymbols(params.userId);
        let indexResult: SearchIndexLookupResult = { items: [], total: 0, hasMore: false, source: "prefix-index" };
        try {
          indexResult = await lookupSymbolsFromIndex({
            query,
            limit,
            type: params.type,
            country: normalizedCountry,
            userCountry: normalizedUserCountry,
            watchlistSymbols,
          });
        } catch (error) {
          logger.warn("search_index_lookup_failed", {
            query,
            message: error instanceof Error ? error.message : String(error),
          });
        }

        let smartItems: SymbolRegistryItem[] = [];
        let total = 0;
        let hasMore = false;

        if (indexResult.items.length > 0) {
          searchSource = "index";
          smartItems = indexResult.items.map((item) => {
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
              type: item.type,
              currency: item.currency,
              iconUrl: realIconUrl,
              companyDomain: item.companyDomain,
              s3Icon: item.s3Icon,
              source: item.source,
              isSynthetic: item.isSynthetic,
              popularity: item.popularity ?? 0,
              searchFrequency: item.searchFrequency,
              userUsage: item.userUsage,
              priorityScore: item.priorityScore,
              marketCap: item.marketCap,
              volume: item.volume,
              liquidityScore: item.liquidityScore,
              realIconUrl,
              fallbackIconUrl: fallbackIcon,
              isFallback,
              displayIconUrl,
            };
          });
          total = indexResult.total;
          hasMore = indexResult.hasMore;
        } else {
          searchSource = "intelligent-db";
          const intelligentCacheKey = clusterScopedKey(
            "search-candidates",
            query.toLowerCase(),
            `${params.type ?? "all"}:${normalizedCountry ?? "all"}:${limit}`,
          );

          const cachedCandidates = await getOrSetCachedJsonWithLock<{
            items: ScoredSymbol[];
            total: number;
            hasMore: boolean;
          }>(
            intelligentCacheKey,
            CACHE_TTL_SECONDS,
            async () => {
              const smartResult = await intelligentSearch({
                query,
                type: params.type,
                country: normalizedCountry,
                limit,
                userId: params.userId,
                userCountry: normalizedUserCountry,
              });
              return {
                items: smartResult.items,
                total: smartResult.total,
                hasMore: smartResult.hasMore,
              };
            },
          );

          smartItems = cachedCandidates.items.map((item) => {
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
              source: item.source,
              isSynthetic: item.isSynthetic,
              popularity: item.popularity,
              searchFrequency: item.searchFrequency,
              userUsage: item.userUsage,
              priorityScore: item.priorityScore,
              marketCap: item.marketCap,
              volume: item.volume,
              liquidityScore: item.liquidityScore,
              realIconUrl,
              fallbackIconUrl: fallbackIcon,
              isFallback,
              displayIconUrl,
            };
          });
          total = cachedCandidates.total;
          hasMore = cachedCandidates.hasMore;
        }

        let enrichedSmartItems = prioritizeMarketDataCompleteness(await enrichWithRealtimePrices(smartItems));
        let finalHasMore = hasMore;
        let finalTotal = total;

        const shouldTryExternalFallback = query.length >= 2
          && (
            enrichedSmartItems.length < Math.min(limit, 10)
            || !hasStrongLocalMatch(enrichedSmartItems, query)
          );
        if (shouldTryExternalFallback) {
          const externalCandidates = await fetchExternalSymbols(query, {
            country: normalizedCountry,
            type: params.type,
            limit: Math.max(12, limit * 2),
          }).catch((error) => {
            logger.warn("external_symbol_fetch_failed", {
              query,
              message: error instanceof Error ? error.message : String(error),
            });
            return [] as ExternalSymbolCandidate[];
          });

          if (externalCandidates.length > 0) {
            const merged = mergeLocalAndExternalResults({
              localItems: enrichedSmartItems,
              externalCandidates,
              limit,
            });
            enrichedSmartItems = merged.items;
            finalHasMore = merged.hasMore;
            finalTotal = Math.max(total, enrichedSmartItems.length);
            persistExternalSymbolsAsync(externalCandidates);
            searchSource = searchSource === "index" ? "index+external" : "intelligent-db+external";
          }
        }

        return {
          items: enrichedSmartItems,
          total: finalTotal,
          limit,
          offset: 0,
          hasMore: finalHasMore,
          nextCursor: null,
        };
      },
    );

    if (!params.skipLogoEnrichment && isRedisReady()) {
      enqueueSymbolLogoEnrichmentBatch(toQueueItems(smartResponse.items.slice(0, 20)));
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
      const elapsedMs = Date.now() - startedAt;
      for (const item of smartResponse.items) {
        recordSymbolIconResult(Boolean(item.isFallback));
      }
      recordSymbolSearchLatency(elapsedMs);
      if (elapsedMs > 50) {
        logger.warn("symbol_search_latency_slow", { query, elapsedMs, source: searchSource });
      }
    }

    return smartResponse;
  }
  // --- END INTELLIGENT SEARCH ---

  if (!query && !cursor && !params.cursor) {
    const discoveryCacheKey = clusterScopedKey(
      "search-discovery",
      `${params.type ?? "all"}:${normalizedCountry ?? "all"}:${normalizedUserCountry ?? "GLOBAL"}:${limit}`,
    );

    const discoveryResponse = await getOrSetCachedJsonWithLock<SymbolSearchResult>(
      discoveryCacheKey,
      FINAL_SEARCH_CACHE_TTL_SECONDS,
      async () => {
        const normalizedType = coerceSymbolType(params.type);
        const countryFilter = buildCountryFilterInput(normalizedCountry);
        const discoveryFilter: FilterQuery<SymbolDocument> = {};
        if (normalizedType) {
          discoveryFilter.type = normalizedType;
        }
        if (countryFilter) {
          const countryOrExchange: FilterQuery<SymbolDocument>[] = [
            { country: { $in: countryFilter.aliases } },
          ];
          if (countryFilter.exchanges.length > 0) {
            countryOrExchange.push({ exchange: { $in: countryFilter.exchanges } });
          }
          discoveryFilter.$or = countryOrExchange;
        }

        const discoveryFetchLimit = Math.min(3000, Math.max(1200, limit * 20));

        const discoveryPool = await SymbolModel.find(discoveryFilter)
          .select({
            symbol: 1,
            fullSymbol: 1,
            baseSymbol: 1,
            name: 1,
            exchange: 1,
            country: 1,
            type: 1,
            currency: 1,
            iconUrl: 1,
            companyDomain: 1,
            s3Icon: 1,
            source: 1,
            isSynthetic: 1,
            popularity: 1,
            searchFrequency: 1,
            userUsage: 1,
            priorityScore: 1,
            marketCap: 1,
            volume: 1,
            liquidityScore: 1,
            updatedAt: 1,
          })
          .sort({ priorityScore: -1, marketCap: -1, liquidityScore: -1, createdAt: -1 })
          .limit(discoveryFetchLimit)
          .lean<Array<SymbolRegistryRow>>();

        const filtered = discoveryPool.filter((item) => {
          if (normalizedType && item.type !== normalizedType) return false;
          if (!matchesCountryFlexible(item.country, item.exchange, normalizedCountry)) return false;
          return true;
        });

        const scored = filtered.map((row) => ({
          row,
          score: computeCursorRank(row, normalizedUserCountry, ""),
        })).sort((left, right) => right.score - left.score);

        const companyBest = new Map<string, { row: SymbolRegistryRow; score: number }>();
        const basesWithRealListing = new Set<string>();

        for (const entry of scored) {
          if (!isDerivativeLikeSymbol(entry.row)) {
            basesWithRealListing.add(deriveCompanyKeyFromItem(entry.row));
          }
        }

        for (const entry of scored) {
          const companyKey = deriveCompanyKeyFromItem(entry.row);
          const isDerivative = isDerivativeLikeSymbol(entry.row);
          if (isDerivative && basesWithRealListing.has(companyKey)) continue;
          const existing = companyBest.get(companyKey);
          if (!existing || entry.score > existing.score) {
            companyBest.set(companyKey, entry);
          }
        }

        const grouped = Array.from(companyBest.values())
          .sort((left, right) => right.score - left.score)
          .map((entry) => entry.row);

        const pagedRows = grouped.slice(0, limit);
        const items: SymbolRegistryItem[] = pagedRows.map((row) => {
          const staticIcon = resolveStaticIcon(row.symbol);
          const realIconUrl = row.iconUrl || row.s3Icon || staticIcon || "";
          const fallbackIcon = fallbackSymbolIconUrl(row.exchange);
          const isFallback = !realIconUrl;
          const displayIconUrl = isFallback ? fallbackIcon : realIconUrl;
          return {
            symbol: row.symbol,
            fullSymbol: row.fullSymbol,
            baseSymbol: row.baseSymbol,
            name: row.name,
            exchange: row.exchange,
            country: row.country,
            updatedAt: row.updatedAt,
            type: row.type,
            currency: row.currency,
            iconUrl: realIconUrl,
            companyDomain: row.companyDomain,
            s3Icon: row.s3Icon,
            source: row.source,
            isSynthetic: row.isSynthetic,
            popularity: row.popularity,
            searchFrequency: row.searchFrequency,
            userUsage: row.userUsage,
            priorityScore: row.priorityScore,
            marketCap: row.marketCap,
            volume: row.volume,
            liquidityScore: row.liquidityScore,
            realIconUrl,
            fallbackIconUrl: fallbackIcon,
            isFallback,
            displayIconUrl,
          };
        });

        return {
          items,
          total: grouped.length,
          limit,
          offset: 0,
          hasMore: grouped.length > limit,
          nextCursor: null,
        };
      },
    );

    if (!params.skipLogoEnrichment && isRedisReady()) {
      enqueueSymbolLogoEnrichmentBatch(toQueueItems(discoveryResponse.items.slice(0, 20)));
    }

    if (params.trackMetrics !== false) {
      const elapsedMs = Date.now() - startedAt;
      for (const item of discoveryResponse.items) {
        recordSymbolIconResult(Boolean(item.isFallback));
      }
      recordSymbolSearchLatency(elapsedMs);
      if (elapsedMs > 50) {
        logger.warn("symbol_search_latency_slow", { query, elapsedMs, source: "discovery-indexed" });
      }
    }

    return discoveryResponse;
  }

  const partition = stableHash(`${query.toLowerCase()}:${params.type ?? "all"}:${normalizedCountry ?? "all"}`);
  const cacheKey = clusterScopedKey(
    "app:symbols:search",
    partition,
    `${query.toLowerCase()}:${params.type ?? "all"}:${normalizedCountry ?? "all"}:${limit}:${params.cursor ?? `offset:${offset}`}`,
  );

  const response = await getOrSetCachedJsonWithLock<SymbolSearchResult>(cacheKey, CACHE_TTL_SECONDS, async () => {
    const baseFilter = buildFilter({ query, type: params.type, country: normalizedCountry });
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

    const candidateLimit = Math.min(240, Math.max(60, (limit + 1) * 3));

    const queryBuilder = SymbolModel.find(filter)
      .select({
        symbol: 1,
        fullSymbol: 1,
        baseSymbol: 1,
        name: 1,
        exchange: 1,
        country: 1,
        type: 1,
        currency: 1,
        iconUrl: 1,
        companyDomain: 1,
        s3Icon: 1,
        source: 1,
        isSynthetic: 1,
        popularity: 1,
        searchFrequency: 1,
        userUsage: 1,
        priorityScore: 1,
        marketCap: 1,
        volume: 1,
        liquidityScore: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .sort({ priorityScore: -1, marketCap: -1, liquidityScore: -1, volume: -1, createdAt: -1, _id: -1 })
      .limit(candidateLimit)
      .lean<Array<SymbolRegistryRow & { createdAt: Date }>>();

    if (!cursor && offset > 0) {
      queryBuilder.skip(offset);
    }

    const exactMatchFilter: FilterQuery<SymbolDocument> = {
      symbol: query.toUpperCase(),
      ...(params.type ? { type: coerceSymbolType(params.type) || params.type } : {}),
    };
    const exactCountry = buildCountryFilterInput(normalizedCountry);
    if (exactCountry) {
      const countryOrExchange: FilterQuery<SymbolDocument>[] = [
        { country: { $in: exactCountry.aliases } },
      ];
      if (exactCountry.exchanges.length > 0) {
        countryOrExchange.push({ exchange: { $in: exactCountry.exchanges } });
      }
      exactMatchFilter.$and = [{ $or: countryOrExchange }];
    }

    const [regexRows, exactRows] = await Promise.all([
      queryBuilder,
      SymbolModel.find(exactMatchFilter)
        .select({
          symbol: 1, fullSymbol: 1, baseSymbol: 1, name: 1, exchange: 1, country: 1, type: 1,
          currency: 1, iconUrl: 1, companyDomain: 1, s3Icon: 1, source: 1, isSynthetic: 1, popularity: 1,
          searchFrequency: 1, userUsage: 1, priorityScore: 1, marketCap: 1, volume: 1, liquidityScore: 1, createdAt: 1, updatedAt: 1,
        })
        .sort({ priorityScore: -1, marketCap: -1, liquidityScore: -1, createdAt: -1 })
        .limit(Math.max(10, Math.min(80, limit * 3)))
        .lean<Array<SymbolRegistryRow & { createdAt: Date }>>(),
    ]);
    const pinnedFullSymbols = new Set(exactRows.map((r) => r.fullSymbol));
    const deduped = regexRows.filter((r) => !pinnedFullSymbols.has(r.fullSymbol));
    const rows = [...exactRows, ...deduped];

    const scored = rows.map((row) => ({
      row,
      score: computeCursorRank(row, normalizedUserCountry, query),
    }));

    scored.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.row.fullSymbol.localeCompare(right.row.fullSymbol);
    });

    const companyBest = new Map<string, { row: SymbolRegistryRow & { createdAt: Date }; score: number }>();
    const basesWithRealListing = new Set<string>();

    for (const entry of scored) {
      if (!isDerivativeLikeSymbol(entry.row)) {
        basesWithRealListing.add(deriveCompanyKeyFromItem(entry.row));
      }
    }

    for (const entry of scored) {
      const companyKey = deriveCompanyKeyFromItem(entry.row);
      const isDerivative = isDerivativeLikeSymbol(entry.row);
      if (isDerivative && basesWithRealListing.has(companyKey)) continue;

      const existing = companyBest.get(companyKey);
      if (!existing || entry.score > existing.score) {
        companyBest.set(companyKey, entry);
      }
    }

    const groupedRows = Array.from(companyBest.values())
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.row.fullSymbol.localeCompare(right.row.fullSymbol);
      })
      .map((entry) => entry.row);

    const hasMore = groupedRows.length > limit;
    const pagedRows = hasMore ? groupedRows.slice(0, limit) : groupedRows;
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

    let result: SymbolSearchResult = {
      items: paged,
      total: -1,
      limit,
      offset,
      hasMore,
      nextCursor,
    };

    if (
      query
      && !cursor
      && !params.cursor
      && (paged.length < Math.min(limit, 10) || !hasStrongLocalMatch(paged, query))
    ) {
      const externalCandidates = await fetchExternalSymbols(query, {
        country: normalizedCountry,
        type: params.type,
        limit: Math.max(12, limit * 2),
      }).catch((error) => {
        logger.warn("external_symbol_fetch_failed", {
          query,
          message: error instanceof Error ? error.message : String(error),
        });
        return [] as ExternalSymbolCandidate[];
      });

      if (externalCandidates.length > 0) {
        const merged = mergeLocalAndExternalResults({
          localItems: result.items,
          externalCandidates,
          limit,
        });
        result = {
          ...result,
          items: merged.items,
          hasMore: merged.hasMore,
          total: Math.max(result.total, merged.items.length),
        };
        persistExternalSymbolsAsync(externalCandidates);
        searchSource = "cursor-db+external";
      }
    }

    return result;
  });

  if (query) {
    response.items = prioritizeMarketDataCompleteness(await enrichWithRealtimePrices(response.items));
  }

  if (!params.skipLogoEnrichment && isRedisReady() && isLogoQueueEnabled()) {
    enqueueSymbolLogoEnrichmentBatch(toQueueItems(response.items.slice(0, 20)));
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
      `${query.toLowerCase()}:${params.type ?? "all"}:${normalizedCountry ?? "all"}:${limit}:${response.nextCursor}`,
    );

    void getOrSetCachedJsonWithLock<SymbolSearchResult>(nextKey, CACHE_TTL_SECONDS, async () => {
      return searchSymbols({
        query,
        type: params.type,
        country: normalizedCountry,
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
    const elapsedMs = Date.now() - startedAt;
    for (const item of response.items) {
      recordSymbolIconResult(Boolean(item.isFallback));
    }
    recordSymbolSearchLatency(elapsedMs);
    if (elapsedMs > 50) {
      logger.warn("symbol_search_latency_slow", { query, elapsedMs, source: "cursor-db" });
    }
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
          limit: 30,
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
  if (normalized === "stocks") return "stock";
  if (normalized === "bonds") return "bond";
  if (normalized === "funds") return "etf";
  if (normalized === "options" || normalized === "futures") return "derivative";
  if (normalized === "crypto") return "crypto";
  if (normalized === "forex") return "forex";
  if (normalized === "indices") return "index";
  if (normalized === "economy") return "economy";
  return undefined;
}

export function toAssetSearchItem(symbol: SymbolRegistryItem) {
  const category = classifySearchCategory(symbol);
  const market = category === "stocks"
    ? "Stocks"
    : category === "funds"
      ? "Funds"
      : category === "futures"
        ? "Futures"
        : category === "forex"
          ? "Forex"
          : category === "crypto"
            ? "Crypto"
            : category === "indices"
              ? "Indices"
              : category === "bonds"
                ? "Bonds"
                : category === "economy"
                  ? "Economy"
                  : "Options";

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
    futureCategory: category === "futures" ? (symbol.type === "derivative" ? "index" : "commodity") : undefined,
    economyCategory: category === "economy" ? "macro" : undefined,
    expiry: (symbol as unknown as Record<string, unknown>).expiry as string | undefined,
    strike: (symbol as unknown as Record<string, unknown>).strike as string | undefined,
    underlyingAsset: (symbol as unknown as Record<string, unknown>).underlyingAsset as string | undefined,
    price: symbol.price ?? 0,
    change: symbol.change ?? 0,
    changePercent: symbol.changePercent ?? 0,
    pnl: symbol.pnl ?? symbol.change ?? 0,
    volume: symbol.volume ?? 0,
    marketCap: symbol.marketCap ?? 0,
    liquidityScore: symbol.liquidityScore ?? 0,
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
          { $divide: [{ $ifNull: ["$marketCap", 0] }, 10000000000] },
          { $divide: [{ $ifNull: ["$volume", 0] }, 1000000] },
          { $multiply: [{ $ifNull: ["$liquidityScore", 0] }, 0.8] },
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