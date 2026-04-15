import { SymbolModel } from "../models/Symbol";
import { isRedisReady, redisClient } from "../config/redis";
import { getAssetServiceQuotes } from "../clients/assetService.client";
import { logger } from "../utils/logger";
import { recordRedisLatency } from "./metrics.service";

export type PriceQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: string;
};

const PRICE_CACHE_TTL_SECONDS = 2;
const HOT_QUOTE_CAP = 120;
const HOT_SYMBOL_TTL_MS = 2 * 60 * 1000;
const HOT_SYMBOLS_REDIS_KEY = "search:hot_symbols";
const HOT_SYMBOLS_REDIS_TTL_SECONDS = 120;
const REDIS_BATCH_FLUSH_MS = 75;

const memoryPriceCache = new Map<string, PriceQuote>();
const hotQuoteCache = new Map<string, PriceQuote>();
const hotSymbolExpiry = new Map<string, number>();
const hotSymbolsFastSet = new Set<string>();
const pendingRedisWrites = new Map<string, PriceQuote>();

let flushInProgress = false;
let lastHotSymbolsSyncAt = 0;

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function priceKey(symbol: string): string {
  return `price:${normalizeSymbol(symbol)}`;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function touchBoundedMap<T>(map: Map<string, T>, key: string, value: T, cap: number): void {
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);

  while (map.size > cap) {
    const oldest = map.keys().next().value as string | undefined;
    if (!oldest) break;
    map.delete(oldest);
  }
}

function touchHotSymbol(symbol: string, quote?: PriceQuote): void {
  const normalized = normalizeSymbol(symbol);
  const expiresAt = Date.now() + HOT_SYMBOL_TTL_MS;

  hotSymbolExpiry.set(normalized, expiresAt);
  hotSymbolsFastSet.add(normalized);
  if (quote) {
    touchBoundedMap(hotQuoteCache, normalized, quote, HOT_QUOTE_CAP);
  }
}

async function syncHotSymbolsToRedis(symbols: string[]): Promise<void> {
  if (!isRedisReady() || symbols.length === 0) return;

  try {
    const startedAt = Date.now();
    const pipeline = redisClient.pipeline();
    pipeline.sadd(HOT_SYMBOLS_REDIS_KEY, ...symbols);
    pipeline.expire(HOT_SYMBOLS_REDIS_KEY, HOT_SYMBOLS_REDIS_TTL_SECONDS);
    await pipeline.exec();
    recordRedisLatency(Date.now() - startedAt);
  } catch {
    // Best effort only.
  }
}

async function refreshHotSymbolsFastSet(): Promise<void> {
  if (!isRedisReady()) return;
  if (Date.now() - lastHotSymbolsSyncAt < 1000) return;

  lastHotSymbolsSyncAt = Date.now();
  try {
    const startedAt = Date.now();
    const members = await redisClient.smembers(HOT_SYMBOLS_REDIS_KEY);
    recordRedisLatency(Date.now() - startedAt);

    hotSymbolsFastSet.clear();
    for (const member of members) {
      hotSymbolsFastSet.add(normalizeSymbol(member));
    }
  } catch {
    // Keep existing in-memory fast set.
  }
}

async function flushPendingRedisWrites(): Promise<void> {
  if (flushInProgress) return;
  if (!isRedisReady()) return;
  if (pendingRedisWrites.size === 0) return;

  flushInProgress = true;
  try {
    const entries = Array.from(pendingRedisWrites.entries());
    pendingRedisWrites.clear();

    const startedAt = Date.now();
    const pipeline = redisClient.pipeline();
    for (const [symbol, quote] of entries) {
      pipeline.set(priceKey(symbol), JSON.stringify(quote), "EX", PRICE_CACHE_TTL_SECONDS);
    }
    await pipeline.exec();
    const elapsedMs = Date.now() - startedAt;
    recordRedisLatency(elapsedMs);

    if (elapsedMs > 50) {
      logger.warn("price_cache_redis_batch_slow", { elapsedMs, writes: entries.length });
    }
  } catch (error) {
    logger.warn("price_cache_redis_batch_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    flushInProgress = false;
  }
}

function enqueueRedisWrite(quote: PriceQuote): void {
  if (!isRedisReady()) return;
  pendingRedisWrites.set(quote.symbol, quote);
}

const flushTimer = setInterval(() => {
  void flushPendingRedisWrites();
}, REDIS_BATCH_FLUSH_MS);
flushTimer.unref();

const hotSymbolSyncTimer = setInterval(() => {
  void refreshHotSymbolsFastSet();
}, 1000);
hotSymbolSyncTimer.unref();

export function markSymbolsHot(symbols: string[]): void {
  const normalized = Array.from(new Set(symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean)));
  if (!normalized.length) return;

  for (const symbol of normalized) {
    touchHotSymbol(symbol);
  }

  void syncHotSymbolsToRedis(normalized);
}

export function isHotSymbol(symbol: string): boolean {
  const normalized = normalizeSymbol(symbol);
  const expiresAt = hotSymbolExpiry.get(normalized) || 0;
  if (expiresAt > Date.now()) return true;
  return hotSymbolsFastSet.has(normalized);
}

async function readRedisPrice(symbol: string): Promise<PriceQuote | null> {
  if (!isRedisReady()) return null;
  try {
    const startedAt = Date.now();
    const raw = await redisClient.get(priceKey(symbol));
    recordRedisLatency(Date.now() - startedAt);
    if (!raw) return null;
    return JSON.parse(raw) as PriceQuote;
  } catch {
    return null;
  }
}

async function getDbFallbackQuotes(symbols: string[]): Promise<Record<string, PriceQuote>> {
  if (!symbols.length) return {};

  try {
    const docs = await SymbolModel.find({ symbol: { $in: symbols } })
      .select({ symbol: 1, volume: 1 })
      .limit(symbols.length)
      .lean<Array<{ symbol: string; volume?: number }>>();

    const now = new Date().toISOString();
    const out: Record<string, PriceQuote> = {};

    for (const doc of docs) {
      const symbol = normalizeSymbol(doc.symbol);
      out[symbol] = {
        symbol,
        price: 0,
        change: 0,
        changePercent: 0,
        volume: safeNumber(doc.volume),
        timestamp: now,
        source: "db-fallback",
      };
    }

    return out;
  } catch {
    return {};
  }
}

export async function setPriceQuote(quote: PriceQuote): Promise<void> {
  const symbol = normalizeSymbol(quote.symbol);
  const payload: PriceQuote = {
    symbol,
    price: safeNumber(quote.price),
    change: safeNumber(quote.change),
    changePercent: safeNumber(quote.changePercent),
    volume: safeNumber(quote.volume),
    timestamp: quote.timestamp || new Date().toISOString(),
    source: quote.source || "market.tick",
  };

  memoryPriceCache.set(symbol, payload);
  touchHotSymbol(symbol, payload);
  enqueueRedisWrite(payload);
}

export async function updatePriceFromTick(input: {
  symbol: string;
  price: number;
  timestamp?: number;
  volume?: number;
}): Promise<void> {
  const symbol = normalizeSymbol(input.symbol);
  if (!symbol) return;

  const previous = hotQuoteCache.get(symbol) || memoryPriceCache.get(symbol) || await readRedisPrice(symbol);
  const previousPrice = safeNumber(previous?.price, 0);
  const currentPrice = safeNumber(input.price, previousPrice);
  const change = previousPrice > 0 ? currentPrice - previousPrice : 0;
  const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;

  await setPriceQuote({
    symbol,
    price: currentPrice,
    change,
    changePercent,
    volume: safeNumber(input.volume, safeNumber(previous?.volume, 0)),
    timestamp: new Date(input.timestamp || Date.now()).toISOString(),
    source: "market.tick",
  });
}

export async function getPriceQuotes(symbols: string[]): Promise<Record<string, PriceQuote>> {
  const uniqueSymbols = Array.from(new Set(symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean)));
  if (!uniqueSymbols.length) return {};

  const out: Record<string, PriceQuote> = {};
  const unresolved: string[] = [];

  // L1 hot quote cache (fast-path hotkey protection)
  for (const symbol of uniqueSymbols) {
    const quote = hotQuoteCache.get(symbol);
    if (quote) {
      out[symbol] = quote;
      continue;
    }
    unresolved.push(symbol);
  }

  // L2 Redis cache for remaining symbols
  if (unresolved.length > 0 && isRedisReady()) {
    try {
      const keys = unresolved.map((symbol) => priceKey(symbol));
      const startedAt = Date.now();
      const values = await redisClient.mget(...keys);
      recordRedisLatency(Date.now() - startedAt);

      for (let index = 0; index < unresolved.length; index += 1) {
        const raw = values[index];
        const symbol = unresolved[index]!;
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as PriceQuote;
          out[symbol] = parsed;
          memoryPriceCache.set(symbol, parsed);
          touchBoundedMap(hotQuoteCache, symbol, parsed, HOT_QUOTE_CAP);
        } catch {
          // Ignore malformed cache rows.
        }
      }
    } catch {
      // Continue to local memory and fallback layers.
    }
  }

  // L1 secondary memory cache
  for (const symbol of unresolved) {
    if (out[symbol]) continue;
    const fromMemory = memoryPriceCache.get(symbol);
    if (fromMemory) {
      out[symbol] = fromMemory;
      touchBoundedMap(hotQuoteCache, symbol, fromMemory, HOT_QUOTE_CAP);
    }
  }

  // L3 DB fallback (best effort)
  const stillMissing = unresolved.filter((symbol) => !out[symbol]);
  if (stillMissing.length > 0) {
    const dbFallback = await getDbFallbackQuotes(stillMissing);
    for (const [symbol, quote] of Object.entries(dbFallback)) {
      out[symbol] = quote;
    }
  }

  return out;
}

export async function overlayRealtimePrices<T extends {
  symbol: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  pnl?: number;
}>(items: T[]): Promise<T[]> {
  if (!items.length) return items;

  markSymbolsHot(items.map((item) => item.symbol));

  const symbols = items.map((item) => item.symbol);
  const cached = await getPriceQuotes(symbols);

  const hasDbQuote = new Map<string, boolean>();
  for (const item of items) {
    const symbol = normalizeSymbol(item.symbol);
    const hasPrice = typeof item.price === "number" && Number.isFinite(item.price) && item.price > 0;
    if (hasPrice) {
      hasDbQuote.set(symbol, true);
    }
  }

  const missing = symbols
    .map((symbol) => normalizeSymbol(symbol))
    .filter((symbol, index, all) => !cached[symbol] && !hasDbQuote.get(symbol) && all.indexOf(symbol) === index);

  let fallbackQuotes: Record<string, PriceQuote> = {};
  if (missing.length > 0) {
    const payload = await getAssetServiceQuotes(missing);
    fallbackQuotes = Object.fromEntries(
      Object.entries(payload.quotes).map(([symbol, quote]) => [
        normalizeSymbol(symbol),
        {
          symbol: normalizeSymbol(symbol),
          price: safeNumber(quote.price),
          change: safeNumber(quote.change),
          changePercent: safeNumber(quote.changePercent),
          volume: safeNumber(quote.volume),
          timestamp: quote.timestamp,
          source: quote.source,
        } as PriceQuote,
      ]),
    );

    for (const quote of Object.values(fallbackQuotes)) {
      // eslint-disable-next-line no-await-in-loop
      await setPriceQuote(quote);
    }
  }

  return items.map((item) => {
    const symbol = normalizeSymbol(item.symbol);
    const quote = cached[symbol] || fallbackQuotes[symbol];
    if (!quote) return item;

    return {
      ...item,
      price: safeNumber(quote.price, safeNumber(item.price)),
      change: safeNumber(quote.change, safeNumber(item.change)),
      changePercent: safeNumber(quote.changePercent, safeNumber(item.changePercent)),
      volume: safeNumber(quote.volume, safeNumber(item.volume)),
      pnl: safeNumber(quote.change, safeNumber(item.pnl)),
    };
  });
}
