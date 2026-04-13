import { SymbolModel } from "../models/Symbol";
import { isRedisReady, redisClient } from "../config/redis";
import { logger } from "../utils/logger";
import { type SymbolType } from "./symbol.helpers";

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
  source: "prefix-index" | "precomputed";
};

const INDEX_PREFIX_MAX = 10;
const INDEX_PREFIX_CAP = 4000;
const INDEX_DOC_LIMIT = 250000;
const INDEX_REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const INDEX_DIRTY_DEBOUNCE_MS = 5000;
const PRECOMPUTE_INTERVAL_MS = 3 * 60 * 1000;
const PRECOMPUTE_TTL_SECONDS = 180;
const PRECOMPUTE_QUERIES = ["re", "hdfc", "btc", "a", "t"];

const TOP_SYMBOL_PRIORITY: Record<string, number> = {
  RELIANCE: 18,
  TCS: 15,
  HDFCBANK: 18,
  INFY: 14,
  ICICIBANK: 14,
};

const byFullSymbol = new Map<string, SearchIndexItem>();
const byPrefix = new Map<string, string[]>();

let buildInProgress = false;
let ready = false;
let lastBuiltAt = 0;
let refreshTimer: NodeJS.Timeout | null = null;
let precomputeTimer: NodeJS.Timeout | null = null;
let dirtyRefreshTimer: NodeJS.Timeout | null = null;

function normalizeToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function generatePrefixes(value: string): string[] {
  const normalized = normalizeToken(value);
  if (!normalized) return [];
  const out: string[] = [];
  const maxLen = Math.min(INDEX_PREFIX_MAX, normalized.length);
  for (let index = 1; index <= maxLen; index += 1) {
    out.push(normalized.slice(0, index));
  }
  return out;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function staticScore(row: IndexedRow): number {
  const priority = safeNumber(row.priorityScore);
  const marketCap = safeNumber(row.marketCap);
  const volume = safeNumber(row.volume);
  const liquidity = safeNumber(row.liquidityScore);
  const popularity = safeNumber(row.popularity);
  const freq = safeNumber(row.searchFrequency);
  const baseBoost = TOP_SYMBOL_PRIORITY[row.symbol] ?? 0;

  return (
    (priority * 2.2)
    + (Math.log10(marketCap + 1) * 4.5)
    + (Math.log10(volume + 1) * 2.8)
    + (liquidity * 0.7)
    + (popularity * 0.5)
    + (freq * 0.6)
    + baseBoost
  );
}

function sortSymbols(fullSymbols: string[]): string[] {
  return fullSymbols.sort((left, right) => {
    const leftItem = byFullSymbol.get(left);
    const rightItem = byFullSymbol.get(right);
    const leftScore = leftItem?.staticScore ?? 0;
    const rightScore = rightItem?.staticScore ?? 0;
    if (rightScore !== leftScore) return rightScore - leftScore;
    return left.localeCompare(right);
  });
}

async function rebuildSearchIndex(reason: string): Promise<void> {
  if (buildInProgress) return;
  buildInProgress = true;

  try {
    const rows = await SymbolModel.find({})
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
      .limit(INDEX_DOC_LIMIT)
      .lean<IndexedRow[]>();

    const nextByFull = new Map<string, SearchIndexItem>();
    const nextByPrefix = new Map<string, string[]>();

    for (const row of rows) {
      if (!row.fullSymbol || !row.symbol || !row.name) continue;

      const symbol = normalizeToken(row.symbol);
      if (!symbol) continue;

      const fullSymbol = row.fullSymbol.toUpperCase();
      const item: SearchIndexItem = {
        symbol,
        fullSymbol,
        name: row.name,
        exchange: (row.exchange || "").toUpperCase(),
        country: (row.country || "").toUpperCase(),
        type: (row.type || "stock") as SymbolType,
        currency: (row.currency || "USD").toUpperCase(),
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
        staticScore: staticScore({ ...row, symbol }),
      };

      nextByFull.set(fullSymbol, item);

      const prefixes = new Set<string>([
        ...generatePrefixes(symbol),
        ...generatePrefixes((row.name.split(/\s+/)[0] || "")),
      ]);

      for (const prefix of prefixes) {
        const list = nextByPrefix.get(prefix) ?? [];
        list.push(fullSymbol);
        nextByPrefix.set(prefix, list);
      }
    }

    byFullSymbol.clear();
    for (const [key, value] of nextByFull.entries()) {
      byFullSymbol.set(key, value);
    }

    byPrefix.clear();
    for (const [prefix, fullSymbols] of nextByPrefix.entries()) {
      const sorted = sortSymbols(fullSymbols);
      byPrefix.set(prefix, sorted.slice(0, INDEX_PREFIX_CAP));
    }

    lastBuiltAt = Date.now();
    ready = true;

    logger.info("search_index_rebuilt", {
      reason,
      symbols: byFullSymbol.size,
      prefixes: byPrefix.size,
      lastBuiltAt,
    });
  } catch (error) {
    logger.error("search_index_rebuild_failed", {
      reason,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    buildInProgress = false;
  }
}

function queryBonus(item: SearchIndexItem, query: string): number {
  const upperQuery = query.toUpperCase();
  const symbol = item.symbol.toUpperCase();
  const fullSymbol = item.fullSymbol.toUpperCase();
  const name = item.name.toUpperCase();

  if (symbol === upperQuery) return 180;
  if (fullSymbol === upperQuery) return 170;
  if (symbol.startsWith(upperQuery)) return 90;
  if (name.startsWith(upperQuery)) return 55;
  if (name.includes(upperQuery)) return 28;
  if (fullSymbol.includes(upperQuery)) return 18;
  return 0;
}

function matchesFilter(item: SearchIndexItem, type?: string, country?: string): boolean {
  if (type && type !== "all" && item.type !== type) return false;
  if (country && country !== "all" && item.country !== country.toUpperCase()) return false;
  return true;
}

function precomputedKey(query: string): string {
  return `precomputed:${query.toLowerCase()}`;
}

export async function refreshPrecomputedQueries(): Promise<void> {
  if (!ready || !isRedisReady()) return;

  for (const query of PRECOMPUTE_QUERIES) {
    // eslint-disable-next-line no-await-in-loop
    const result = await lookupSymbolsFromIndex({ query, limit: 30, disablePrecomputed: true });
    const payload = JSON.stringify({
      query,
      fullSymbols: result.items.map((item) => item.fullSymbol),
      builtAt: Date.now(),
    });
    // eslint-disable-next-line no-await-in-loop
    await redisClient.set(precomputedKey(query), payload, "EX", PRECOMPUTE_TTL_SECONDS);
  }
}

async function lookupPrecomputed(query: string, limit: number, type?: string, country?: string): Promise<SearchIndexLookupResult | null> {
  if (!isRedisReady()) return null;
  if (type || country) return null;

  try {
    const raw = await redisClient.get(precomputedKey(query));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { fullSymbols?: string[] };
    if (!Array.isArray(parsed.fullSymbols) || parsed.fullSymbols.length === 0) return null;

    const items = parsed.fullSymbols
      .map((fullSymbol) => byFullSymbol.get(fullSymbol))
      .filter((item): item is SearchIndexItem => Boolean(item))
      .slice(0, limit);

    if (!items.length) return null;

    return {
      items,
      total: parsed.fullSymbols.length,
      hasMore: parsed.fullSymbols.length > limit,
      source: "precomputed",
    };
  } catch {
    return null;
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
  if (!ready || !normalizedQuery) {
    return { items: [], total: 0, hasMore: false, source: "prefix-index" };
  }

  if (!params.disablePrecomputed) {
    const precomputed = await lookupPrecomputed(
      normalizedQuery.toLowerCase(),
      params.limit,
      params.type,
      params.country,
    );
    if (precomputed) return precomputed;
  }

  const prefixKey = normalizedQuery.slice(0, Math.min(INDEX_PREFIX_MAX, normalizedQuery.length));
  const candidates = byPrefix.get(prefixKey) ?? [];
  if (!candidates.length) {
    return { items: [], total: 0, hasMore: false, source: "prefix-index" };
  }

  const scored: Array<{ item: SearchIndexItem; score: number }> = [];
  const maxScan = Math.min(candidates.length, INDEX_PREFIX_CAP);

  for (let index = 0; index < maxScan; index += 1) {
    const item = byFullSymbol.get(candidates[index]!);
    if (!item) continue;
    if (!matchesFilter(item, params.type, params.country)) continue;

    const bonus = queryBonus(item, normalizedQuery);
    if (bonus <= 0 && !item.symbol.startsWith(normalizedQuery)) continue;

    scored.push({ item, score: item.staticScore + bonus });
  }

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.item.fullSymbol.localeCompare(right.item.fullSymbol);
  });

  const items = scored.slice(0, params.limit).map((entry) => entry.item);

  return {
    items,
    total: scored.length,
    hasMore: scored.length > params.limit,
    source: "prefix-index",
  };
}

export function isSearchIndexReady(): boolean {
  return ready;
}

export function markSearchIndexDirty(reason = "symbol_write"): void {
  if (dirtyRefreshTimer) return;
  dirtyRefreshTimer = setTimeout(() => {
    dirtyRefreshTimer = null;
    void rebuildSearchIndex(`dirty:${reason}`);
  }, INDEX_DIRTY_DEBOUNCE_MS);
  dirtyRefreshTimer.unref();
}

export async function startSearchIndexService(): Promise<void> {
  await rebuildSearchIndex("startup");
  await refreshPrecomputedQueries();

  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      void rebuildSearchIndex("interval");
    }, INDEX_REFRESH_INTERVAL_MS);
    refreshTimer.unref();
  }

  if (!precomputeTimer) {
    precomputeTimer = setInterval(() => {
      void refreshPrecomputedQueries();
    }, PRECOMPUTE_INTERVAL_MS);
    precomputeTimer.unref();
  }
}