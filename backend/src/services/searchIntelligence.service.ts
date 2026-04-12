import levenshtein from "fast-levenshtein";
import { FilterQuery, Types } from "mongoose";
import { SymbolDocument, SymbolModel } from "../models/Symbol";
import { redisClient, isRedisReady } from "../config/redis";
import { clusterScopedKey } from "./redisKey.service";

// --- prefix generation ---

export function generatePrefixes(value: string): string[] {
  const upper = value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  const prefixes: string[] = [];
  for (let i = 1; i <= upper.length && i <= 10; i++) {
    prefixes.push(upper.slice(0, i));
  }
  return prefixes;
}

export function extractBaseSymbol(rawSymbol: string): string {
  const upper = rawSymbol.trim().toUpperCase();
  const withoutExchange = upper.includes(":") ? upper.split(":").pop()! : upper;
  const [head] = withoutExchange.split(/[.$]/);
  return head || upper;
}

// --- sector keyword map (AI suggestions phase 1) ---

const SECTOR_MAP: Record<string, string[]> = {
  bank: ["HDFCBANK", "ICICIBANK", "KOTAKBANK", "SBIN", "AXISBANK", "INDUSINDBK", "JPM", "BAC", "GS", "C"],
  tech: ["TCS", "INFY", "WIPRO", "HCLTECH", "TECHM", "AAPL", "MSFT", "GOOG", "META", "AMZN"],
  auto: ["TATAMOTORS", "MARUTI", "M&M", "HEROMOTOCO", "BAJAJ-AUTO", "TSLA", "F", "GM", "TM"],
  pharma: ["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "LUPIN", "JNJ", "PFE", "MRK", "ABBV"],
  energy: ["RELIANCE", "ONGC", "BPCL", "IOC", "NTPC", "XOM", "CVX", "COP", "SLB"],
  metal: ["TATASTEEL", "HINDALCO", "JSWSTEEL", "VEDL", "COALINDIA", "NUE", "FCX", "CLF"],
  fmcg: ["HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "DABUR", "PG", "KO", "PEP", "MDLZ"],
  finance: ["BAJFINANCE", "BAJAJFINSV", "HDFC", "SBILIFE", "ICICIPRULI", "BRK.B", "V", "MA", "AXP"],
  it: ["TCS", "INFY", "WIPRO", "HCLTECH", "TECHM", "AAPL", "MSFT", "GOOG", "META", "AMZN"],
  oil: ["RELIANCE", "ONGC", "BPCL", "IOC", "XOM", "CVX", "COP", "SLB"],
  crypto: ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "MATIC", "DOT", "AVAX", "LINK"],
  semiconductor: ["NVDA", "AMD", "INTC", "TSM", "AVGO", "QCOM", "MU", "ASML", "LRCX"],
  ev: ["TSLA", "RIVN", "LCID", "NIO", "XPEV", "LI", "FSR"],
  ai: ["NVDA", "MSFT", "GOOG", "META", "AMD", "PLTR", "AI", "SNOW", "CRM"],
};

// --- exchange boost by country ---

const EXCHANGE_BOOST: Record<string, Record<string, number>> = {
  IN: { NSE: 20, BSE: 10 },
  US: { NASDAQ: 15, NYSE: 15 },
  GB: { LSE: 15 },
  JP: { TYO: 15 },
  DE: { FRA: 10 },
  GLOBAL: { NASDAQ: 10, NYSE: 10, NSE: 5 },
};

// --- recent symbols (Redis-backed) ---

const RECENT_CAP = 20;
const RECENT_TTL = 60 * 60 * 24 * 30; // 30 days

export async function trackRecentSymbol(userId: string, fullSymbol: string): Promise<void> {
  if (!isRedisReady() || !userId) return;
  const key = clusterScopedKey("app:user", userId, "recent");
  try {
    await redisClient.lrem(key, 0, fullSymbol);
    await redisClient.lpush(key, fullSymbol);
    await redisClient.ltrim(key, 0, RECENT_CAP - 1);
    await redisClient.expire(key, RECENT_TTL);
  } catch {
    // Non-critical; do not block search.
  }
}

export async function getRecentSymbols(userId: string): Promise<string[]> {
  if (!isRedisReady() || !userId) return [];
  const key = clusterScopedKey("app:user", userId, "recent");
  try {
    return await redisClient.lrange(key, 0, RECENT_CAP - 1);
  } catch {
    return [];
  }
}

// --- watchlist (Redis-backed) ---

const WATCHLIST_TTL = 60 * 5; // 5 min cache

export async function cacheUserWatchlist(userId: string, symbols: string[]): Promise<void> {
  if (!isRedisReady() || !userId) return;
  const key = clusterScopedKey("app:user", userId, "watchlist");
  try {
    if (symbols.length === 0) {
      await redisClient.del(key);
      return;
    }
    await redisClient.del(key);
    await redisClient.sadd(key, ...symbols);
    await redisClient.expire(key, WATCHLIST_TTL);
  } catch {
    // Non-critical.
  }
}

export async function getUserWatchlist(userId: string): Promise<Set<string>> {
  if (!isRedisReady() || !userId) return new Set();
  const key = clusterScopedKey("app:user", userId, "watchlist");
  try {
    const members = await redisClient.smembers(key);
    return new Set(members);
  } catch {
    return new Set();
  }
}

// --- scoring ---

interface ScoredSymbol {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency: string;
  iconUrl: string;
  companyDomain: string;
  s3Icon: string;
  popularity: number;
  searchFrequency: number;
  priorityScore: number;
  baseSymbol: string;
  _score: number;
  _matchType: "exact" | "prefix" | "fuzzy" | "name" | "sector";
  _id: Types.ObjectId;
  createdAt: Date;
}

export type { ScoredSymbol };

function computeRelevanceScore(opts: {
  matchType: "exact" | "prefix" | "fuzzy" | "name" | "sector";
  fuzzyDistance?: number;
  priorityScore: number;
  exchangeBoost: number;
  recencyBoost: number;
  watchlistBoost: number;
}): number {
  const matchWeights: Record<string, number> = {
    exact: 100,
    prefix: 50,
    name: 20,
    fuzzy: 30,
    sector: 15,
  };
  const matchScore = matchWeights[opts.matchType] ?? 0;
  const fuzzyPenalty = opts.fuzzyDistance ? opts.fuzzyDistance * 10 : 0;

  return (
    matchScore
    - fuzzyPenalty
    + opts.priorityScore
    + opts.exchangeBoost
    + opts.recencyBoost
    + opts.watchlistBoost
  );
}

// --- main intelligent search ---

export interface IntelligentSearchParams {
  query: string;
  type?: string;
  country?: string;
  limit?: number;
  userId?: string;
  userCountry?: string;
}

export interface IntelligentSearchResult {
  items: ScoredSymbol[];
  clusters: Record<string, ScoredSymbol[]>;
  total: number;
  hasMore: boolean;
  matchBreakdown: {
    exact: number;
    prefix: number;
    fuzzy: number;
    name: number;
    sector: number;
  };
}

const SELECT_FIELDS = {
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
  priorityScore: 1,
  baseSymbol: 1,
  createdAt: 1,
};

type RawRow = {
  _id: Types.ObjectId;
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency: string;
  iconUrl: string;
  companyDomain: string;
  s3Icon: string;
  popularity: number;
  searchFrequency: number;
  priorityScore: number;
  baseSymbol: string;
  createdAt: Date;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function intelligentSearch(params: IntelligentSearchParams): Promise<IntelligentSearchResult> {
  const query = params.query.trim();
  const limit = Math.max(1, Math.min(100, params.limit ?? 50));
  const upperQuery = query.toUpperCase();

  if (!query) {
    return { items: [], clusters: {}, total: 0, hasMore: false, matchBreakdown: { exact: 0, prefix: 0, fuzzy: 0, name: 0, sector: 0 } };
  }

  const [recentSymbols, watchlist] = await Promise.all([
    params.userId ? getRecentSymbols(params.userId) : Promise.resolve([] as string[]),
    params.userId ? getUserWatchlist(params.userId) : Promise.resolve(new Set<string>()),
  ]);

  const countryCode = (params.userCountry || "GLOBAL").toUpperCase();
  const exchangeBoosts = EXCHANGE_BOOST[countryCode] || EXCHANGE_BOOST.GLOBAL || {};

  const typeFilter: FilterQuery<SymbolDocument> = {};
  if (params.type) {
    const t = params.type.toLowerCase();
    if (["stock", "crypto", "forex", "index"].includes(t)) typeFilter.type = t;
  }
  if (params.country) typeFilter.country = params.country.toUpperCase();

  // PHASE 1: Exact match (O(1) via index)
  const exactRows = await SymbolModel.find({
    symbol: upperQuery,
    ...typeFilter,
  })
    .select(SELECT_FIELDS)
    .sort({ priorityScore: -1 })
    .limit(10)
    .lean<RawRow[]>();

  // PHASE 2: Prefix match (O(1) via indexed searchPrefixes)
  const prefixRows = await SymbolModel.find({
    searchPrefixes: upperQuery,
    ...typeFilter,
  })
    .select(SELECT_FIELDS)
    .sort({ priorityScore: -1, createdAt: -1 })
    .limit(200)
    .lean<RawRow[]>();

  // PHASE 3: Name match (partial name search, limited)
  const nameRows = await SymbolModel.find({
    name: { $regex: escapeRegex(query), $options: "i" },
    ...typeFilter,
  })
    .select(SELECT_FIELDS)
    .sort({ priorityScore: -1 })
    .limit(100)
    .lean<RawRow[]>();

  // Deduplicate
  const seen = new Map<string, ScoredSymbol>();

  function addRows(rows: RawRow[], matchType: "exact" | "prefix" | "name") {
    for (const row of rows) {
      if (seen.has(row.fullSymbol)) {
        const existing = seen.get(row.fullSymbol)!;
        const order: Record<string, number> = { exact: 3, prefix: 2, name: 1, fuzzy: 0, sector: 0 };
        if ((order[matchType] ?? 0) > (order[existing._matchType] ?? 0)) {
          existing._matchType = matchType;
        }
        continue;
      }
      seen.set(row.fullSymbol, {
        ...row,
        iconUrl: row.iconUrl || "",
        companyDomain: row.companyDomain || "",
        s3Icon: row.s3Icon || "",
        baseSymbol: row.baseSymbol || extractBaseSymbol(row.symbol),
        _score: 0,
        _matchType: matchType,
      });
    }
  }

  addRows(exactRows, "exact");
  addRows(prefixRows, "prefix");
  addRows(nameRows, "name");

  // PHASE 4: Fuzzy search (only on limited candidates, Levenshtein distance <= 2)
  if (query.length >= 3) {
    if (seen.size < 50) {
      const topSymbols = await SymbolModel.find({
        symbol: { $regex: `^${escapeRegex(upperQuery.slice(0, 2))}`, $options: "i" },
        ...typeFilter,
      })
        .select(SELECT_FIELDS)
        .sort({ priorityScore: -1 })
        .limit(100)
        .lean<RawRow[]>();

      for (const row of topSymbols) {
        if (!seen.has(row.fullSymbol)) {
          const dist = levenshtein.get(upperQuery, row.symbol);
          if (dist <= 2) {
            seen.set(row.fullSymbol, {
              ...row,
              iconUrl: row.iconUrl || "",
              companyDomain: row.companyDomain || "",
              s3Icon: row.s3Icon || "",
              baseSymbol: row.baseSymbol || extractBaseSymbol(row.symbol),
              _score: 0,
              _matchType: "fuzzy",
            });
          }
        }
      }
    }

    for (const item of seen.values()) {
      if (item._matchType !== "exact") {
        const dist = levenshtein.get(upperQuery, item.symbol);
        if (dist <= 2 && item._matchType === "name") {
          item._matchType = "fuzzy";
        }
      }
    }
  }

  // PHASE 5: AI sector suggestions
  const lowerQuery = query.toLowerCase();
  const sectorSymbols = SECTOR_MAP[lowerQuery];
  if (sectorSymbols) {
    const sectorRows = await SymbolModel.find({
      symbol: { $in: sectorSymbols },
      ...typeFilter,
    })
      .select(SELECT_FIELDS)
      .sort({ priorityScore: -1 })
      .limit(50)
      .lean<RawRow[]>();

    for (const row of sectorRows) {
      if (!seen.has(row.fullSymbol)) {
        seen.set(row.fullSymbol, {
          ...row,
          iconUrl: row.iconUrl || "",
          companyDomain: row.companyDomain || "",
          s3Icon: row.s3Icon || "",
          baseSymbol: row.baseSymbol || extractBaseSymbol(row.symbol),
          _score: 0,
          _matchType: "sector",
        });
      }
    }
  }

  // PHASE 6: Score everything
  const allItems = Array.from(seen.values());

  for (const item of allItems) {
    const recentIndex = recentSymbols.indexOf(item.fullSymbol);
    const recencyBoost = recentIndex >= 0 ? 40 / (1 + recentIndex) : 0;
    const watchlistBoost = watchlist.has(item.fullSymbol) ? 60 : 0;
    const exchangeBoost = exchangeBoosts[item.exchange] ?? 0;
    const fuzzyDist = item._matchType === "fuzzy" ? levenshtein.get(upperQuery, item.symbol) : 0;

    item._score = computeRelevanceScore({
      matchType: item._matchType,
      fuzzyDistance: fuzzyDist,
      priorityScore: item.priorityScore,
      exchangeBoost,
      recencyBoost,
      watchlistBoost,
    });
  }

  // PHASE 7: Sort and cluster
  allItems.sort((a, b) => b._score - a._score);

  const clusters: Record<string, ScoredSymbol[]> = {};
  for (const item of allItems) {
    const base = item.baseSymbol || item.symbol;
    if (!clusters[base]) clusters[base] = [];
    clusters[base]!.push(item);
  }

  const matchBreakdown = { exact: 0, prefix: 0, fuzzy: 0, name: 0, sector: 0 };
  for (const item of allItems) {
    matchBreakdown[item._matchType]++;
  }

  const limited = allItems.slice(0, limit);

  return {
    items: limited,
    clusters,
    total: allItems.length,
    hasMore: allItems.length > limit,
    matchBreakdown,
  };
}

// --- prefix bootstrap (for migration) ---

export async function bootstrapSearchPrefixes(batchSize = 1000): Promise<{ updated: number }> {
  let updated = 0;
  let lastId: Types.ObjectId | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query: FilterQuery<SymbolDocument> = lastId ? { _id: { $gt: lastId } } : {};
    const batch = await SymbolModel.find(query)
      .select({ _id: 1, symbol: 1, fullSymbol: 1, name: 1 })
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean<Array<{ _id: Types.ObjectId; symbol: string; fullSymbol: string; name: string }>>();

    if (batch.length === 0) break;

    const ops = batch.map((doc) => {
      const base = extractBaseSymbol(doc.symbol);
      const symbolPrefixes = generatePrefixes(doc.symbol);
      const basePrefixes = base !== doc.symbol ? generatePrefixes(base) : [];
      const namePrefixes = generatePrefixes(doc.name.split(/\s+/)[0] || "");
      const allPrefixes = [...new Set([...symbolPrefixes, ...basePrefixes, ...namePrefixes])];

      return {
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              searchPrefixes: allPrefixes,
              baseSymbol: base,
            },
          },
        },
      };
    });

    await SymbolModel.bulkWrite(ops, { ordered: false });
    updated += batch.length;
    lastId = batch[batch.length - 1]!._id;
  }

  return { updated };
}

// --- hook: auto-generate prefixes on new symbols ---

export function computePrefixesForSymbol(symbol: string, name: string): { searchPrefixes: string[]; baseSymbol: string } {
  const base = extractBaseSymbol(symbol);
  const symbolPrefixes = generatePrefixes(symbol);
  const basePrefixes = base !== symbol ? generatePrefixes(base) : [];
  const namePrefixes = generatePrefixes((name.split(/\s+/)[0] || ""));
  const allPrefixes = [...new Set([...symbolPrefixes, ...basePrefixes, ...namePrefixes])];
  return { searchPrefixes: allPrefixes, baseSymbol: base };
}