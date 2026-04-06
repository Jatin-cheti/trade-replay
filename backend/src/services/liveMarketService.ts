import { CandleData } from "../types/shared";
import { getFallbackCandles } from "./fallbackData";

export type LiveQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: "synthetic-live";
};

type LiveSymbolState = {
  symbol: string;
  candles: CandleData[];
  lastEmittedAt: number;
};

const LIVE_STEP_MS = 2000;
const MAX_BUFFER = 400;
const stateBySymbol = new Map<string, LiveSymbolState>();

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
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
    source: "synthetic-live",
  };
}

export function getLiveCandles(input: { symbol: string; limit?: number }): { symbol: string; candles: CandleData[]; quote: LiveQuote; source: "synthetic-live" } {
  const state = ensureSymbolState(input.symbol);
  tickSymbol(state);

  const limit = Math.max(20, Math.min(500, Number(input.limit ?? 240)));
  const candles = state.candles.slice(-limit);

  return {
    symbol: state.symbol,
    candles,
    quote: quoteFromCandles(state.symbol, candles),
    source: "synthetic-live",
  };
}

export function getLiveQuotes(input: { symbols: string[] }): { quotes: Record<string, LiveQuote>; source: "synthetic-live" } {
  const quotes: Record<string, LiveQuote> = {};

  input.symbols
    .map((symbol) => normalizeSymbol(symbol))
    .filter((symbol, index, all) => Boolean(symbol) && all.indexOf(symbol) === index)
    .forEach((symbol) => {
      const state = ensureSymbolState(symbol);
      tickSymbol(state);
      quotes[symbol] = quoteFromCandles(symbol, state.candles);
    });

  return {
    quotes,
    source: "synthetic-live",
  };
}
