/**
 * Loop 3 — CHART-001: Real OHLCV data from Yahoo Finance (no API key required).
 * Replaces synthetic-only fallback in candle.service.ts with a real data source.
 *
 * Symbol routing:
 *   NSE:<ticker>    -> <ticker>.NS
 *   BSE:<ticker>    -> <ticker>.BO
 *   MCX:<ticker>    -> <ticker>.MCX
 *   CRYPTO:BTCUSD   -> BTC-USD
 *   FOREX:USDINR    -> USDINR=X
 *   <ticker>        -> <ticker>        (assumed US equity)
 *
 * Period/timeframe -> Yahoo interval+range mapping is derived from the incoming
 * CandleQuery timeframe and limit so the existing API surface remains unchanged.
 */

import type { CandleQuery, OHLCV, Timeframe } from "../models/candle.model";

const TF_TO_YAHOO_INTERVAL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "60m",
  "4h": "60m", // Yahoo has no 4h; caller may post-aggregate
  "1D": "1d",
  "1W": "1wk",
  "1M": "1mo",
};

function inferRange(tf: Timeframe, limit: number): string {
  // Pick the smallest Yahoo range that safely covers `limit` candles.
  const small = ["1m", "5m", "15m", "30m"];
  if (small.includes(tf)) {
    if (limit <= 60) return "1d";
    if (limit <= 400) return "5d";
    return "1mo";
  }
  if (tf === "1h" || tf === "4h") {
    if (limit <= 170) return "1mo";
    return "3mo";
  }
  if (tf === "1D") {
    if (limit <= 30) return "1mo";
    if (limit <= 130) return "6mo";
    if (limit <= 260) return "1y";
    if (limit <= 1300) return "5y";
    return "max";
  }
  if (tf === "1W") return limit <= 260 ? "5y" : "max";
  return "max";
}

export function mapToYahooSymbol(fullSymbolOrSymbol: string): string {
  const raw = fullSymbolOrSymbol.trim();
  if (!raw.includes(":")) {
    // Already a plain ticker — return as-is (likely US).
    return raw;
  }
  const [exchange, ticker] = raw.split(":", 2);
  const tickerUpper = ticker.toUpperCase();

  // Index aliases — Yahoo uses ^ prefix for indices regardless of exchange.
  const INDEX_ALIASES: Record<string, string> = {
    "NIFTY": "^NSEI",
    "NIFTY50": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "SENSEX": "^BSESN",
    "SPX": "^GSPC",
    "NDX": "^NDX",
    "DJI": "^DJI",
    "VIX": "^VIX",
    "FTSE": "^FTSE",
    "DAX": "^GDAXI",
    "N225": "^N225",
    "HSI": "^HSI",
  };
  if (INDEX_ALIASES[tickerUpper]) return INDEX_ALIASES[tickerUpper];

  switch (exchange.toUpperCase()) {
    case "NSE":
      return `${ticker}.NS`;
    case "BSE":
      return `${ticker}.BO`;
    case "MCX":
      return `${ticker}.MCX`;
    case "NASDAQ":
    case "NYSE":
    case "NYSEARCA":
    case "AMEX":
    case "CBOE":
      return ticker;
    case "CRYPTO":
      // CRYPTO:BTCUSD  -> BTC-USD ;  CRYPTO:BTCUSDT -> BTC-USD (strip trailing T)
      {
        const m = ticker.match(/^([A-Z0-9]+?)(USDT|USDC|USD)$/i);
        if (m) return `${m[1].toUpperCase()}-USD`;
        return ticker;
      }
    case "FOREX":
      return `${ticker}=X`;
    case "LSE":
      return `${ticker}.L`;
    case "TSE":
    case "TSX":
      return `${ticker}.TO`;
    case "ASX":
      return `${ticker}.AX`;
    case "HKEX":
      return `${ticker}.HK`;
    case "JPX":
    case "TSE_JP":
      return `${ticker}.T`;
    default:
      return ticker;
  }
}

export interface FetchResult {
  candles: OHLCV[];
  source: "yahoo";
  yahooSymbol: string;
}

export async function fetchYahooCandles(query: CandleQuery): Promise<FetchResult> {
  const yahooSymbol = mapToYahooSymbol(query.symbol);
  const interval = TF_TO_YAHOO_INTERVAL[query.timeframe] ?? "1d";
  const limit = query.limit ?? 300;
  const range = inferRange(query.timeframe, limit);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}` +
    `?interval=${interval}&range=${range}&includePrePost=false&events=div,splits`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`YAHOO_HTTP_${res.status}`);
  }

  const payload = (await res.json()) as {
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
      error?: unknown;
    };
  };

  const result = payload.chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const q = result?.indicators?.quote?.[0];

  if (!ts.length || !q) {
    throw new Error("YAHOO_EMPTY_RESULT");
  }

  const candles: OHLCV[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    const v = q.volume?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({
      timestamp: ts[i] * 1000,
      open: Number(o),
      high: Number(h),
      low: Number(l),
      close: Number(c),
      volume: Number(v ?? 0),
    });
  }

  if (!candles.length) {
    throw new Error("YAHOO_NO_VALID_CANDLES");
  }

  // Trim to requested limit (most recent `limit` candles).
  const trimmed = candles.slice(-limit);
  return { candles: trimmed, source: "yahoo", yahooSymbol };
}

/**
 * Detect the Loop 2 synthetic-data signature (open starting at ~100 with tiny
 * arithmetic drift, or volume constantly 1834). Used to guard against regression.
 */
export function isSyntheticCandleSeries(candles: OHLCV[]): boolean {
  if (candles.length < 3) return false;
  const opens = candles.map((c) => c.open);
  const vols = candles.map((c) => c.volume);
  const allSameVol1834 = vols.every((v) => v === 1834);
  if (allSameVol1834) return true;
  const syntheticStart =
    Math.abs(opens[0] - 100) < 20 &&
    opens.every((v, i) => i === 0 || Math.abs(v - opens[i - 1]) < 2);
  return syntheticStart && opens.length > 10;
}
