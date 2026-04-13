import { SymbolModel } from "../models/Symbol";
import { isRedisReady, redisClient } from "../config/redis";
import { logger } from "../utils/logger";
import { SEARCH_PRECACHE_QUERIES, type SymbolType } from "./symbol.helpers";
import { recordMemoryUsage } from "./metrics.service";

type IndexedRow = {
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
  source?: string;
  isSynthetic?: boolean;
  popularity?: number;
  searchFrequency?: number;
  userUsage?: number;
  priorityScore?: number;
  marketCap?: number;
  volume?: number;
  liquidityScore?: number;
};

export type SearchIndexItem = IndexedRow & {
  staticScore: number;
};

export type SearchIndexLookupResult = {
  items: SearchIndexItem[];
  total: number;
  hasMore: boolean;
  source: string;
};

type PrefixCacheEntry = {
  prefix: string;
  items: SearchIndexItem[];
  builtAt: number;
  lastAccessedAt: number;
};

const MAX_RESULTS = 30;
const MAX_SYMBOLS_PER_PREFIX = envNumber("MAX_SYMBOLS_PER_PREFIX", 50);
const PREFIX_KEY_LENGTH = envNumber("SEARCH_INDEX_PREFIX_KEY_LENGTH", 3);
const PREFIX_DB_FETCH_LIMIT = envNumber("SEARCH_INDEX_PREFIX_FETCH_LIMIT", 1200);
const PREFIX_CACHE_TTL_MS = envNumber("SEARCH_INDEX_PREFIX_CACHE_TTL_MS", 5 * 60 * 1000);
const PREFIX_CACHE_MAX_ENTRIES = envNumber("SEARCH_INDEX_PREFIX_CACHE_MAX_ENTRIES", 180);
const HOT_PREFIX_PREWARM_LIMIT = envNumber("SEARCH_INDEX_HOT_PREFIX_PREWARM_LIMIT", 12);

const PRECOMPUTE_TTL_SECONDS = envNumber("SEARCH_PRECOMPUTE_TTL_SECONDS", 300);
const PRECOMPUTE_INTERVAL_MS = envNumber("SEARCH_PRECOMPUTE_INTERVAL_MS", 300_000);
const HOT_PREFIX_REFRESH_MS = envNumber("SEARCH_INDEX_HOT_PREFIX_REFRESH_MS", 120_000);
const PREFIX_CACHE_SWEEP_MS = envNumber("SEARCH_INDEX_PREFIX_CACHE_SWEEP_MS", 60_000);

const PRECOMPUTE_QUERIES = Array.from(new Set(SEARCH_PRECACHE_QUERIES.map((query) => query.toLowerCase())));

const prefixCache = new Map<string, PrefixCacheEntry>();
const loadingPrefixes = new Map<string, Promise<PrefixCacheEntry>>();

let ready = false;
let dirtyRefreshTimer: NodeJS.Timeout | null = null;
let precomputeTimer: NodeJS.Timeout | null = null;
let hotPrefixTimer: NodeJS.Timeout | null = null;
let sweepTimer: NodeJS.Timeout | null = null;

function envNumber(key: string, fallback: number): number {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeToken(raw: string): string {
  return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function prefixFromQuery(query: string): string {
  const normalized = normalizeToken(query);
  if (!normalized) return "";
  return normalized.slice(0, Math.min(PREFIX_KEY_LENGTH, normalized.length));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function memoryUsageMb(): { heapUsedMb: number; rssMb: number } {
  const usage = process.memoryUsage();
  return {
    heapUsedMb: Number((usage.heapUsed / (1024 * 1024)).toFixed(2)),
    rssMb: Number((usage.rss / (1024 * 1024)).toFixed(2)),
  };
}

function recordCurrentMemory(): void {
  const mem = memoryUsageMb();
  recordMemoryUsage(mem.heapUsedMb, mem.rssMb);
}

function touchPrefixEntry(prefix: string, entry: PrefixCacheEntry): PrefixCacheEntry {
  const touched: PrefixCacheEntry = {
    ...entry,
    lastAccessedAt: Date.now(),
  };
  prefixCache.delete(prefix);
  prefixCache.set(prefix, touched);
  return touched;
}

function prunePrefixCache(): void {
  const now = Date.now();

  for (const [prefix, entry] of prefixCache.entries()) {
    if (now - entry.builtAt > PREFIX_CACHE_TTL_MS) {
      prefixCache.delete(prefix);
    }
  }

  while (prefixCache.size > PREFIX_CACHE_MAX_ENTRIES) {
    const oldestPrefix = prefixCache.keys().next().value as string | undefined;
    if (!oldestPrefix) break;
    prefixCache.delete(oldestPrefix);
  }

  recordCurrentMemory();
}

function clearPrefixCache(reason: string): void {
  prefixCache.clear();
  logger.info("search_index_prefix_cache_cleared", { reason });
  recordCurrentMemory();
}

function staticScore(row: IndexedRow, normalizedSymbol: string): number {
  let score = 0;
  score += safeNumber(row.priorityScore) * 3.2;
  score += safeNumber(row.searchFrequency) * 1.8;
  score += safeNumber(row.userUsage) * 1.2;
  score += safeNumber(row.popularity) * 0.6;
  score += Math.log10(safeNumber(row.marketCap) + 1) * 7;
  score += Math.log10(safeNumber(row.volume) + 1) * 5;
  score += safeNumber(row.liquidityScore) * 2.5;

  if (row.type === "stock") score += 12;
  if (row.type === "etf") score += 8;
  if (row.type === "crypto") score += 5;
  if (row.type === "derivative") score -= 16;
  if (row.isSynthetic) score -= 28;
  if (normalizedSymbol.length <= 4) score += 5;

  // Tiny exchange preference to break ties (NSE > BSE, NYSE > NASDAQ etc.)
  const exPref: Record<string, number> = { NSE: 0.02, NYSE: 0.02, CRYPTO: 0.015, NASDAQ: 0.01, BSE: 0.01 };
  score += exPref[String(row.exchange).toUpperCase()] ?? 0;

  return Number(score.toFixed(4));
}

function queryBonus(item: SearchIndexItem, query: string): number {
  if (!query) return 0;

  const normalizedSymbol = normalizeToken(item.symbol);
  const fullSymbol = item.fullSymbol.toUpperCase();
  const name = item.name.toUpperCase();

  // Kept low so staticScore (popularity/marketCap/priority) dominates ranking.
  // A mega-cap prefix match must beat a micro-cap exact match.
  if (normalizedSymbol === query) return 50;
  if (fullSymbol === query || fullSymbol.endsWith(`:${query}`)) return 40;
  if (normalizedSymbol.startsWith(query)) return 30 - Math.min(10, normalizedSymbol.length - query.length);

  const firstNameToken = normalizeToken(name.split(/\s+/)[0] || "");
  if (firstNameToken && firstNameToken.startsWith(query)) return 20;
  if (name.includes(query)) return 12;
  if (fullSymbol.includes(query)) return 8;

  return 0;
}

function matchesFilter(item: SearchIndexItem, type?: string, country?: string): boolean {
  if (type && type !== "all" && item.type !== type) return false;
  if (country && country !== "all" && item.country !== country.toUpperCase()) return false;
  return true;
}

function toSearchIndexItem(row: IndexedRow): SearchIndexItem | null {
  const symbol = normalizeToken(row.symbol);
  const fullSymbol = String(row.fullSymbol || "").toUpperCase();

  if (!symbol || !fullSymbol || !row.name) return null;

  return {
    symbol,
    fullSymbol,
    name: String(row.name || ""),
    exchange: String(row.exchange || "").toUpperCase(),
    country: String(row.country || "").toUpperCase(),
    type: (row.type || "stock") as SymbolType,
    currency: String(row.currency || "USD").toUpperCase(),
    iconUrl: row.iconUrl || "",
    companyDomain: row.companyDomain || "",
    s3Icon: row.s3Icon || "",
    source: row.source || "",
    isSynthetic: Boolean(row.isSynthetic),
    popularity: safeNumber(row.popularity),
    searchFrequency: safeNumber(row.searchFrequency),
    userUsage: safeNumber(row.userUsage),
    priorityScore: safeNumber(row.priorityScore),
    marketCap: safeNumber(row.marketCap),
    volume: safeNumber(row.volume),
    liquidityScore: safeNumber(row.liquidityScore),
    staticScore: staticScore(row, symbol),
  };
}

async function buildPrefixItems(prefix: string): Promise<SearchIndexItem[]> {
  const escaped = escapeRegex(prefix);

  const docs = await SymbolModel.find({
    $or: [
      { symbol: { $regex: `^${escaped}`, $options: "i" } },
      { fullSymbol: { $regex: `:${escaped}`, $options: "i" } },
      { name: { $regex: `\\b${escaped}`, $options: "i" } },
    ],
  })
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
      source: 1,
      isSynthetic: 1,
      popularity: 1,
      searchFrequency: 1,
      userUsage: 1,
      priorityScore: 1,
      marketCap: 1,
      volume: 1,
      liquidityScore: 1,
    })
    .sort({ priorityScore: -1 })
    .limit(PREFIX_DB_FETCH_LIMIT)
    .lean<IndexedRow[]>();

  const scored = new Map<string, { item: SearchIndexItem; score: number }>();

  for (const row of docs) {
    const item = toSearchIndexItem(row);
    if (!item) continue;

    const score = item.staticScore + queryBonus(item, prefix);
    const existing = scored.get(item.fullSymbol);
    if (!existing || score > existing.score) {
      scored.set(item.fullSymbol, { item, score });
    }
  }

  const ranked = Array.from(scored.values())
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.item.fullSymbol.localeCompare(right.item.fullSymbol);
    })
    .map((entry) => entry.item);

  // Keep prefix nodes bounded for memory safety.
  while (ranked.length > MAX_SYMBOLS_PER_PREFIX) {
    ranked.pop();
  }

  return ranked;
}

async function loadPrefixEntry(prefix: string, reason: string): Promise<PrefixCacheEntry> {
  const cached = prefixCache.get(prefix);
  if (cached && (Date.now() - cached.builtAt) <= PREFIX_CACHE_TTL_MS) {
    return touchPrefixEntry(prefix, cached);
  }

  const inFlight = loadingPrefixes.get(prefix);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    try {
      const items = await buildPrefixItems(prefix);
      const entry: PrefixCacheEntry = {
        prefix,
        items,
        builtAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      prefixCache.set(prefix, entry);
      prunePrefixCache();

      logger.info("search_index_prefix_built", {
        prefix,
        reason,
        matched: items.length,
        cacheSize: prefixCache.size,
      });

      return entry;
    } finally {
      loadingPrefixes.delete(prefix);
    }
  })();

  loadingPrefixes.set(prefix, promise);
  return promise;
}

function precomputedKey(query: string): string {
  return `search:precomputed:${query.toLowerCase()}`;
}

async function lookupPrecomputed(
  query: string,
  limit: number,
  type?: string,
  country?: string,
): Promise<SearchIndexLookupResult | null> {
  if (!isRedisReady()) return null;
  if (type || country) return null;

  try {
    const raw = await redisClient.get(precomputedKey(query));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { items?: SearchIndexItem[] };
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;

    const capped = Math.min(limit, MAX_RESULTS);
    const items = parsed.items.slice(0, capped);

    return {
      items,
      total: parsed.items.length,
      hasMore: parsed.items.length > capped,
      source: "precomputed",
    };
  } catch {
    return null;
  }
}

async function prewarmHotPrefixes(): Promise<void> {
  const hotPrefixes = Array.from(
    new Set(
      PRECOMPUTE_QUERIES
        .map((query) => prefixFromQuery(query))
        .filter(Boolean),
    ),
  ).slice(0, HOT_PREFIX_PREWARM_LIMIT);

  for (const prefix of hotPrefixes) {
    // eslint-disable-next-line no-await-in-loop
    await loadPrefixEntry(prefix, "hot_prewarm");
  }
}

export async function lookupSymbolsFromIndex(params: {
  query: string;
  limit: number;
  type?: string;
  country?: string;
  disablePrecomputed?: boolean;
}): Promise<SearchIndexLookupResult> {
  const normalizedQuery = normalizeToken(params.query);
  const cappedLimit = Math.max(1, Math.min(MAX_RESULTS, params.limit));

  if (!normalizedQuery) {
    return { items: [], total: 0, hasMore: false, source: "lazy-prefix-index" };
  }

  if (!params.disablePrecomputed) {
    const precomputed = await lookupPrecomputed(
      normalizedQuery.toLowerCase(),
      cappedLimit,
      params.type,
      params.country,
    );
    if (precomputed) return precomputed;
  }

  const prefix = prefixFromQuery(normalizedQuery);
  if (!prefix) {
    return { items: [], total: 0, hasMore: false, source: "lazy-prefix-index" };
  }

  const entry = await loadPrefixEntry(prefix, "query_lookup");
  const scored: Array<{ item: SearchIndexItem; score: number }> = [];

  for (const item of entry.items) {
    if (!matchesFilter(item, params.type, params.country)) continue;

    const bonus = queryBonus(item, normalizedQuery);
    if (bonus <= 0 && !normalizeToken(item.symbol).startsWith(normalizedQuery)) continue;

    scored.push({ item, score: item.staticScore + bonus });
  }

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.item.fullSymbol.localeCompare(right.item.fullSymbol);
  });

  const items = scored.slice(0, cappedLimit).map((entryItem) => entryItem.item);

  return {
    items,
    total: scored.length,
    hasMore: scored.length > cappedLimit,
    source: "lazy-prefix-index",
  };
}

export async function refreshPrecomputedQueries(): Promise<void> {
  if (!isRedisReady()) return;

  for (const query of PRECOMPUTE_QUERIES) {
    // eslint-disable-next-line no-await-in-loop
    const result = await lookupSymbolsFromIndex({
      query,
      limit: MAX_RESULTS,
      disablePrecomputed: true,
    });

    const payload = JSON.stringify({
      query,
      items: result.items,
      builtAt: Date.now(),
    });

    // eslint-disable-next-line no-await-in-loop
    await redisClient.set(precomputedKey(query), payload, "EX", PRECOMPUTE_TTL_SECONDS);
  }
}

export function isSearchIndexReady(): boolean {
  return ready;
}

export function markSearchIndexDirty(reason = "symbol_write"): void {
  if (dirtyRefreshTimer) return;

  dirtyRefreshTimer = setTimeout(() => {
    dirtyRefreshTimer = null;
    clearPrefixCache(`dirty:${reason}`);
    void prewarmHotPrefixes();
    void refreshPrecomputedQueries();
  }, 1200);
  dirtyRefreshTimer.unref();
}

export async function startSearchIndexService(): Promise<void> {
  ready = true;
  await prewarmHotPrefixes();
  await refreshPrecomputedQueries();

  if (!hotPrefixTimer) {
    hotPrefixTimer = setInterval(() => {
      void prewarmHotPrefixes();
    }, HOT_PREFIX_REFRESH_MS);
    hotPrefixTimer.unref();
  }

  if (!precomputeTimer) {
    precomputeTimer = setInterval(() => {
      void refreshPrecomputedQueries();
    }, PRECOMPUTE_INTERVAL_MS);
    precomputeTimer.unref();
  }

  if (!sweepTimer) {
    sweepTimer = setInterval(() => {
      prunePrefixCache();
    }, PREFIX_CACHE_SWEEP_MS);
    sweepTimer.unref();
  }

  logger.info("search_index_lazy_service_started", {
    maxSymbolsPerPrefix: MAX_SYMBOLS_PER_PREFIX,
    prefixCacheTtlMs: PREFIX_CACHE_TTL_MS,
    maxPrefixCacheEntries: PREFIX_CACHE_MAX_ENTRIES,
  });
}
