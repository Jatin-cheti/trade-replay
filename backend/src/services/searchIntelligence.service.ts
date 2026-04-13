import levenshtein from "fast-levenshtein";
import { FilterQuery, Types } from "mongoose";
import { SymbolDocument, SymbolModel } from "../models/Symbol";
import { redisClient, isRedisReady } from "../config/redis";
import { clusterScopedKey } from "./redisKey.service";
import { logger } from "../utils/logger";

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

const BLUECHIP_BOOST: Record<string, number> = {
  RELIANCE: 85,
  HDFCBANK: 82,
  HDFC: 78,
  ICICIBANK: 74,
  SBIN: 72,
  INFY: 70,
  TCS: 70,
  AAPL: 74,
  MSFT: 74,
  GOOG: 70,
  GOOGL: 70,
  AMZN: 68,
  TSLA: 68,
  NVDA: 68,
  META: 64,
};

const EXCHANGE_PENALTY: Record<string, number> = {
  OPT: -80,
  DERIV: -70,
  CFD: -60,
};

const TOP_SYMBOLS_PRIORITY_LIST: Record<string, number> = {
  RELIANCE: 42,
  TCS: 35,
  HDFCBANK: 42,
  INFY: 32,
  ICICIBANK: 32,
};

const PERSONALIZATION_MAX_INFLUENCE = 0.12;
const PERSONALIZATION_ENABLED = false;

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
  source: string;
  isSynthetic: boolean;
  popularity: number;
  searchFrequency: number;
  userUsage: number;
  priorityScore: number;
  marketCap: number;
  volume: number;
  liquidityScore: number;
  baseSymbol: string;
  _symbolClass: "stock" | "etf" | "crypto" | "forex" | "derivative" | "crypto_pair";
  _isDerivative: boolean;
  _baseScore: number;
  _personalizationBoost: number;
  _score: number;
  _matchType: "exact" | "prefix" | "fuzzy" | "name" | "sector";
  _id: Types.ObjectId;
  createdAt: Date;
}

export type { ScoredSymbol };

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizedLogScore(value: number, maxLog: number): number {
  const safe = Math.max(0, safeNumber(value));
  if (safe <= 0) return 0;
  return clamp01(Math.log10(safe + 1) / maxLog);
}

function deriveLogicalBaseSymbol(rawSymbol: string): string {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return symbol;
  if (/-F-\d{6}$/.test(symbol)) return symbol.replace(/-F-\d{6}$/, "");
  if (/-\d{6}-[CP]-/.test(symbol)) return symbol.replace(/-\d{6}-[CP]-.+$/, "");
  if (/-PERP$/.test(symbol)) return symbol.replace(/-PERP$/, "");
  if (/-FUT$/.test(symbol)) return symbol.replace(/-FUT$/, "");
  return symbol;
}

function computeBaseScore(opts: {
  matchType: "exact" | "prefix" | "fuzzy" | "name" | "sector";
  fuzzyDistance: number;
  marketCap: number;
  volume: number;
  liquidityScore: number;
  exchangeBoost: number;
  exchangePenalty: number;
  topPriorityBoost: number;
  brandBoost: number;
  derivativeMultiplier: number;
  baseSymbolBoost: number;
}): number {
  const matchWeights: Record<string, number> = {
    exact: 1,
    prefix: 0.78,
    name: 0.38,
    fuzzy: 0.3,
    sector: 0.24,
  };

  const matchNorm = matchWeights[opts.matchType] ?? 0;
  const fuzzyPenaltyNorm = clamp01(opts.fuzzyDistance / 10) * 0.12;
  const marketCapNorm = normalizedLogScore(opts.marketCap, 12);
  const volumeNorm = normalizedLogScore(opts.volume, 9);
  const liquidityNorm = clamp01(safeNumber(opts.liquidityScore) / 100);
  const fallbackNorm = opts.marketCap > 0
    ? 0
    : Math.max(liquidityNorm, volumeNorm * 0.9);
  const exchangeNorm = clamp01((safeNumber(opts.exchangeBoost) + safeNumber(opts.exchangePenalty) + 100) / 200);
  const baseBoostNorm = clamp01(safeNumber(opts.baseSymbolBoost) / 30);
  const brandNorm = clamp01(safeNumber(opts.brandBoost) / 100);
  const topPriorityRaw = safeNumber(opts.topPriorityBoost);

  const normalizedScore = (
    (matchNorm * 0.48)
    + (marketCapNorm * 0.2)
    + (volumeNorm * 0.14)
    + (liquidityNorm * 0.12)
    + (fallbackNorm * 0.04)
    + (exchangeNorm * 0.08)
    + (baseBoostNorm * 0.05)
    + (brandNorm * 0.06)
    - fuzzyPenaltyNorm
  );

  return Math.max(0, (normalizedScore * 100) + topPriorityRaw) * opts.derivativeMultiplier;
}

function computePersonalizationBoost(baseScore: number, recencyBoost: number, watchlistBoost: number): number {
  if (!PERSONALIZATION_ENABLED) return 0;
  const raw = Math.max(0, safeNumber(recencyBoost) + safeNumber(watchlistBoost));
  if (raw <= 0) return 0;
  const cap = Math.max(2, baseScore * PERSONALIZATION_MAX_INFLUENCE);
  return Math.min(cap, raw * 0.18);
}

function classifySymbol(item: Pick<ScoredSymbol, "symbol" | "name" | "exchange" | "type" | "source" | "isSynthetic">): {
  symbolClass: "stock" | "etf" | "crypto" | "forex" | "derivative" | "crypto_pair";
  isDerivative: boolean;
  isSynthetic: boolean;
} {
  const symbol = item.symbol.toUpperCase();
  const exchange = item.exchange.toUpperCase();
  const name = item.name.toUpperCase();
  const source = item.source.toLowerCase();
  const synthetic = Boolean(item.isSynthetic) || source === "synthetic-derivatives";

  const derivativeLike =
    synthetic
    || exchange === "OPT"
    || exchange === "DERIV"
    || exchange === "CFD"
    || symbol.includes("-PERP")
    || symbol.includes("-FUT")
    || /-F-\d{6}/.test(symbol)
    || /-\d{6}-[CP]-/.test(symbol);

  if (derivativeLike) {
    return { symbolClass: "derivative", isDerivative: true, isSynthetic: synthetic };
  }

  if ((item.type || "").toLowerCase() === "crypto" && (symbol.includes("/") || name.includes("/"))) {
    return { symbolClass: "crypto_pair", isDerivative: false, isSynthetic: synthetic };
  }

  if ((item.type || "").toLowerCase() === "crypto") {
    return { symbolClass: "crypto", isDerivative: false, isSynthetic: synthetic };
  }

  if ((item.type || "").toLowerCase() === "forex") {
    return { symbolClass: "forex", isDerivative: false, isSynthetic: synthetic };
  }

  if ((item.type || "").toLowerCase() === "stock" && /\bETF\b|\bTRUST\b|\bINDEX FUND\b/.test(name)) {
    return { symbolClass: "etf", isDerivative: false, isSynthetic: synthetic };
  }

  return { symbolClass: "stock", isDerivative: false, isSynthetic: synthetic };
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
  source: 1,
  isSynthetic: 1,
  popularity: 1,
  searchFrequency: 1,
  userUsage: 1,
  priorityScore: 1,
  marketCap: 1,
  volume: 1,
  liquidityScore: 1,
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
  source: string;
  isSynthetic: boolean;
  popularity: number;
  searchFrequency: number;
  userUsage: number;
  priorityScore: number;
  marketCap: number;
  volume: number;
  liquidityScore: number;
  baseSymbol: string;
  createdAt: Date;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function intelligentSearch(params: IntelligentSearchParams): Promise<IntelligentSearchResult> {
  const query = params.query.trim();
  const limit = Math.max(1, Math.min(30, params.limit ?? 30));
  const upperQuery = query.toUpperCase();

  if (!query) {
    return { items: [], clusters: {}, total: 0, hasMore: false, matchBreakdown: { exact: 0, prefix: 0, fuzzy: 0, name: 0, sector: 0 } };
  }

  const [recentSymbols, watchlist]: [string[], Set<string>] = (PERSONALIZATION_ENABLED && params.userId)
    ? await Promise.all([getRecentSymbols(params.userId), getUserWatchlist(params.userId)])
    : [[], new Set<string>()];

  const countryCode = "GLOBAL";
  const exchangeBoosts = EXCHANGE_BOOST[countryCode] || EXCHANGE_BOOST.GLOBAL || {};

  const typeFilter: FilterQuery<SymbolDocument> = {};
  if (params.type) {
    const t = params.type.toLowerCase();
    if (["stock", "etf", "crypto", "forex", "index", "derivative"].includes(t)) typeFilter.type = t;
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

  // PHASE 2: Prefix match via anchored symbol regex
  const prefixRows = await SymbolModel.find({
    symbol: { $regex: `^${escapeRegex(upperQuery)}` },
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
        source: row.source || "",
        isSynthetic: Boolean(row.isSynthetic),
        userUsage: row.userUsage || 0,
        marketCap: row.marketCap || 0,
        volume: row.volume || 0,
        liquidityScore: row.liquidityScore || 0,
        baseSymbol: deriveLogicalBaseSymbol(row.baseSymbol || extractBaseSymbol(row.symbol)),
        _symbolClass: "stock",
        _isDerivative: false,
        _baseScore: 0,
        _personalizationBoost: 0,
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
              source: row.source || "",
              isSynthetic: Boolean(row.isSynthetic),
              userUsage: row.userUsage || 0,
              marketCap: row.marketCap || 0,
              volume: row.volume || 0,
              liquidityScore: row.liquidityScore || 0,
              baseSymbol: deriveLogicalBaseSymbol(row.baseSymbol || extractBaseSymbol(row.symbol)),
              _symbolClass: "stock",
              _isDerivative: false,
              _baseScore: 0,
              _personalizationBoost: 0,
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
          source: row.source || "",
          isSynthetic: Boolean(row.isSynthetic),
          userUsage: row.userUsage || 0,
          marketCap: row.marketCap || 0,
          volume: row.volume || 0,
          liquidityScore: row.liquidityScore || 0,
          baseSymbol: deriveLogicalBaseSymbol(row.baseSymbol || extractBaseSymbol(row.symbol)),
          _symbolClass: "stock",
          _isDerivative: false,
          _baseScore: 0,
          _personalizationBoost: 0,
          _score: 0,
          _matchType: "sector",
        });
      }
    }
  }

  // PHASE 6: Score everything
  let allItems = Array.from(seen.values());

  for (const item of allItems) {
    const klass = classifySymbol(item);
    item._symbolClass = klass.symbolClass;
    item._isDerivative = klass.isDerivative;
    item.isSynthetic = klass.isSynthetic;
  }

  if (query.length < 3) {
    const strict = allItems.filter((item) => {
      if (item._isDerivative || item.isSynthetic) return false;
      if (item._symbolClass === "stock") return true;
      if (item._symbolClass === "etf") {
        return (item.liquidityScore || 0) >= 30 || (item.volume || 0) >= 100000;
      }
      return false;
    });

    if (strict.length > 0) {
      allItems = strict;
    } else {
      allItems = allItems.filter((item) => !item._isDerivative);
    }
  }

  // If a real/base listing exists for a base symbol, hide derivative variants for that base.
  const basesWithRealListing = new Set(
    allItems
      .filter((item) => !item._isDerivative && !item.isSynthetic)
      .map((item) => item.baseSymbol || item.symbol),
  );
  allItems = allItems.filter((item) => {
    if (!item._isDerivative) return true;
    const base = item.baseSymbol || item.symbol;
    return !basesWithRealListing.has(base);
  });

  for (const item of allItems) {
    const recentIndex = recentSymbols.indexOf(item.fullSymbol);
    const recencyBoost = recentIndex >= 0 ? 40 / (1 + recentIndex) : 0;
    const watchlistBoost = watchlist.has(item.fullSymbol) ? 60 : 0;
    const exchangeBoost = exchangeBoosts[item.exchange] ?? 0;
    const exchangePenalty = EXCHANGE_PENALTY[item.exchange] ?? 0;
    const brandBoost = BLUECHIP_BOOST[item.symbol] ?? BLUECHIP_BOOST[item.baseSymbol] ?? 0;
    const fixedTopBoost = TOP_SYMBOLS_PRIORITY_LIST[item.symbol] ?? TOP_SYMBOLS_PRIORITY_LIST[item.baseSymbol] ?? 0;
    const fuzzyDist = item._matchType === "fuzzy" ? levenshtein.get(upperQuery, item.symbol) : 0;
    const derivativeMultiplier = item._isDerivative ? 0.2 : 1;
    const baseSymbolBoost = item.symbol === item.baseSymbol ? 24 : 0;

    item._baseScore = computeBaseScore({
      matchType: item._matchType,
      fuzzyDistance: fuzzyDist,
      marketCap: safeNumber(item.marketCap),
      volume: safeNumber(item.volume),
      liquidityScore: safeNumber(item.liquidityScore),
      exchangeBoost,
      exchangePenalty,
      topPriorityBoost: fixedTopBoost,
      brandBoost,
      derivativeMultiplier,
      baseSymbolBoost,
    });
    item._personalizationBoost = computePersonalizationBoost(item._baseScore, recencyBoost, watchlistBoost);
    item._score = item._baseScore + item._personalizationBoost;
  }

  // PHASE 7: Sort, group by base symbol, and keep base symbol first.
  allItems.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    if (b._baseScore !== a._baseScore) return b._baseScore - a._baseScore;
    if (a._isDerivative !== b._isDerivative) return Number(a._isDerivative) - Number(b._isDerivative);
    return a.fullSymbol.localeCompare(b.fullSymbol);
  });

  const groupedByBase = new Map<string, ScoredSymbol[]>();
  for (const item of allItems) {
    const base = item.baseSymbol || item.symbol;
    const group = groupedByBase.get(base) ?? [];
    group.push(item);
    groupedByBase.set(base, group);
  }

  const orderedGroups = Array.from(groupedByBase.entries()).sort((left, right) => {
    const leftTop = Math.max(...left[1].map((item) => item._score));
    const rightTop = Math.max(...right[1].map((item) => item._score));
    return rightTop - leftTop;
  });

  const flattened: ScoredSymbol[] = [];
  for (const [, group] of orderedGroups) {
    group.sort((a, b) => {
      const aBase = a.symbol === a.baseSymbol ? 1 : 0;
      const bBase = b.symbol === b.baseSymbol ? 1 : 0;
      if (aBase !== bBase) return bBase - aBase;
      if (a._isDerivative !== b._isDerivative) return Number(a._isDerivative) - Number(b._isDerivative);
      if (b._score !== a._score) return b._score - a._score;
      if (b._baseScore !== a._baseScore) return b._baseScore - a._baseScore;
      return a.fullSymbol.localeCompare(b.fullSymbol);
    });
    flattened.push(...group);
  }

  allItems = flattened;

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

  if (limited.length > 0 && query.length <= 6) {
    logger.info("search_ranking_snapshot", {
      query: upperQuery,
      total: allItems.length,
      top10: limited.slice(0, 10).map((item) => ({
        symbol: item.symbol,
        fullSymbol: item.fullSymbol,
        matchType: item._matchType,
        baseScore: Number(item._baseScore.toFixed(4)),
        personalizationBoost: Number(item._personalizationBoost.toFixed(4)),
        finalScore: Number(item._score.toFixed(4)),
        marketCap: item.marketCap || 0,
        volume: item.volume || 0,
        liquidityScore: item.liquidityScore || 0,
        isDerivative: item._isDerivative,
        isSynthetic: item.isSynthetic,
      })),
    });
  }

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