import { createHash } from "node:crypto";
import { CandleData } from "../types/shared";
import { getFallbackCandles } from "./fallbackData";
import { isRedisReady, redisClient } from "../config/redis";
import { SymbolModel } from "../models/Symbol";
import { logger } from "../utils/logger";
import { recordCacheResult } from "./metrics.service";
import {
  type AssetSnapshotCandlesResponse,
  type AssetSnapshotIngestInput,
  type AssetSnapshotIngestResponse,
  type AssetSnapshotQuote,
  type AssetSnapshotQuotesResponse,
  type AssetSnapshotRequest,
  type AssetSnapshotResponse,
} from "../contracts/assetSnapshot";
import { normalizeSnapshotSymbol, snapshotRedisKeys, uniqueSnapshotSymbols } from "./assetSnapshotKeys.service";

type StoredQuote = {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  lastUpdated: number;
  source: "snapshot-live";
};

type LiveSymbolState = {
  symbol: string;
  candles: CandleData[];
  lastEmittedAt: number;
  lastAccessedAt: number;
};

const LIVE_STEP_MS = 2_000;
const MAX_BUFFER = 400;
const SNAPSHOT_QUOTE_TTL_SECONDS = 60;
const SNAPSHOT_CANDLES_TTL_SECONDS = 60 * 30;
const SNAPSHOT_BATCH_TTL_SECONDS = 2;
const ENGINE_REFRESH_MS = 500;
const ENGINE_BATCH_SIZE = 100;
const HOT_SYMBOLS_LIMIT = 10_000;
const COLD_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_UNIVERSE = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA", "BTCUSDT"];

const stateBySymbol = new Map<string, LiveSymbolState>();
const accessedSymbols = new Set<string>();

let engineStarted = false;
let engineTimer: NodeJS.Timeout | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;
let seededHotUniverse = false;

function waitForYield(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function safeFinite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function seedFromSymbol(symbol: string): number {
  return symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function ensureSymbolState(rawSymbol: string): LiveSymbolState {
  const symbol = normalizeSnapshotSymbol(rawSymbol);
  const existing = stateBySymbol.get(symbol);
  if (existing) {
    existing.lastAccessedAt = Date.now();
    return existing;
  }

  const seedScenario = "2008-crash";
  const seeded = getFallbackCandles(seedScenario, symbol).slice(-300);
  const fallback = seeded.length > 0
    ? seeded
    : getFallbackCandles(seedScenario, `SYN-${symbol}`).slice(-300);

  const nextState: LiveSymbolState = {
    symbol,
    candles: fallback.length > 0 ? fallback : [{
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
  state.candles.push(nextCandle(last, state.symbol, now));
  if (state.candles.length > MAX_BUFFER) {
    state.candles = state.candles.slice(-MAX_BUFFER);
  }
  state.lastEmittedAt = now;
}

function toStoredQuote(symbol: string, candles: CandleData[]): StoredQuote {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const change = last.close - prev.close;
  const changePercent = prev.close === 0 ? 0 : (change / prev.close) * 100;

  return {
    price: Number(last.close.toFixed(4)),
    change: Number(change.toFixed(4)),
    changePercent: Number(changePercent.toFixed(4)),
    volume: last.volume,
    lastUpdated: Date.parse(last.time) || Date.now(),
    source: "snapshot-live",
  };
}

function toPublicQuote(symbol: string, stored: StoredQuote): AssetSnapshotQuote {
  return {
    symbol,
    price: stored.price,
    change: stored.change,
    changePercent: stored.changePercent,
    volume: stored.volume,
    timestamp: new Date(stored.lastUpdated).toISOString(),
    source: stored.source,
  };
}

async function readQuotes(symbols: string[]): Promise<Record<string, AssetSnapshotQuote>> {
  const normalized = uniqueSnapshotSymbols(symbols);
  const quotes: Record<string, AssetSnapshotQuote> = {};
  if (!normalized.length) return quotes;

  if (!isRedisReady()) {
    recordCacheResult("asset_snapshot_quote", false);
    return quotes;
  }

  for (let index = 0; index < normalized.length; index += ENGINE_BATCH_SIZE) {
    const batch = normalized.slice(index, index + ENGINE_BATCH_SIZE);
    const keys = batch.map((symbol) => snapshotRedisKeys.symbol(symbol));
    const rows = await redisClient.mget(...keys);

    rows.forEach((raw, rowIndex) => {
      const symbol = batch[rowIndex]!;
      if (!raw) {
        recordCacheResult("asset_snapshot_quote", false);
        return;
      }

      try {
        const parsed = JSON.parse(raw) as StoredQuote;
        quotes[symbol] = toPublicQuote(symbol, parsed);
        recordCacheResult("asset_snapshot_quote", true);
      } catch {
        recordCacheResult("asset_snapshot_quote", false);
      }
    });

    await waitForYield();
  }

  return quotes;
}

async function readCandles(symbols: string[], limit: number, interval = "1m"): Promise<Record<string, CandleData[]>> {
  const normalized = uniqueSnapshotSymbols(symbols);
  const candlesBySymbol: Record<string, CandleData[]> = {};
  if (!normalized.length || !isRedisReady()) return candlesBySymbol;

  const boundedLimit = Math.max(20, Math.min(500, limit));
  for (let index = 0; index < normalized.length; index += ENGINE_BATCH_SIZE) {
    const batch = normalized.slice(index, index + ENGINE_BATCH_SIZE);
    const keys = batch.map((symbol) => snapshotRedisKeys.candles(symbol, interval));
    const rows = await redisClient.mget(...keys);

    rows.forEach((raw, rowIndex) => {
      const symbol = batch[rowIndex]!;
      if (!raw) {
        recordCacheResult("asset_snapshot_candles", false);
        return;
      }

      try {
        const parsed = JSON.parse(raw) as CandleData[];
        candlesBySymbol[symbol] = parsed.slice(-boundedLimit);
        recordCacheResult("asset_snapshot_candles", true);
      } catch {
        recordCacheResult("asset_snapshot_candles", false);
      }
    });

    await waitForYield();
  }

  return candlesBySymbol;
}

async function refreshHotScores(symbols: string[]): Promise<void> {
  if (!isRedisReady() || symbols.length === 0) return;

  try {
    const docs = await SymbolModel.find({ symbol: { $in: symbols } })
      .select({ symbol: 1, priorityScore: 1, searchCount: 1, searchFrequency: 1 })
      .lean<Array<{ symbol: string; priorityScore?: number; searchCount?: number; searchFrequency?: number }>>();

    if (!docs.length) return;

    const pipeline = redisClient.pipeline();
    for (const doc of docs) {
      const symbol = normalizeSnapshotSymbol(doc.symbol);
      const score = safeFinite(doc.priorityScore, 0) + safeFinite(doc.searchCount, 0) + safeFinite(doc.searchFrequency, 0);
      pipeline.zadd(snapshotRedisKeys.hotSymbols(), score, symbol);
      pipeline.zrem(snapshotRedisKeys.coldSymbols(), symbol);
    }
    await pipeline.exec();
  } catch (error) {
    logger.warn("snapshot_engine_hot_score_refresh_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function markSymbolsAccessed(symbols: string[]): void {
  const normalized = uniqueSnapshotSymbols(symbols);
  if (!normalized.length) return;

  const now = new Date();
  normalized.forEach((symbol) => accessedSymbols.add(symbol));

  void (async () => {
    try {
      await SymbolModel.updateMany(
        { symbol: { $in: normalized } },
        {
          $inc: { searchFrequency: 1, searchCount: 1 },
          $set: { lastAccessedAt: now, isHot: true },
        },
      );
      await refreshHotScores(normalized);
    } catch (error) {
      logger.warn("snapshot_engine_mark_access_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}

async function persistSnapshots(symbols: string[], interval = "1m"): Promise<void> {
  const normalized = uniqueSnapshotSymbols(symbols);
  if (!normalized.length) return;

  for (let index = 0; index < normalized.length; index += ENGINE_BATCH_SIZE) {
    const batch = normalized.slice(index, index + ENGINE_BATCH_SIZE);
    const pipeline = isRedisReady() ? redisClient.pipeline() : null;

    for (const symbol of batch) {
      const state = ensureSymbolState(symbol);
      tickSymbol(state);
      state.lastAccessedAt = Date.now();
      const storedQuote = toStoredQuote(symbol, state.candles);

      if (pipeline) {
        pipeline.set(snapshotRedisKeys.symbol(symbol), JSON.stringify(storedQuote), "EX", SNAPSHOT_QUOTE_TTL_SECONDS);
        pipeline.set(snapshotRedisKeys.candles(symbol, interval), JSON.stringify(state.candles), "EX", SNAPSHOT_CANDLES_TTL_SECONDS);
      }
    }

    if (pipeline) {
      await pipeline.exec();
    }

    await refreshHotScores(batch);
    await waitForYield();
  }
}

async function getOrSeedQuotes(symbols: string[]): Promise<Record<string, AssetSnapshotQuote>> {
  const normalized = uniqueSnapshotSymbols(symbols);
  const quotes = await readQuotes(normalized);
  const missing = normalized.filter((symbol) => !quotes[symbol]);

  if (missing.length > 0) {
    await persistSnapshots(missing);
    for (const symbol of missing) {
      const state = ensureSymbolState(symbol);
      tickSymbol(state);
      quotes[symbol] = toPublicQuote(symbol, toStoredQuote(symbol, state.candles));
    }
  }

  return quotes;
}

async function getOrSeedCandles(symbols: string[], limit: number, interval = "1m"): Promise<Record<string, CandleData[]>> {
  const normalized = uniqueSnapshotSymbols(symbols);
  const candlesBySymbol = await readCandles(normalized, limit, interval);
  const missing = normalized.filter((symbol) => !candlesBySymbol[symbol]);

  if (missing.length > 0) {
    await persistSnapshots(missing, interval);
    for (const symbol of missing) {
      const state = ensureSymbolState(symbol);
      tickSymbol(state);
      candlesBySymbol[symbol] = state.candles.slice(-Math.max(20, Math.min(500, limit)));
    }
  }

  return candlesBySymbol;
}

async function readBatchSnapshot(key: string): Promise<AssetSnapshotResponse | null> {
  if (!isRedisReady()) return null;

  try {
    const raw = await redisClient.get(key);
    if (!raw) {
      recordCacheResult("asset_snapshot_batch", false);
      return null;
    }

    recordCacheResult("asset_snapshot_batch", true);
    return JSON.parse(raw) as AssetSnapshotResponse;
  } catch {
    recordCacheResult("asset_snapshot_batch", false);
    return null;
  }
}

async function writeBatchSnapshot(key: string, payload: AssetSnapshotResponse): Promise<void> {
  if (!isRedisReady()) return;

  try {
    await redisClient.set(key, JSON.stringify(payload), "EX", SNAPSHOT_BATCH_TTL_SECONDS);
  } catch (error) {
    logger.warn("snapshot_engine_batch_cache_write_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function seedHotUniverse(): Promise<void> {
  if (seededHotUniverse || !isRedisReady()) return;
  seededHotUniverse = true;

  try {
    const docs = await SymbolModel.find({})
      .select({ symbol: 1, priorityScore: 1, searchCount: 1, searchFrequency: 1 })
      .sort({ priorityScore: -1, searchFrequency: -1, createdAt: -1 })
      .limit(HOT_SYMBOLS_LIMIT)
      .lean<Array<{ symbol: string; priorityScore?: number; searchCount?: number; searchFrequency?: number }>>();

    const pipeline = redisClient.pipeline();
    for (const doc of docs) {
      const symbol = normalizeSnapshotSymbol(doc.symbol);
      const score = safeFinite(doc.priorityScore, 0) + safeFinite(doc.searchCount, 0) + safeFinite(doc.searchFrequency, 0);
      pipeline.zadd(snapshotRedisKeys.hotSymbols(), score, symbol);
    }
    await pipeline.exec();
  } catch (error) {
    logger.warn("snapshot_engine_seed_hot_universe_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function activeUniverse(): Promise<string[]> {
  await seedHotUniverse();
  const local = uniqueSnapshotSymbols([...DEFAULT_UNIVERSE, ...accessedSymbols]);
  if (!isRedisReady()) return local;

  try {
    const hot = await redisClient.zrevrange(snapshotRedisKeys.hotSymbols(), 0, HOT_SYMBOLS_LIMIT - 1);
    return uniqueSnapshotSymbols([...local, ...hot]);
  } catch {
    return local;
  }
}

async function runSnapshotTick(): Promise<void> {
  const symbols = await activeUniverse();
  if (symbols.length > 0) {
    await persistSnapshots(symbols);
  }

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
    const staleDocs = await SymbolModel.find({ lastAccessedAt: { $lt: cutoff }, isHot: true })
      .select({ symbol: 1 })
      .limit(HOT_SYMBOLS_LIMIT)
      .lean<Array<{ symbol: string }>>();

    if (staleDocs.length === 0) return;

    const symbols = staleDocs.map((doc) => normalizeSnapshotSymbol(doc.symbol));
    await SymbolModel.updateMany(
      { symbol: { $in: symbols } },
      { $set: { isHot: false } },
    );

    if (isRedisReady()) {
      const pipeline = redisClient.pipeline();
      for (const symbol of symbols) {
        pipeline.zrem(snapshotRedisKeys.hotSymbols(), symbol);
        pipeline.zadd(snapshotRedisKeys.coldSymbols(), Date.now(), symbol);
      }
      await pipeline.exec();
    }
  } catch (error) {
    logger.warn("snapshot_engine_hot_cold_cleanup_failed", {
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

export async function getLiveCandles(input: { symbol: string; limit?: number }): Promise<AssetSnapshotCandlesResponse> {
  const symbol = normalizeSnapshotSymbol(input.symbol);
  markSymbolsAccessed([symbol]);
  const candlesBySymbol = await getOrSeedCandles([symbol], input.limit ?? 240);
  const candles = candlesBySymbol[symbol] ?? [];
  const quote = (await getOrSeedQuotes([symbol]))[symbol]!;

  return {
    symbol,
    candles,
    quote,
    source: "snapshot-live",
  };
}

export async function getLiveQuotes(input: { symbols: string[] }): Promise<AssetSnapshotQuotesResponse> {
  const symbols = uniqueSnapshotSymbols(input.symbols);
  markSymbolsAccessed(symbols);
  return {
    quotes: await getOrSeedQuotes(symbols),
    source: "snapshot-live",
  };
}

export async function getLiveSnapshot(input: AssetSnapshotRequest): Promise<AssetSnapshotResponse> {
  const symbols = uniqueSnapshotSymbols(input.symbols);
  const candleSymbols = uniqueSnapshotSymbols(input.candleSymbols ?? []);
  const candleLimit = Math.max(20, Math.min(500, input.candleLimit ?? 240));
  const batchKey = snapshotRedisKeys.batch(symbols, candleSymbols, candleLimit);

  const cached = await readBatchSnapshot(batchKey);
  if (cached) {
    markSymbolsAccessed([...symbols, ...candleSymbols]);
    return cached;
  }

  markSymbolsAccessed([...symbols, ...candleSymbols]);
  const [quotes, candlesBySymbol] = await Promise.all([
    getOrSeedQuotes(symbols),
    getOrSeedCandles(candleSymbols, candleLimit),
  ]);

  const payload: AssetSnapshotResponse = {
    quotes,
    candlesBySymbol,
    generatedAt: new Date().toISOString(),
    source: "snapshot-live",
  };

  await writeBatchSnapshot(batchKey, payload);
  return payload;
}

export async function ingestLiveSnapshot(input: AssetSnapshotIngestInput): Promise<AssetSnapshotIngestResponse> {
  const quoteEntries = Object.entries(input.quotes ?? {});
  const candleEntries = Object.entries(input.candlesBySymbol ?? {});
  const symbols = uniqueSnapshotSymbols([
    ...quoteEntries.map(([symbol]) => symbol),
    ...candleEntries.map(([symbol]) => symbol),
  ]);

  if (!symbols.length) {
    return { storedQuotes: 0, storedCandles: 0, source: "snapshot-live" };
  }

  const now = Date.now();
  let storedQuotes = 0;
  let storedCandles = 0;

  for (let index = 0; index < symbols.length; index += ENGINE_BATCH_SIZE) {
    const batch = symbols.slice(index, index + ENGINE_BATCH_SIZE);
    const pipeline = isRedisReady() ? redisClient.pipeline() : null;

    for (const symbol of batch) {
      const quoteSeed = input.quotes?.[symbol];
      const candleSeed = input.candlesBySymbol?.[symbol];

      if (quoteSeed) {
        const storedQuote: StoredQuote = {
          price: Number(safeFinite(quoteSeed.price, 0).toFixed(4)),
          change: Number(safeFinite(quoteSeed.change, 0).toFixed(4)),
          changePercent: Number(safeFinite(quoteSeed.changePercent, 0).toFixed(4)),
          volume: Math.max(0, Math.round(safeFinite(quoteSeed.volume, 0))),
          lastUpdated: Date.parse(quoteSeed.timestamp) || now,
          source: "snapshot-live",
        };
        if (pipeline) {
          pipeline.set(snapshotRedisKeys.symbol(symbol), JSON.stringify(storedQuote), "EX", SNAPSHOT_QUOTE_TTL_SECONDS);
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
        const state = ensureSymbolState(symbol);
        state.candles = sanitized;
        state.lastAccessedAt = Date.now();
        if (pipeline) {
          pipeline.set(snapshotRedisKeys.candles(symbol, "1m"), JSON.stringify(sanitized), "EX", SNAPSHOT_CANDLES_TTL_SECONDS);
        }
        storedCandles += 1;
      }
    }

    if (pipeline) {
      await pipeline.exec();
    }

    await refreshHotScores(batch);
    await waitForYield();
  }

  markSymbolsAccessed(symbols);
  return {
    storedQuotes,
    storedCandles,
    source: "snapshot-live",
  };
}

export function getSnapshotBatchKeyForDebug(input: AssetSnapshotRequest): string {
  const normalizedSymbols = uniqueSnapshotSymbols(input.symbols);
  const normalizedCandleSymbols = uniqueSnapshotSymbols(input.candleSymbols ?? []);
  const normalizedLimit = Math.max(20, Math.min(500, input.candleLimit ?? 240));
  const raw = JSON.stringify({ symbols: normalizedSymbols, candleSymbols: normalizedCandleSymbols, limit: normalizedLimit });
  return createHash("sha1").update(raw).digest("hex");
}
