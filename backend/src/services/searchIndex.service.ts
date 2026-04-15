import { SymbolModel } from "../models/Symbol";
import { isRedisReady, redisClient } from "../config/redis";
import { logger } from "../utils/logger";
import { SEARCH_PRECACHE_QUERIES, matchesCountryFlexible, type SymbolType } from "./symbol.helpers";
import { recordMemoryUsage } from "./metrics.service";

type IndexedRow = {
  symbol: string;
  fullSymbol: string;
  name: string;
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
  baseSymbol?: string;
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

// ── Symbol intent engine ────────────────────────────────────────────
export type QueryIntent = "crypto" | "equity" | "forex" | "etf" | "index" | "general";

const CRYPTO_SIGNAL_TOKENS = new Set([
  "BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE", "DOT", "AVAX", "MATIC",
  "LINK", "ATOM", "UNI", "SHIB", "LTC", "NEAR", "APT", "ARB", "OP", "SUI",
  "FIL", "AAVE", "MKR", "CRV", "SNX", "COMP", "SUSHI", "INJ", "TIA", "SEI",
  "PEPE", "WIF", "BONK", "FLOKI", "MEME", "RENDER", "FET", "RNDR", "TAO",
]);

const ETF_SIGNAL_TOKENS = new Set([
  "SPY", "QQQ", "IWM", "VTI", "VOO", "DIA", "GLD", "SLV", "TLT", "AGG",
  "ARKK", "XLF", "XLK", "XLE", "XLV", "SCHD", "VNQ", "IEMG",
]);

const INDEX_SIGNAL_TOKENS = new Set([
  "SPX", "NDX", "DJI", "IXIC", "VIX", "NIFTY", "SENSEX", "FTSE", "DAX", "N225",
]);

const FOREX_SIGNAL_TOKENS = new Set([
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "USDINR",
]);

export function detectQueryIntent(query: string): QueryIntent {
  const upper = query.toUpperCase().trim();
  if (!upper) return "general";

  // Explicit crypto markers
  if (upper.includes("USDT") || upper.includes("USDC") || upper.includes("BUSD")) return "crypto";
  if (upper.endsWith("USD") && upper.length >= 5 && !FOREX_SIGNAL_TOKENS.has(upper)) return "crypto";
  if (upper.endsWith("PERP") || upper.endsWith("SWAP")) return "crypto";

  // Known token sets
  if (CRYPTO_SIGNAL_TOKENS.has(upper)) return "crypto";
  if (ETF_SIGNAL_TOKENS.has(upper)) return "etf";
  if (INDEX_SIGNAL_TOKENS.has(upper)) return "index";
  if (FOREX_SIGNAL_TOKENS.has(upper)) return "forex";

  return "general";
}

function intentBoost(item: SearchIndexItem, intent: QueryIntent): number {
  if (intent === "general") return 0;

  const type = item.type;
  if (intent === "crypto") {
    if (type === "crypto") return 200;
    if (type === "etf") return -40;
    if (type === "stock") return -80;
  }
  if (intent === "etf") {
    if (type === "etf") return 120;
    if (type === "crypto") return -30;
  }
  if (intent === "index") {
    if (type === "index") return 120;
    if (type === "stock") return -20;
  }
  if (intent === "forex") {
    if (type === "forex") return 120;
  }
  if (intent === "equity") {
    if (type === "stock") return 60;
    if (type === "crypto") return -40;
  }
  return 0;
}

// ── CTR (click-through rate) scoring ────────────────────────────────
// Redis HASH layout:
//   ctr:c:{query} → { SYMBOL: clickCount, ... }   (clicks)
//   ctr:i:{query} → { SYMBOL: impressionCount, ... } (impressions)
//   ctr:t:{query} → timestamp of first event (for decay)
//   ctr:u:{userId}:{query} → { SYMBOL: 1, ... }   (per-user dedup, short TTL)
const CTR_CLICK_PREFIX = "ctr:c:";
const CTR_IMP_PREFIX = "ctr:i:";
const CTR_TIME_PREFIX = "ctr:t:";
const CTR_USER_PREFIX = "ctr:u:";
const CTR_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const CTR_USER_DEDUP_TTL = 3600; // 1 hour — same user/query/symbol counted once per hour
const CTR_DECAY_LAMBDA = 0.1; // decay half-life ~7 days
const CTR_WEIGHT = 25; // max effective CTR boost
const CTR_SMOOTHING_ALPHA = 0.3; // EMA: 30% new, 70% old
const CTR_COLD_START_BOOST = 3; // small exploration boost for symbols with < 5 impressions
const CTR_MIN_IMPRESSIONS = 3; // minimum impressions before CTR is trusted

// Anti-abuse: max clicks per user per query per hour
const CTR_MAX_CLICKS_PER_USER = 5;

export async function recordSearchClick(query: string, symbol: string, userId?: string): Promise<void> {
  if (!isRedisReady() || !query || !symbol) return;
  try {
    const lq = query.toLowerCase();
    const sym = symbol.toUpperCase();
    const clickKey = `${CTR_CLICK_PREFIX}${lq}`;

    // Anti-abuse: per-user dedup
    if (userId) {
      const userKey = `${CTR_USER_PREFIX}${userId}:${lq}`;
      const already = await redisClient.hget(userKey, sym);
      if (already && Number(already) >= CTR_MAX_CLICKS_PER_USER) return; // spam threshold
      await redisClient.hincrby(userKey, sym, 1);
      await redisClient.expire(userKey, CTR_USER_DEDUP_TTL);
    }

    await redisClient.hincrby(clickKey, sym, 1);
    await redisClient.expire(clickKey, CTR_TTL_SECONDS);

    // Track first-event timestamp for decay
    const timeKey = `${CTR_TIME_PREFIX}${lq}`;
    const existing = await redisClient.get(timeKey);
    if (!existing) {
      await redisClient.setex(timeKey, CTR_TTL_SECONDS, String(Date.now()));
    }

    // Trending (global, not per-query)
    await redisClient.hincrby("ctr:trending", sym, 1);
    await redisClient.expire("ctr:trending", CTR_TTL_SECONDS);
  } catch { /* fire-and-forget */ }
}

export async function recordSearchImpressions(query: string, symbols: string[]): Promise<void> {
  if (!isRedisReady() || !query || symbols.length === 0) return;
  try {
    const lq = query.toLowerCase();
    const impKey = `${CTR_IMP_PREFIX}${lq}`;
    const pipeline = redisClient.multi();
    for (const sym of symbols.slice(0, 50)) { // cap at 50 to limit Redis ops
      pipeline.hincrby(impKey, sym.toUpperCase(), 1);
    }
    pipeline.expire(impKey, CTR_TTL_SECONDS);

    // Track first-event timestamp
    const timeKey = `${CTR_TIME_PREFIX}${lq}`;
    const existing = await redisClient.get(timeKey);
    if (!existing) {
      pipeline.setex(timeKey, CTR_TTL_SECONDS, String(Date.now()));
    }

    await pipeline.exec();
  } catch { /* fire-and-forget */ }
}

async function getCtrScoresBatch(query: string, symbols: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!isRedisReady() || !query || symbols.length === 0) return result;
  try {
    const lq = query.toLowerCase();
    const clickKey = `${CTR_CLICK_PREFIX}${lq}`;
    const impKey = `${CTR_IMP_PREFIX}${lq}`;
    const timeKey = `${CTR_TIME_PREFIX}${lq}`;

    // Batch fetch clicks, impressions, and timestamp
    const [clickHash, impHash, timeStr] = await Promise.all([
      redisClient.hgetall(clickKey),
      redisClient.hgetall(impKey),
      redisClient.get(timeKey),
    ]);

    // Compute age-based decay
    const ageMs = timeStr ? Date.now() - Number(timeStr) : 0;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const decay = Math.exp(-CTR_DECAY_LAMBDA * ageDays);

    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      const clicks = Number(clickHash[upper] || 0);
      const impressions = Number(impHash[upper] || 0);

      let ctrScore: number;
      if (impressions < CTR_MIN_IMPRESSIONS) {
        // Cold start: give a small exploration boost so new symbols can surface
        ctrScore = CTR_COLD_START_BOOST;
      } else {
        // True CTR = clicks / impressions, with smoothing
        const rawCTR = clicks / impressions;
        // Apply EMA smoothing: blend with prior (0.5 base CTR)
        const smoothedCTR = CTR_SMOOTHING_ALPHA * rawCTR + (1 - CTR_SMOOTHING_ALPHA) * 0.05;
        // Scale to meaningful boost, apply decay
        ctrScore = smoothedCTR * CTR_WEIGHT * decay;
      }

      if (ctrScore > 0) {
        result.set(upper, ctrScore);
      }
    }
  } catch { /* ignore */ }
  return result;
}

const MAX_RESULTS = envNumber("SEARCH_INDEX_MAX_RESULTS", 120);
const MAX_SYMBOLS_PER_PREFIX = envNumber("MAX_SYMBOLS_PER_PREFIX", 50);
const PREFIX_KEY_LENGTH = envNumber("SEARCH_INDEX_PREFIX_KEY_LENGTH", 3);
const PREFIX_DB_FETCH_LIMIT = envNumber("SEARCH_INDEX_PREFIX_FETCH_LIMIT", 400);
const PREFIX_CACHE_TTL_MS = envNumber("SEARCH_INDEX_PREFIX_CACHE_TTL_MS", 5 * 60 * 1000);
const PREFIX_CACHE_MAX_ENTRIES = envNumber("SEARCH_INDEX_PREFIX_CACHE_MAX_ENTRIES", 180);
const HOT_PREFIX_PREWARM_LIMIT = envNumber("SEARCH_INDEX_HOT_PREFIX_PREWARM_LIMIT", 12);

const PRECOMPUTE_TTL_SECONDS = envNumber("SEARCH_PRECOMPUTE_TTL_SECONDS", 300);
const PRECOMPUTE_INTERVAL_MS = envNumber("SEARCH_PRECOMPUTE_INTERVAL_MS", 300_000);
const HOT_PREFIX_REFRESH_MS = envNumber("SEARCH_INDEX_HOT_PREFIX_REFRESH_MS", 120_000);
const PREFIX_CACHE_SWEEP_MS = envNumber("SEARCH_INDEX_PREFIX_CACHE_SWEEP_MS", 60_000);

const PRECOMPUTE_QUERIES = Array.from(new Set(SEARCH_PRECACHE_QUERIES.map((query) => query.toLowerCase())));

const REDIS_PREFIX_KEY = "sidx:pfx:"; // search index prefix ZSET
const REDIS_SYMBOL_KEY = "sidx:sym:"; // search index symbol HASH
const REDIS_PREFIX_TTL = envNumber("SEARCH_REDIS_PREFIX_TTL", 600); // 10 min
const REDIS_SYMBOL_TTL = envNumber("SEARCH_REDIS_SYMBOL_TTL", 900); // 15 min

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
  // Also flush Redis prefix keys on invalidation
  if (isRedisReady()) {
    void (async () => {
      try {
        let cursor = "0";
        do {
          const [next, keys] = await redisClient.scan(Number(cursor), "MATCH", `${REDIS_PREFIX_KEY}*`, "COUNT", 200);
          cursor = next;
          if (keys.length > 0) await redisClient.del(...keys);
        } while (cursor !== "0");
      } catch { /* best effort */ }
    })();
  }
  logger.info("search_index_prefix_cache_cleared", { reason });
  recordCurrentMemory();
}

// --- Bluechip boost map (entity-level, not symbol-level) ---
const BLUECHIP_BOOST: Record<string, number> = {
  RELIANCE: 90, HDFCBANK: 85, TCS: 80, INFY: 78, ICICIBANK: 76,
  SBIN: 74, HDFC: 72, KOTAKBANK: 70, ADANIENT: 68, BHARTIARTL: 66,
  LT: 64, ITC: 62, HINDUNILVR: 60, BAJFINANCE: 58, MARUTI: 56,
  AAPL: 88, MSFT: 86, GOOG: 82, GOOGL: 82, AMZN: 80, NVDA: 80,
  TSLA: 76, META: 74, BRK: 72, JPM: 70, V: 68, JNJ: 66, UNH: 64,
  BTC: 85, ETH: 78, SOL: 60, XRP: 58, BNB: 56,
};

// --- Geo-aware exchange boosts ---
const GEO_EXCHANGE_BOOST: Record<string, Record<string, number>> = {
  IN: { NSE: 25, BSE: 15 },
  US: { NASDAQ: 20, NYSE: 20, AMEX: 10, ARCA: 8 },
  GB: { LSE: 20, LON: 20 },
  JP: { TYO: 20, TSE: 18, JPX: 15 },
  DE: { FRA: 15, XETRA: 18, ETR: 15 },
  AU: { ASX: 15 },
  CA: { TSX: 15, TSXV: 10 },
  CN: { SSE: 20, SZSE: 18 },
  HK: { HKEX: 20, HKG: 18 },
  KR: { KOSDAQ: 15, KRX: 15, KOSE: 12 },
  BR: { BOVESPA: 15, BVMF: 15, SAO: 12 },
  FR: { EPA: 15, EURONEXT: 12 },
  CH: { SWX: 15, SIX: 15 },
  SG: { SGX: 15 },
  GLOBAL: { NSE: 5, NYSE: 5, NASDAQ: 5, CRYPTO: 3 },
};

// --- Derivative detection ---
function isDerivativeLike(row: IndexedRow): boolean {
  if (row.type === "derivative") return true;
  if (row.isSynthetic) return true;
  const sym = String(row.symbol || "").toUpperCase();
  const exch = String(row.exchange || "").toUpperCase();
  const src = String(row.source || "").toLowerCase();
  return (
    exch === "OPT" || exch === "DERIV" || exch === "CFD"
    || sym.includes("-PERP") || sym.includes("-FUT")
    || /-F-\d{6}/.test(sym) || /-\d{6}-[CP]-/.test(sym)
    || src === "synthetic-derivatives"
  );
}

// --- Company key derivation for entity grouping ---
function deriveCompanyKey(row: IndexedRow): string {
  const sym = String(row.symbol || "").toUpperCase();
  // Strip derivative suffixes to get base
  let base = sym;
  if (row.baseSymbol) base = String(row.baseSymbol).toUpperCase();
  else {
    base = base.replace(/-F-\d{6}$/, "").replace(/-\d{6}-[CP]-.+$/, "")
      .replace(/-PERP$/, "").replace(/-FUT$/, "");
  }
  // Strip exchange suffix (.NS, .BO, etc.)
  const dotIndex = base.indexOf(".");
  if (dotIndex > 0) base = base.slice(0, dotIndex);

  const normalizedBase = normalizeToken(base);
  if (normalizedBase) {
    return normalizedBase;
  }

  const normalizedName = normalizeCompanyName(String(row.name || ""));
  if (normalizedName) {
    return normalizedName;
  }

  return sym;
}

function exchangePrimaryBoost(item: SearchIndexItem, userCountry?: string): number {
  const exchange = item.exchange.toUpperCase();
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

function representativeRank(item: SearchIndexItem, score: number, userCountry?: string, query?: string): number {
  const liquidity = safeNumber(item.liquidityScore);
  const volume = safeNumber(item.volume);
  const freshness = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
  const companyKey = deriveCompanyKey(item);
  const upperQuery = String(query || "").toUpperCase();
  const canonicalCrypto = new Set(["BTC", "ETH", "SOL", "XRP", "BNB"]);
  let queryEntityBoost = 0;

  if (upperQuery && companyKey === upperQuery) {
    queryEntityBoost += 120;
    if (canonicalCrypto.has(upperQuery)) {
      queryEntityBoost += item.type === "crypto" ? 220 : -30;
    }
  }

  return (
    score
    + exchangePrimaryBoost(item, userCountry)
    + queryEntityBoost
    + Math.log10(liquidity + 1) * 4
    + Math.log10(volume + 1) * 3
    + (freshness / 1e14)
  );
}

function staticScore(row: IndexedRow, normalizedSymbol: string, userCountry?: string): number {
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

  // Bluechip boost — entity-level, very significant
  const companyKey = deriveCompanyKey(row);
  score += BLUECHIP_BOOST[companyKey] ?? 0;

  // Geo-aware exchange boost
  const geoKey = userCountry?.toUpperCase() || "GLOBAL";
  const geoBoosts = GEO_EXCHANGE_BOOST[geoKey] || GEO_EXCHANGE_BOOST.GLOBAL || {};
  const exch = String(row.exchange || "").toUpperCase();
  score += geoBoosts[exch] ?? 0;

  // Country match bonus — symbols from user's country get a boost
  if (userCountry && String(row.country || "").toUpperCase() === userCountry.toUpperCase()) {
    score += 15;
  }

  // Tiny exchange preference to break remaining ties
  const exPref: Record<string, number> = { NSE: 0.02, NYSE: 0.02, CRYPTO: 0.015, NASDAQ: 0.01, BSE: 0.01 };
  score += exPref[exch] ?? 0;

  return Number(score.toFixed(4));
}

function queryBonus(item: SearchIndexItem, query: string): number {
  if (!query) return 0;

  const normalizedSymbol = normalizeToken(item.symbol);
  const fullSymbol = item.fullSymbol.toUpperCase();
  const name = item.name.toUpperCase();
  const companyKey = deriveCompanyKey(item);
  const canonicalCrypto = new Set(["BTC", "ETH", "SOL", "XRP", "BNB"]);

  // Kept low so staticScore (popularity/marketCap/priority) dominates ranking.
  // A mega-cap prefix match must beat a micro-cap exact match.
  if (normalizedSymbol === query) {
    let exactBonus = query.length <= 3 ? 85 : 260;
    if ((BLUECHIP_BOOST[companyKey] ?? 0) >= 60) exactBonus += 80;
    if (canonicalCrypto.has(query) && item.type === "crypto") exactBonus += 220;
    return exactBonus;
  }
  if (fullSymbol === query || fullSymbol.endsWith(`:${query}`)) return 145;
  if (normalizedSymbol.startsWith(query)) return 48 - Math.min(12, normalizedSymbol.length - query.length);

  const firstNameToken = normalizeToken(name.split(/\s+/)[0] || "");
  if (firstNameToken && firstNameToken.startsWith(query)) return 20;
  if (name.includes(query)) return 12;
  if (fullSymbol.includes(query)) return 8;

  return 0;
}

function matchesFilter(item: SearchIndexItem, type?: string, country?: string): boolean {
  if (type && type !== "all" && item.type !== type) return false;
  if (!matchesCountryFlexible(item.country, item.exchange, country)) return false;
  return true;
}

function toSearchIndexItem(row: IndexedRow, userCountry?: string): SearchIndexItem | null {
  const symbol = normalizeToken(row.symbol);
  const fullSymbol = String(row.fullSymbol || "").toUpperCase();

  if (!symbol || !fullSymbol || !row.name) return null;

  return {
    symbol,
    fullSymbol,
    name: String(row.name || ""),
    exchange: String(row.exchange || "").toUpperCase(),
    country: String(row.country || "").toUpperCase(),
    updatedAt: row.updatedAt,
    type: (row.type || "stock") as SymbolType,
    currency: String(row.currency || "USD").toUpperCase(),
    iconUrl: row.iconUrl || "",
    companyDomain: row.companyDomain || "",
    s3Icon: row.s3Icon || "",
    source: row.source || "",
    isSynthetic: Boolean(row.isSynthetic),
    baseSymbol: row.baseSymbol || "",
    popularity: safeNumber(row.popularity),
    searchFrequency: safeNumber(row.searchFrequency),
    userUsage: safeNumber(row.userUsage),
    priorityScore: safeNumber(row.priorityScore),
    marketCap: safeNumber(row.marketCap),
    volume: safeNumber(row.volume),
    liquidityScore: safeNumber(row.liquidityScore),
    staticScore: staticScore(row, symbol, userCountry),
  };
}

async function buildPrefixItems(prefix: string): Promise<SearchIndexItem[]> {
  const escaped = escapeRegex(prefix);

  const projection = {
    symbol: 1,
    fullSymbol: 1,
    name: 1,
    exchange: 1,
    country: 1,
    updatedAt: 1,
    type: 1,
    currency: 1,
    iconUrl: 1,
    companyDomain: 1,
    s3Icon: 1,
    source: 1,
    isSynthetic: 1,
    baseSymbol: 1,
    popularity: 1,
    searchFrequency: 1,
    userUsage: 1,
    priorityScore: 1,
    marketCap: 1,
    volume: 1,
    liquidityScore: 1,
  };

  const docsByPrefix = await SymbolModel.find({ searchPrefixes: prefix })
    .select(projection)
    .sort({ priorityScore: -1 })
    .limit(PREFIX_DB_FETCH_LIMIT)
    .lean<IndexedRow[]>();

  let docs = docsByPrefix;

  if (docs.length < Math.max(40, Math.floor(PREFIX_DB_FETCH_LIMIT / 4))) {
    const existingFullSymbols = new Set(docs.map((item) => item.fullSymbol));
    const remainder = Math.max(0, PREFIX_DB_FETCH_LIMIT - docs.length);
    if (remainder > 0) {
      const fallbackDocs = await SymbolModel.find({
        $or: [
          { symbol: { $regex: `^${escaped}` } },
          { fullSymbol: { $regex: `:${escaped}` } },
        ],
      })
    .select({
      ...projection,
    })
    .sort({ priorityScore: -1 })
        .limit(remainder)
        .lean<IndexedRow[]>();

      for (const doc of fallbackDocs) {
        if (!existingFullSymbols.has(doc.fullSymbol)) {
          docs.push(doc);
          existingFullSymbols.add(doc.fullSymbol);
        }
      }
    }
  }

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

/** Persist prefix items to Redis ZSETs + symbol HASHes for O(1) cold-start. */
async function persistPrefixToRedis(prefix: string, items: SearchIndexItem[]): Promise<void> {
  if (!isRedisReady() || items.length === 0) return;
  const pipeline = redisClient.pipeline();
  const prefixKey = `${REDIS_PREFIX_KEY}${prefix}`;

  // ZSET: score → fullSymbol
  const members: Array<string | number> = [];
  for (const item of items) {
    members.push(item.staticScore, item.fullSymbol);
  }
  pipeline.del(prefixKey);
  pipeline.zadd(prefixKey, ...members);
  pipeline.expire(prefixKey, REDIS_PREFIX_TTL);

  // HASH per symbol: compact JSON
  for (const item of items) {
    const symKey = `${REDIS_SYMBOL_KEY}${item.fullSymbol}`;
    pipeline.set(symKey, JSON.stringify(item), "EX", REDIS_SYMBOL_TTL);
  }

  await pipeline.exec();
}

/** Read prefix items from Redis ZSET + hydrate from symbol HASHes. */
async function readPrefixFromRedis(prefix: string): Promise<SearchIndexItem[] | null> {
  if (!isRedisReady()) return null;
  const prefixKey = `${REDIS_PREFIX_KEY}${prefix}`;

  try {
    const members = await redisClient.zrevrangebyscore(prefixKey, "+inf", "-inf", "LIMIT", 0, MAX_SYMBOLS_PER_PREFIX);
    if (!members || members.length === 0) return null;

    const symKeys = members.map((fs) => `${REDIS_SYMBOL_KEY}${fs}`);
    const rows = await redisClient.mget(...symKeys);
    const items: SearchIndexItem[] = [];

    for (const raw of rows) {
      if (!raw) continue;
      try {
        items.push(JSON.parse(raw) as SearchIndexItem);
      } catch { /* skip malformed */ }
    }

    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
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
      // L2: Try Redis ZSET before hitting MongoDB
      const redisItems = await readPrefixFromRedis(prefix);
      let items: SearchIndexItem[];
      if (redisItems && redisItems.length > 0) {
        items = redisItems;
      } else {
        items = await buildPrefixItems(prefix);
        // Persist to Redis L2 for next cold start
        void persistPrefixToRedis(prefix, items).catch(() => {});
      }

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
  userCountry?: string;
  watchlistSymbols?: Set<string>;
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

  // Detect intent and fetch CTR scores in parallel for all candidates
  const intent = detectQueryIntent(normalizedQuery);
  const candidateSymbols = entry.items.map((item) => item.symbol);
  const ctrScores = await getCtrScoresBatch(normalizedQuery, candidateSymbols);

  for (const item of entry.items) {
    if (!matchesFilter(item, params.type, params.country)) continue;

    const bonus = queryBonus(item, normalizedQuery);
    if (bonus <= 0 && !normalizeToken(item.symbol).startsWith(normalizedQuery)) continue;

    // Recompute staticScore with geo-boost if userCountry is available
    let itemScore = item.staticScore + bonus;
    if (params.userCountry) {
      const geoKey = params.userCountry.toUpperCase();
      const geoBoosts = GEO_EXCHANGE_BOOST[geoKey] || GEO_EXCHANGE_BOOST.GLOBAL || {};
      const exch = item.exchange.toUpperCase();
      const geoExchangeBoost = geoBoosts[exch] ?? 0;
      const countryMatch = item.country === geoKey ? 15 : 0;
      itemScore += geoExchangeBoost + countryMatch;
    }

    // Watchlist boost: symbols in user's watchlist get significant relevance bump
    if (params.watchlistSymbols?.has(item.fullSymbol)) {
      itemScore += 35;
    }

    // Intent-aware boost: strongly prefer crypto when query signals crypto intent
    itemScore += intentBoost(item, intent);

    // CTR boost: symbols users actually click on for this query rank higher
    const ctr = ctrScores.get(item.symbol.toUpperCase()) ?? 0;
    itemScore += ctr;

    scored.push({ item, score: itemScore });
  }

  scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.item.fullSymbol.localeCompare(right.item.fullSymbol);
  });

  // --- Entity-first grouping: one entry per company, best symbol wins ---
  const companyBest = new Map<string, { item: SearchIndexItem; score: number }>();
  const basesWithRealListing = new Set<string>();

  // First pass: identify bases that have a real (non-derivative) listing
  for (const entry of scored) {
    if (!isDerivativeLike(entry.item)) {
      basesWithRealListing.add(deriveCompanyKey(entry.item));
    }
  }

  // Second pass: pick best per company, suppress derivatives when base exists
  for (const entry of scored) {
    const companyKey = deriveCompanyKey(entry.item);
    const isDeriv = isDerivativeLike(entry.item);

    // If this is a derivative and a real listing exists for the same base, skip
    if (isDeriv && basesWithRealListing.has(companyKey)) continue;

    const existing = companyBest.get(companyKey);
    if (!existing) {
      companyBest.set(companyKey, entry);
      continue;
    }

    const existingRank = representativeRank(existing.item, existing.score, params.userCountry, normalizedQuery);
    const candidateRank = representativeRank(entry.item, entry.score, params.userCountry, normalizedQuery);
    if (candidateRank > existingRank) {
      companyBest.set(companyKey, entry);
    }
  }

  // Sort company representatives by score
  const grouped = Array.from(companyBest.values())
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.item.fullSymbol.localeCompare(right.item.fullSymbol);
    });

  const items = grouped.slice(0, cappedLimit).map((e) => e.item);

  return {
    items,
    total: grouped.length,
    hasMore: grouped.length > cappedLimit,
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
