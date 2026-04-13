import { isRedisReady, redisClient } from "../config/redis";
import { getLiveQuotes } from "./liveMarketService";

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
const memoryPriceCache = new Map<string, PriceQuote>();

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function priceKey(symbol: string): string {
  return `price:${normalizeSymbol(symbol)}`;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

async function readRedisPrice(symbol: string): Promise<PriceQuote | null> {
  if (!isRedisReady()) return null;
  try {
    const raw = await redisClient.get(priceKey(symbol));
    if (!raw) return null;
    return JSON.parse(raw) as PriceQuote;
  } catch {
    return null;
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

  if (!isRedisReady()) return;
  try {
    await redisClient.set(priceKey(symbol), JSON.stringify(payload), "EX", PRICE_CACHE_TTL_SECONDS);
  } catch {
    // Memory cache remains available.
  }
}

export async function updatePriceFromTick(input: {
  symbol: string;
  price: number;
  timestamp?: number;
  volume?: number;
}): Promise<void> {
  const symbol = normalizeSymbol(input.symbol);
  if (!symbol) return;

  const previous = (await readRedisPrice(symbol)) || memoryPriceCache.get(symbol) || null;
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

  if (isRedisReady()) {
    try {
      const keys = uniqueSymbols.map((symbol) => priceKey(symbol));
      const values = await redisClient.mget(...keys);

      for (let index = 0; index < uniqueSymbols.length; index += 1) {
        const raw = values[index];
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as PriceQuote;
          out[uniqueSymbols[index]!] = parsed;
          memoryPriceCache.set(uniqueSymbols[index]!, parsed);
        } catch {
          // Ignore malformed cache rows.
        }
      }
    } catch {
      // Fall back to memory cache and live quote provider.
    }
  }

  for (const symbol of uniqueSymbols) {
    if (out[symbol]) continue;
    const fromMemory = memoryPriceCache.get(symbol);
    if (fromMemory) {
      out[symbol] = fromMemory;
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
    const payload = getLiveQuotes({ symbols: missing });
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