import { CandleData } from "../types/shared";
import { getFallbackCandles } from "./fallbackData";
import { isRedisReady, redisClient } from "../config/redis";
import { SymbolModel } from "../models/Symbol";
import { logger } from "../utils/logger";

export type LiveQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: "snapshot-live";
};

type LiveCandlesResponse = {
  symbol: string;
  candles: CandleData[];
  quote: LiveQuote;
  source: "snapshot-live";
};

type LiveQuotesResponse = {
  quotes: Record<string, LiveQuote>;
  source: "snapshot-live";
};

export type LiveSnapshotResponse = {
  quotes: Record<string, LiveQuote>;
  candlesBySymbol: Record<string, CandleData[]>;
  source: "snapshot-live";
  generatedAt: string;
};

export type LiveSnapshotIngestInput = {
  quotes?: Record<string, Omit<LiveQuote, "symbol" | "source"> & { symbol?: string; source?: string }>;
  candlesBySymbol?: Record<string, CandleData[]>;
};

type LiveSymbolState = {
  symbol: string;
  candles: CandleData[];
  lastEmittedAt: number;
  lastAccessedAt: number;
};

const LIVE_STEP_MS = 2000;
const MAX_BUFFER = 400;
const SNAPSHOT_QUOTE_TTL_SECONDS = 60;
const SNAPSHOT_CANDLES_TTL_SECONDS = 60 * 30;
const SNAPSHOT_QUOTE_PREFIX = "snapshot:quote:";
const SNAPSHOT_CANDLES_PREFIX = "snapshot:candles:1m:";
const HOT_SYMBOLS_KEY = "search:hot_symbols";
const HOT_SYMBOLS_TTL_SECONDS = 180;
const HOT_SYMBOLS_MIN_REFRESH = 40;
const COLD_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const ENGINE_REFRESH_MS = 2000;
const DEFAULT_UNIVERSE = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA", "BTCUSD"];

const stateBySymbol = new Map<string, LiveSymbolState>();
const accessedSymbols = new Set<string>();

let engineStarted = false;
let engineTimer: NodeJS.Timeout | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function seedFromSymbol(symbol: string): number {
  return symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function ensureSymbolState(rawSymbol: string): LiveSymbolState {
  const symbol = normalizeSymbol(rawSymbol);
  const existing = stateBySymbol.get(symbol);
  if (existing) {
    existing.lastAccessedAt = Date.now();
    return existing;
  }

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
    lastAccessedAt: Date.now(),
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
  if (state.candles.length > MAX_BUFFER) {
    state.candles = state.candles.slice(-MAX_BUFFER);
  }
  state.lastEmittedAt = now;
}

function quoteFromCandles(symbol: string, candles: CandleData[]): LiveQuote {
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
    source: "snapshot-live",
  };
}

function quoteKey(symbol: string): string {
  return `${SNAPSHOT_QUOTE_PREFIX}${normalizeSymbol(symbol)}`;
}

function candlesKey(symbol: string): string {
  return `${SNAPSHOT_CANDLES_PREFIX}${normalizeSymbol(symbol)}`;
}

function uniqueSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean)));
}

function markSymbolsAccessed(symbols: string[]): void {
  const normalized = uniqueSymbols(symbols);
  if (!normalized.length) return;

  const now = new Date();
  for (const symbol of normalized) {
    accessedSymbols.add(symbol);
  }

  void (async () => {
    try {
      await SymbolModel.updateMany(
        { symbol: { $in: normalized } },
        {
          $inc: { searchFrequency: 1, searchCount: 1 },
          $set: { lastAccessedAt: now, isHot: true },
        },
      );
    } catch (error) {
      logger.warn("live_snapshot_symbol_touch_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}

async function persistSnapshots(symbols: string[]): Promise<void> {
  const normalized = uniqueSymbols(symbols);
  if (!normalized.length || !isRedisReady()) return;

  const pipeline = redisClient.pipeline();
  for (const symbol of normalized) {
    const state = ensureSymbolState(symbol);
    tickSymbol(state);
    state.lastAccessedAt = Date.now();

    const quote = quoteFromCandles(symbol, state.candles);
    pipeline.set(quoteKey(symbol), JSON.stringify(quote), "EX", SNAPSHOT_QUOTE_TTL_SECONDS);
    pipeline.set(candlesKey(symbol), JSON.stringify(state.candles), "EX", SNAPSHOT_CANDLES_TTL_SECONDS);
    pipeline.sadd(HOT_SYMBOLS_KEY, symbol);
  }
  pipeline.expire(HOT_SYMBOLS_KEY, HOT_SYMBOLS_TTL_SECONDS);

  try {
    await pipeline.exec();
  } catch (error) {
    logger.warn("live_snapshot_persist_failed", {
      message: error instanceof Error ? error.message : String(error),
      symbols: normalized.length,
    });
  }
}

async function getQuotesFromSnapshot(symbols: string[]): Promise<Record<string, LiveQuote>> {
  const normalized = uniqueSymbols(symbols);
  if (!normalized.length) return {};

  const quotes: Record<string, LiveQuote> = {};

  if (isRedisReady()) {
    try {
      const keys = normalized.map((symbol) => quoteKey(symbol));
      const rows = await redisClient.mget(...keys);
      for (let index = 0; index < normalized.length; index += 1) {
        const raw = rows[index];
        if (!raw) continue;
        try {
          quotes[normalized[index]!] = JSON.parse(raw) as LiveQuote;
        } catch {
          // Ignore malformed cache values and rebuild below.
        }
      }
    } catch {
      // Redis is best-effort here.
    }
  }

  const missing = normalized.filter((symbol) => !quotes[symbol]);
  if (missing.length > 0) {
    await persistSnapshots(missing);
    for (const symbol of missing) {
      const state = ensureSymbolState(symbol);
      tickSymbol(state);
      quotes[symbol] = quoteFromCandles(symbol, state.candles);
    }
  }

  return quotes;
}

async function getCandlesFromSnapshot(symbol: string, limit = 240): Promise<CandleData[]> {
  const normalized = normalizeSymbol(symbol);
  const boundedLimit = Math.max(20, Math.min(500, Number(limit || 240)));

  if (isRedisReady()) {
    try {
      const raw = await redisClient.get(candlesKey(normalized));
      if (raw) {
        const parsed = JSON.parse(raw) as CandleData[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(-boundedLimit);
        }
      }
    } catch {
      // Fall back to in-memory snapshot generation.
    }
  }

  const state = ensureSymbolState(normalized);
  tickSymbol(state);
  await persistSnapshots([normalized]);
  return state.candles.slice(-boundedLimit);
}

async function getCandlesBatch(symbols: string[], limit = 220): Promise<Record<string, CandleData[]>> {
  const normalized = uniqueSymbols(symbols);
  const out: Record<string, CandleData[]> = {};
  if (!normalized.length) return out;

  if (isRedisReady()) {
    try {
      const keys = normalized.map((symbol) => candlesKey(symbol));
      const rows = await redisClient.mget(...keys);
      for (let index = 0; index < normalized.length; index += 1) {
        const raw = rows[index];
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as CandleData[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            out[normalized[index]!] = parsed.slice(-Math.max(20, Math.min(500, limit)));
          }
        } catch {
          // Ignore malformed rows.
        }
      }
    } catch {
      // Continue with fallback path.
    }
  }

  const missing = normalized.filter((symbol) => !out[symbol]);
  if (missing.length > 0) {
    await persistSnapshots(missing);
    for (const symbol of missing) {
      const state = ensureSymbolState(symbol);
      tickSymbol(state);
      out[symbol] = state.candles.slice(-Math.max(20, Math.min(500, limit)));
    }
  }

  return out;
}

async function activeUniverse(): Promise<string[]> {
  const local = uniqueSymbols([...accessedSymbols, ...DEFAULT_UNIVERSE]);
  if (!isRedisReady()) return local;

  try {
    const redisSymbols = await redisClient.srandmember(HOT_SYMBOLS_KEY, HOT_SYMBOLS_MIN_REFRESH);
    const all = uniqueSymbols([...local, ...redisSymbols]);
    return all.length > 0 ? all : DEFAULT_UNIVERSE;
  } catch {
    return local;
  }
}

async function runSnapshotTick(): Promise<void> {
  const symbols = await activeUniverse();
  if (!symbols.length) return;

  await persistSnapshots(symbols);

  const cutoff = Date.now() - COLD_WINDOW_MS;
  for (const [symbol, state] of stateBySymbol.entries()) {
    if (state.lastAccessedAt < cutoff) {
      stateBySymbol.delete(symbol);
    }
  }
}

async function runHotColdCleanup(): Promise<void> {
  const cutoff = new Date(Date.now() - COLD_WINDOW_MS);
  try {
    await SymbolModel.updateMany(
      { lastAccessedAt: { $lt: cutoff }, isHot: true },
      { $set: { isHot: false } },
    );
  } catch (error) {
    logger.warn("live_snapshot_hot_cold_cleanup_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startLiveSnapshotEngine(): void {
  if (engineStarted) return;
  engineStarted = true;

  engineTimer = setInterval(() => {
    void runSnapshotTick();
  }, ENGINE_REFRESH_MS);
  engineTimer.unref();

  cleanupTimer = setInterval(() => {
    void runHotColdCleanup();
  }, 60 * 60 * 1000);
  cleanupTimer.unref();

  void runSnapshotTick();
}

export function stopLiveSnapshotEngine(): void {
  if (engineTimer) clearInterval(engineTimer);
  if (cleanupTimer) clearInterval(cleanupTimer);
  engineTimer = null;
  cleanupTimer = null;
  engineStarted = false;
}

export async function getLiveCandles(input: { symbol: string; limit?: number }): Promise<LiveCandlesResponse> {
  const normalized = normalizeSymbol(input.symbol);
  markSymbolsAccessed([normalized]);
  const candles = await getCandlesFromSnapshot(normalized, input.limit ?? 240);
  const quote = quoteFromCandles(normalized, candles);

  await persistSnapshots([normalized]);

  return {
    symbol: normalized,
    candles,
    quote,
    source: "snapshot-live",
  };
}

export async function getLiveQuotes(input: { symbols: string[] }): Promise<LiveQuotesResponse> {
  const normalized = uniqueSymbols(input.symbols);
  markSymbolsAccessed(normalized);
  const quotes = await getQuotesFromSnapshot(normalized);
  await persistSnapshots(normalized);

  return {
    quotes,
    source: "snapshot-live",
  };
}

export async function getLiveSnapshot(input: {
  symbols: string[];
  candleSymbols?: string[];
  candleLimit?: number;
}): Promise<LiveSnapshotResponse> {
  const quoteSymbols = uniqueSymbols(input.symbols);
  const candleSymbols = uniqueSymbols(input.candleSymbols ?? []);
  const all = uniqueSymbols([...quoteSymbols, ...candleSymbols]);

  markSymbolsAccessed(all);

  const [quotes, candlesBySymbol] = await Promise.all([
    getQuotesFromSnapshot(quoteSymbols),
    getCandlesBatch(candleSymbols, input.candleLimit ?? 240),
  ]);

  await persistSnapshots(all);

  return {
    quotes,
    candlesBySymbol,
    generatedAt: new Date().toISOString(),
    source: "snapshot-live",
  };
}

export async function ingestLiveSnapshot(input: LiveSnapshotIngestInput): Promise<{ storedQuotes: number; storedCandles: number; source: "snapshot-live" }> {
  const quoteEntries = Object.entries(input.quotes ?? {});
  const candleEntries = Object.entries(input.candlesBySymbol ?? {});
  const symbols = uniqueSymbols([
    ...quoteEntries.map(([symbol]) => symbol),
    ...candleEntries.map(([symbol]) => symbol),
  ]);

  if (!symbols.length) {
    return { storedQuotes: 0, storedCandles: 0, source: "snapshot-live" };
  }

  const nowIso = new Date().toISOString();
  const pipeline = isRedisReady() ? redisClient.pipeline() : null;
  let storedQuotes = 0;
  let storedCandles = 0;

  for (const symbol of symbols) {
    const normalized = normalizeSymbol(symbol);
    const quoteSeed = input.quotes?.[symbol] ?? input.quotes?.[normalized];
    const candleSeed = input.candlesBySymbol?.[symbol] ?? input.candlesBySymbol?.[normalized];

    if (quoteSeed) {
      const quote: LiveQuote = {
        symbol: normalized,
        price: Number(safeFinite(quoteSeed.price, 0).toFixed(4)),
        change: Number(safeFinite(quoteSeed.change, 0).toFixed(4)),
        changePercent: Number(safeFinite(quoteSeed.changePercent, 0).toFixed(4)),
        volume: Math.max(0, Math.round(safeFinite(quoteSeed.volume, 0))),
        timestamp: quoteSeed.timestamp || nowIso,
        source: "snapshot-live",
      };

      if (pipeline) {
        pipeline.set(quoteKey(normalized), JSON.stringify(quote), "EX", SNAPSHOT_QUOTE_TTL_SECONDS);
      }
      storedQuotes += 1;
    }

    if (Array.isArray(candleSeed) && candleSeed.length > 0) {
      const sanitized = candleSeed
        .map((candle) => ({
          time: candle.time,
          open: Number(safeFinite(candle.open, 0).toFixed(4)),
          high: Number(safeFinite(candle.high, 0).toFixed(4)),
          low: Number(safeFinite(candle.low, 0).toFixed(4)),
          close: Number(safeFinite(candle.close, 0).toFixed(4)),
          volume: Math.max(0, Math.round(safeFinite(candle.volume, 0))),
        }))
        .slice(-MAX_BUFFER);

      const existing = ensureSymbolState(normalized);
      existing.candles = sanitized;
      existing.lastAccessedAt = Date.now();

      if (pipeline) {
        pipeline.set(candlesKey(normalized), JSON.stringify(sanitized), "EX", SNAPSHOT_CANDLES_TTL_SECONDS);
      }
      storedCandles += 1;
    }

    if (pipeline) {
      pipeline.sadd(HOT_SYMBOLS_KEY, normalized);
    }
    accessedSymbols.add(normalized);
  }

  if (pipeline) {
    pipeline.expire(HOT_SYMBOLS_KEY, HOT_SYMBOLS_TTL_SECONDS);
    await pipeline.exec();
  }

  markSymbolsAccessed(symbols);

  return {
    storedQuotes,
    storedCandles,
    source: "snapshot-live",
  };
}

function safeFinite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
