import { CandleData } from "../types/shared";
import { getFallbackCandles } from "./fallbackData";
import { produceChartCandleUpdated } from "../kafka/eventProducers";
import { logger } from "../utils/logger";
import { fetchYahooIntradayCandles, fetchYahooQuotes } from "./yahooMarketData";

export type LiveQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: "synthetic-live" | "yahoo-live";
};

export type LiveDataMode = "default" | "parity-live";

type LiveSymbolState = {
  symbol: string;
  candles: CandleData[];
  lastEmittedAt: number;
};

const LIVE_STEP_MS = 2000;
const MAX_BUFFER = 400;
const YAHOO_CANDLE_CACHE_TTL_MS = 12_000;
const YAHOO_QUOTE_CACHE_TTL_MS = 4_000;
const stateBySymbol = new Map<string, LiveSymbolState>();
const yahooCandleCache = new Map<string, { expiresAt: number; candles: CandleData[] }>();
const yahooQuoteCache = new Map<string, { expiresAt: number; quote: LiveQuote }>();

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function normalizeLimit(limit?: number): number {
  return Math.max(20, Math.min(500, Number(limit ?? 240)));
}

function pruneExpiredCaches(now: number): void {
  for (const [key, value] of yahooQuoteCache.entries()) {
    if (value.expiresAt <= now) {
      yahooQuoteCache.delete(key);
    }
  }
}

function seedFromSymbol(symbol: string): number {
  return symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function ensureSymbolState(rawSymbol: string): LiveSymbolState {
  const symbol = normalizeSymbol(rawSymbol);
  const existing = stateBySymbol.get(symbol);
  if (existing) return existing;

  const seedScenario = "2008-crash";
  const seeded = getFallbackCandles(seedScenario, symbol).slice(-300);
  const base = seeded.length > 0
    ? seeded
    : getFallbackCandles(seedScenario, `SYN-${symbol}`).slice(-300);

  const nextState: LiveSymbolState = {
    symbol,
    candles: base.length > 0 ? base : [{
      time: new Date().toISOString(),
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 100000,
    }],
    lastEmittedAt: 0,
  };

  stateBySymbol.set(symbol, nextState);
  return nextState;
}

function nextCandle(prev: CandleData, symbol: string, nowMs: number): CandleData {
  const seed = seedFromSymbol(symbol);
  const t = Math.floor(nowMs / LIVE_STEP_MS);

  const microTrend = ((seed % 7) - 3) * 0.00025;
  const wave = Math.sin((t + seed) / 8) * 0.0018;
  const shock = Math.cos((t + seed * 3) / 17) * 0.0011;
  const move = microTrend + wave + shock;

  const open = prev.close;
  const close = Math.max(0.1, open * (1 + move));
  const spread = Math.max(open, close) * (0.0008 + ((seed % 5) * 0.0002));
  const high = Math.max(open, close) + spread;
  const low = Math.max(0.05, Math.min(open, close) - spread);
  const volume = Math.max(1000, Math.round(prev.volume * (0.96 + ((seed % 13) / 120))));

  return {
    time: new Date(nowMs).toISOString(),
    open: Number(open.toFixed(4)),
    high: Number(high.toFixed(4)),
    low: Number(low.toFixed(4)),
    close: Number(close.toFixed(4)),
    volume,
  };
}

function tickSymbol(state: LiveSymbolState): void {
  const now = Date.now();
  if (now - state.lastEmittedAt < LIVE_STEP_MS) return;

  const last = state.candles[state.candles.length - 1];
  const candle = nextCandle(last, state.symbol, now);
  state.candles.push(candle);
  produceChartCandleUpdated({
    symbol: state.symbol,
    timeframe: "1m",
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  });
  logger.info("published candle.updated", {
    symbol: state.symbol,
    timeframe: "1m",
    time: candle.time,
  });

  if (state.candles.length > MAX_BUFFER) {
    state.candles = state.candles.slice(-MAX_BUFFER);
  }
  state.lastEmittedAt = now;
}

function quoteFromCandles(symbol: string, candles: CandleData[], source: LiveQuote["source"]): LiveQuote {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const change = last.close - prev.close;
  const changePercent = prev.close === 0 ? 0 : (change / prev.close) * 100;

  return {
    symbol,
    price: Number(last.close.toFixed(4)),
    change: Number(change.toFixed(4)),
    changePercent: Number(changePercent.toFixed(4)),
    volume: last.volume,
    timestamp: last.time,
    source,
  };
}

function tailCandles(candles: CandleData[], limit: number): CandleData[] {
  if (candles.length <= limit) return candles;
  return candles.slice(-limit);
}

async function getYahooCandles(symbol: string, limit: number): Promise<CandleData[] | null> {
  const normalized = normalizeSymbol(symbol);
  const now = Date.now();
  pruneExpiredCaches(now);

  const cached = yahooCandleCache.get(normalized);
  if (cached && cached.expiresAt > now && cached.candles.length > 0) {
    return tailCandles(cached.candles, limit);
  }

  let fetched = await fetchYahooIntradayCandles({
    symbol: normalized,
    interval: "1m",
    range: "1d",
  });

  if (!fetched || fetched.length === 0) {
    fetched = await fetchYahooIntradayCandles({
      symbol: normalized,
      interval: "1m",
      range: "1d",
      timeoutMs: 7000,
    });
  }

  if (!fetched || fetched.length === 0) {
    if (cached && cached.candles.length > 0) {
      return tailCandles(cached.candles, limit);
    }
    return null;
  }

  yahooCandleCache.set(normalized, {
    expiresAt: now + YAHOO_CANDLE_CACHE_TTL_MS,
    candles: fetched,
  });

  return tailCandles(fetched, limit);
}

async function getYahooQuotesMap(symbols: string[]): Promise<Record<string, LiveQuote>> {
  const now = Date.now();
  pruneExpiredCaches(now);

  const quotes: Record<string, LiveQuote> = {};
  const missing: string[] = [];

  for (const symbol of symbols) {
    const cached = yahooQuoteCache.get(symbol);
    if (cached && cached.expiresAt > now) {
      quotes[symbol] = cached.quote;
      continue;
    }
    missing.push(symbol);
  }

  if (missing.length > 0) {
    const fetched = await fetchYahooQuotes(missing);
    if (fetched && fetched.length > 0) {
      for (const row of fetched) {
        const symbol = normalizeSymbol(row.symbol);
        const quote: LiveQuote = {
          symbol,
          price: Number(row.price.toFixed(4)),
          change: Number(row.change.toFixed(4)),
          changePercent: Number(row.changePercent.toFixed(4)),
          volume: row.volume,
          timestamp: row.timestamp,
          source: "yahoo-live",
        };
        quotes[symbol] = quote;
        yahooQuoteCache.set(symbol, {
          expiresAt: now + YAHOO_QUOTE_CACHE_TTL_MS,
          quote,
        });
      }
    }
  }

  return quotes;
}

export async function getLiveCandles(input: {
  symbol: string;
  limit?: number;
  mode?: LiveDataMode;
}): Promise<{ symbol: string; candles: CandleData[]; quote: LiveQuote; source: "synthetic-live" | "yahoo-live" }> {
  const mode = input.mode ?? "default";
  const normalized = normalizeSymbol(input.symbol);
  const limit = normalizeLimit(input.limit);

  if (mode === "parity-live") {
    const candles = await getYahooCandles(normalized, limit);
    if (candles && candles.length > 0) {
      return {
        symbol: normalized,
        candles,
        quote: quoteFromCandles(normalized, candles, "yahoo-live"),
        source: "yahoo-live",
      };
    }
  }

  const state = ensureSymbolState(normalized);
  tickSymbol(state);

  const candles = state.candles.slice(-limit);

  return {
    symbol: state.symbol,
    candles,
    quote: quoteFromCandles(state.symbol, candles, "synthetic-live"),
    source: "synthetic-live",
  };
}

export async function getLiveQuotes(input: {
  symbols: string[];
  mode?: LiveDataMode;
}): Promise<{ quotes: Record<string, LiveQuote>; source: "synthetic-live" | "yahoo-live" }> {
  const mode = input.mode ?? "default";
  const quotes: Record<string, LiveQuote> = {};

  const symbols = input.symbols
    .map((symbol) => normalizeSymbol(symbol))
    .filter((symbol, index, all) => Boolean(symbol) && all.indexOf(symbol) === index);

  if (mode === "parity-live" && symbols.length > 0) {
    const yahooQuotes = await getYahooQuotesMap(symbols);
    for (const symbol of symbols) {
      const yahooQuote = yahooQuotes[symbol];
      if (yahooQuote) {
        quotes[symbol] = yahooQuote;
        continue;
      }

      const state = ensureSymbolState(symbol);
      tickSymbol(state);
      quotes[symbol] = quoteFromCandles(symbol, state.candles, "synthetic-live");
    }

    return {
      quotes,
      source: Object.values(quotes).some((quote) => quote.source === "yahoo-live")
        ? "yahoo-live"
        : "synthetic-live",
    };
  }

  symbols.forEach((symbol) => {
    const state = ensureSymbolState(symbol);
    tickSymbol(state);
    quotes[symbol] = quoteFromCandles(symbol, state.candles, "synthetic-live");
  });

  return {
    quotes,
    source: "synthetic-live",
  };
}
