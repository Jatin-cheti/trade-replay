/**
 * Yahoo Finance v8 historical candles via the public chart API.
 * Uses axios (already a project dependency) — no additional packages needed.
 * No API key required; Yahoo Finance is a public endpoint for OHLCV data.
 */

import axios from "axios";
import { logger } from "../utils/logger";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface HistoricalCandle {
  time: number;   // Unix timestamp seconds UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Exchange → Yahoo Finance suffix mapping
// ──────────────────────────────────────────────────────────────────────────────

const YAHOO_SUFFIX: Record<string, string> = {
  // India
  NSE: ".NS",
  BSE: ".BO",
  // UK
  LSE: ".L",
  // Canada
  TSX: ".TO",
  TSXV: ".V",
  // Australia
  ASX: ".AX",
  // Singapore
  SGX: ".SI",
  // Hong Kong
  HKEX: ".HK",
  HKG: ".HK",
  // Germany
  XETRA: ".DE",
  XETR: ".DE",
  FWB: ".F",
  // France
  ENXTPA: ".PA",
  EURONEXTPA: ".PA",
  // Netherlands
  ENXTAM: ".AS",
  // Belgium
  ENXTBR: ".BR",
  // Italy
  MTA: ".MI",
  // Spain
  BME: ".MC",
  // Switzerland
  SWX: ".SW",
  // Japan
  TSE: ".T",
  // South Korea
  KRX: ".KS",
  KOSDAQ: ".KQ",
  // Brazil
  B3: ".SA",
  BOVESPA: ".SA",
  // US exchanges — no suffix needed
  NYSE: "",
  NASDAQ: "",
  AMEX: "",
  ARCA: "",
  BATS: "",
  CBOE: "",
  OTC: "",
  OTCBB: "",
  OTCMKTS: "",
};

// Interval map: internal resolution code → Yahoo Finance interval string
const INTERVAL_MAP: Record<string, string> = {
  "1":   "1m",
  "2":   "2m",
  "5":   "5m",
  "15":  "15m",
  "30":  "30m",
  "60":  "60m",
  "D":   "1d",
  "W":   "1wk",
  "M":   "1mo",
};

// ──────────────────────────────────────────────────────────────────────────────
// In-memory response cache (avoids hammering Yahoo on repeated identical calls)
// ──────────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  candles: HistoricalCandle[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(yahooSymbol: string, interval: string, fromSec: number, toSec: number): string {
  // Round timestamps to coarse buckets to maximise cache hits
  const fromBucket = Math.floor(fromSec / 3600) * 3600;
  const toBucket   = Math.floor(toSec  / 3600) * 3600;
  return `${yahooSymbol}:${interval}:${fromBucket}:${toBucket}`;
}

function cacheTtlMs(interval: string): number {
  // Daily / weekly / monthly data: cache 1 hour
  if (["1d", "1wk", "1mo"].includes(interval)) return 60 * 60 * 1000;
  // Intraday: cache 5 minutes
  return 5 * 60 * 1000;
}

// Intraday intervals require the `range` query param instead of period1/period2
// because Yahoo Finance returns 422 for NSE when using explicit timestamps.
const INTRADAY_INTERVALS = new Set(["1m", "2m", "5m", "15m", "30m"]);

/**
 * Infers the Yahoo Finance `range` string for intraday intervals.
 * 1m supports max 7 days; 5m/15m/30m support up to 60 days.
 */
function inferYahooRange(interval: string): string {
  switch (interval) {
    case "1m":  return "1d";   // 1D period: today's session only
    case "2m":
    case "5m":  return "5d";   // 5D period: last 5 trading days
    case "15m":
    case "30m": return "1mo";  // 1M period: last month
    default:    return "1mo";
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Public helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Converts a base symbol + exchange to the correct Yahoo Finance ticker.
 * e.g. ("RELIANCE", "NSE") → "RELIANCE.NS"
 */
export function toYahooSymbol(symbol: string, exchange?: string | null): string {
  // Already has a dot suffix (e.g. "BRK.A") — leave as-is
  if (/\.[A-Z]{1,2}$/.test(symbol)) return symbol;

  const suffix = exchange ? (YAHOO_SUFFIX[exchange.trim().toUpperCase()] ?? "") : "";
  return symbol + suffix;
}

/**
 * Fetches historical OHLCV candles from Yahoo Finance.
 * Returns candles sorted ascending by time.
 * Throws on network error or if Yahoo returns no result.
 */
export async function fetchYahooCandles(
  yahooSymbol: string,
  resolution: string,
  fromSec: number,
  toSec: number,
): Promise<HistoricalCandle[]> {
  const interval = INTERVAL_MAP[resolution] ?? "1d";
  const key = cacheKey(yahooSymbol, interval, fromSec, toSec);

  // Cache hit
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.candles;
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`;

  // For intraday intervals, Yahoo Finance requires `range` instead of period1/period2
  // Using period1/period2 with 1m/5m/15m/30m causes 422 for NSE stocks.
  const useRange = INTRADAY_INTERVALS.has(interval);
  const queryParams = useRange
    ? { range: inferYahooRange(interval), interval, includePrePost: "false" }
    : { period1: String(Math.floor(fromSec)), period2: String(Math.floor(toSec)), interval, includePrePost: "false", events: "div,splits" };

  const res = await axios.get<unknown>(url, {
    params: queryParams,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FinancialApp/2.0)",
      "Accept":     "application/json",
    },
    timeout: 12_000,
  });

  const result = (res.data as Record<string, unknown>);
  const chartData = (result["chart"] as Record<string, unknown>);
  const results   = chartData?.["result"] as Array<Record<string, unknown>> | null;

  if (!results?.length) {
    throw new Error(`Yahoo Finance returned no chart result for ${yahooSymbol}`);
  }

  const row        = results[0];
  const timestamps = (row["timestamp"] as number[]) ?? [];
  const indicators = (row["indicators"] as Record<string, unknown>) ?? {};
  const quotes     = ((indicators["quote"] as Array<Record<string, (number | null)[]>>) ?? [])[0] ?? {};

  const opens   = (quotes["open"]   ?? []) as (number | null)[];
  const highs   = (quotes["high"]   ?? []) as (number | null)[];
  const lows    = (quotes["low"]    ?? []) as (number | null)[];
  const closes  = (quotes["close"]  ?? []) as (number | null)[];
  const volumes = (quotes["volume"] ?? []) as (number | null)[];

  const candles: HistoricalCandle[] = timestamps
    .map((t, i) => {
      const c = closes[i];
      if (c == null || !Number.isFinite(c) || c <= 0) return null;
      return {
        time:   t,
        open:   opens[i]   ?? c,
        high:   highs[i]   ?? c,
        low:    lows[i]    ?? c,
        close:  c,
        volume: volumes[i] ?? 0,
      } satisfies HistoricalCandle;
    })
    .filter((c): c is HistoricalCandle => c !== null)
    .sort((a, b) => a.time - b.time);

  logger.info("yahoo_finance_candles_ok", {
    symbol:   yahooSymbol,
    interval,
    count:    candles.length,
    firstTs:  candles[0]?.time,
    lastTs:   candles[candles.length - 1]?.time,
  });

  cache.set(key, { candles, expiresAt: Date.now() + cacheTtlMs(interval) });
  return candles;
}
