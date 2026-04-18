import { CandleData } from "../types/shared";

export interface YahooIntradayRequest {
  symbol: string;
  interval?: "1m" | "2m" | "5m" | "15m" | "30m" | "60m";
  range?: "1d" | "5d" | "1mo";
  timeoutMs?: number;
}

export interface YahooQuoteSnapshot {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: Array<{
      symbol?: string;
      regularMarketPrice?: number;
      regularMarketChange?: number;
      regularMarketChangePercent?: number;
      regularMarketVolume?: number;
      regularMarketTime?: number;
    }>;
  };
};

const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const YAHOO_QUOTE_BASE = "https://query1.finance.yahoo.com/v7/finance/quote";
const DEFAULT_TIMEOUT_MS = 5000;

const SYMBOL_ALIASES: Record<string, string> = {
  BTCUSD: "BTC-USD",
  ETHUSD: "ETH-USD",
  BTCUSDT: "BTC-USD",
  ETHUSDT: "ETH-USD",
  EURUSD: "EURUSD=X",
  USDJPY: "USDJPY=X",
  XAUUSD: "GC=F",
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function resolveYahooSymbol(rawSymbol: string): string {
  const normalized = normalizeSymbol(rawSymbol);
  if (!normalized) return normalized;

  if (SYMBOL_ALIASES[normalized]) {
    return SYMBOL_ALIASES[normalized];
  }

  return normalized;
}

function withTimeout(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function toFiniteNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export async function fetchYahooIntradayCandles(request: YahooIntradayRequest): Promise<CandleData[] | null> {
  const symbol = resolveYahooSymbol(request.symbol);
  if (!symbol) return null;

  const url = new URL(`${YAHOO_CHART_BASE}${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", request.interval ?? "1m");
  url.searchParams.set("range", request.range ?? "1d");
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div,splits");

  const timer = withTimeout(request.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: timer.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as YahooChartResponse;
    const result = payload.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];

    if (!Array.isArray(timestamps) || !quote) {
      return null;
    }

    const candles: CandleData[] = [];
    let previousClose: number | null = null;

    for (let index = 0; index < timestamps.length; index += 1) {
      const timeSec = toFiniteNumber(timestamps[index]);
      const open = toFiniteNumber(quote.open?.[index]);
      const high = toFiniteNumber(quote.high?.[index]);
      const low = toFiniteNumber(quote.low?.[index]);
      const close = toFiniteNumber(quote.close?.[index]);
      const volume = toFiniteNumber(quote.volume?.[index]) ?? 0;

      if (timeSec == null || open == null || high == null || low == null || close == null) {
        continue;
      }

      if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
        continue;
      }

      const normalizedHigh = Math.max(high, open, close);
      const normalizedLow = Math.min(low, open, close);
      if (normalizedHigh < normalizedLow) {
        continue;
      }

      if (previousClose != null && previousClose > 0) {
        const openJump = Math.abs(open - previousClose) / previousClose;
        const closeJump = Math.abs(close - previousClose) / previousClose;
        // Drop clearly corrupt ticks that would collapse price scale (e.g. 0-valued rows).
        if (openJump > 0.35 && closeJump > 0.35) {
          continue;
        }
      }

      candles.push({
        time: new Date(timeSec * 1000).toISOString(),
        open,
        high: normalizedHigh,
        low: normalizedLow,
        close,
        volume: Math.max(0, Math.round(volume)),
      });
      previousClose = close;
    }

    if (candles.length === 0) {
      return null;
    }

    candles.sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
    return candles;
  } catch {
    return null;
  } finally {
    timer.clear();
  }
}

export async function fetchYahooQuotes(symbols: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<YahooQuoteSnapshot[] | null> {
  const normalizedSymbols = Array.from(new Set(symbols.map((symbol) => normalizeSymbol(symbol)).filter(Boolean)));
  if (normalizedSymbols.length === 0) return [];

  const requestedToYahoo = new Map<string, string>();
  const yahooToRequested = new Map<string, string>();

  for (const symbol of normalizedSymbols) {
    const yahooSymbol = resolveYahooSymbol(symbol);
    requestedToYahoo.set(symbol, yahooSymbol);
    if (!yahooToRequested.has(yahooSymbol)) {
      yahooToRequested.set(yahooSymbol, symbol);
    }
  }

  const url = new URL(YAHOO_QUOTE_BASE);
  url.searchParams.set("symbols", Array.from(yahooToRequested.keys()).join(","));

  const timer = withTimeout(timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: timer.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as YahooQuoteResponse;
    const rows = payload.quoteResponse?.result ?? [];

    const snapshots: YahooQuoteSnapshot[] = [];

    for (const row of rows) {
      const yahooSymbol = normalizeSymbol(row.symbol ?? "");
      const requestedSymbol = yahooToRequested.get(yahooSymbol);
      if (!requestedSymbol) continue;

      const price = toFiniteNumber(row.regularMarketPrice);
      const change = toFiniteNumber(row.regularMarketChange) ?? 0;
      const changePercent = toFiniteNumber(row.regularMarketChangePercent) ?? 0;
      const volume = toFiniteNumber(row.regularMarketVolume) ?? 0;
      const timeSec = toFiniteNumber(row.regularMarketTime);

      if (price == null) continue;

      snapshots.push({
        symbol: requestedSymbol,
        price,
        change,
        changePercent,
        volume: Math.max(0, Math.round(volume)),
        timestamp: new Date((timeSec ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      });
    }

    return snapshots;
  } catch {
    return null;
  } finally {
    timer.clear();
  }
}
