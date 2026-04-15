/**
 * TradingView Advanced Charts Datafeed API
 * Implements the UDF (Universal Data Feed) protocol used by TV Advanced Charts.
 * Docs: https://www.tradingview.com/charting-library-docs/latest/connecting_data/UDF/
 *
 * Endpoints:
 *   GET /datafeed/config          - datafeed capabilities
 *   GET /datafeed/symbols         - symbol metadata lookup
 *   GET /datafeed/search          - symbol search
 *   GET /datafeed/history         - OHLCV bars
 *   GET /datafeed/marks           - optional trade marks on chart
 *   GET /datafeed/timescale_marks - optional timescale marks
 *   GET /datafeed/server_time     - server unix timestamp (sec)
 */

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types/auth";
import { SymbolModel } from "../models/Symbol";
import { searchSymbols } from "./symbol.service";
import { getFallbackCandles } from "./fallbackData";
import { getCachedJson, setCachedJson } from "./cache.service";
import { clusterScopedKey } from "./redisKey.service";

// ─── config ────────────────────────────────────────────────────────────────

const SUPPORTED_RESOLUTIONS = ["1", "3", "5", "15", "30", "60", "120", "240", "D", "W", "M"];

export function datafeedConfig() {
  return {
    supported_resolutions: SUPPORTED_RESOLUTIONS,
    supports_search: true,
    supports_group_request: false,
    supports_marks: true,
    supports_timescale_marks: true,
    supports_time: true,
    exchanges: [
      { value: "NSE",    name: "NSE India",   desc: "National Stock Exchange of India" },
      { value: "BSE",    name: "BSE India",   desc: "Bombay Stock Exchange" },
      { value: "NASDAQ", name: "NASDAQ",      desc: "NASDAQ US" },
      { value: "NYSE",   name: "NYSE",        desc: "New York Stock Exchange" },
      { value: "BINANCE",name: "Binance",     desc: "Binance Crypto Exchange" },
    ],
    symbols_types: [
      { name: "All",    value: ""       },
      { name: "Stocks", value: "stock"  },
      { name: "Crypto", value: "crypto" },
      { name: "Forex",  value: "forex"  },
      { name: "Index",  value: "index"  },
    ],
  };
}

// ─── server time ───────────────────────────────────────────────────────────

export function serverTime() {
  return { time: Math.floor(Date.now() / 1000) };
}

// ─── symbol resolution ─────────────────────────────────────────────────────

type UdfSymbolInfo = {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  listed_exchange: string;
  type: string;
  currency_code: string;
  session: string;
  timezone: string;
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  has_daily: boolean;
  has_weekly_and_monthly: boolean;
  supported_resolutions: string[];
  logo_urls: string[];
  original_currency_code?: string;
};

function sessionByExchange(exchange: string): string {
  const e = (exchange || "").toUpperCase();
  if (e === "NSE" || e === "BSE") return "0915-1530:12345";
  if (e === "NASDAQ" || e === "NYSE") return "0930-1600:12345";
  if (e === "LSE") return "0800-1630:12345";
  return "24x7";
}

function timezoneByExchange(exchange: string): string {
  const e = (exchange || "").toUpperCase();
  if (e === "NSE" || e === "BSE") return "Asia/Kolkata";
  if (e === "NASDAQ" || e === "NYSE") return "America/New_York";
  if (e === "LSE") return "Europe/London";
  return "Etc/UTC";
}

function pricescaleForSymbol(currency: string): number {
  const c = (currency || "INR").toUpperCase();
  if (c === "JPY") return 100;
  return 100; // 2 decimal places
}

async function resolveSymbol(symbolName: string): Promise<UdfSymbolInfo | null> {
  const upper = symbolName.trim().toUpperCase();
  // Handles both "NSE:RELIANCE" and "RELIANCE"
  let query: Record<string, string>;
  if (upper.includes(":")) {
    query = { fullSymbol: upper };
  } else {
    query = { symbol: upper };
  }

  const doc = await SymbolModel.findOne(query)
    .select({ symbol: 1, fullSymbol: 1, name: 1, exchange: 1, type: 1, currency: 1, iconUrl: 1, s3Icon: 1 })
    .sort({ priorityScore: -1 })
    .lean<{
      symbol: string; fullSymbol: string; name: string;
      exchange: string; type: string; currency: string;
      iconUrl?: string; s3Icon?: string;
    } | null>();

  if (!doc) return null;

  const icon = doc.iconUrl || doc.s3Icon || "";

  return {
    symbol: doc.fullSymbol,
    full_name: `${doc.exchange}:${doc.symbol}`,
    description: doc.name,
    exchange: doc.exchange,
    listed_exchange: doc.exchange,
    type: doc.type,
    currency_code: doc.currency || "USD",
    session: sessionByExchange(doc.exchange),
    timezone: timezoneByExchange(doc.exchange),
    minmov: 1,
    pricescale: pricescaleForSymbol(doc.currency),
    has_intraday: true,
    has_daily: true,
    has_weekly_and_monthly: true,
    supported_resolutions: SUPPORTED_RESOLUTIONS,
    logo_urls: icon ? [icon] : [],
  };
}

// ─── search ────────────────────────────────────────────────────────────────

type UdfSearchResult = {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  type: string;
  logo_urls: string[];
};

async function searchForSymbols(
  query: string,
  type: string,
  exchange: string,
  limit: number,
  userId?: string,
): Promise<UdfSearchResult[]> {
  const results = await searchSymbols({
    query,
    type: type || undefined,
    country: undefined,
    limit: Math.min(limit, 50),
    skipLogoEnrichment: true,
    skipSearchFrequencyUpdate: true,
    trackMetrics: false,
    userId,
  });

  return results.items.map((item) => ({
    symbol: item.fullSymbol,
    full_name: `${item.exchange}:${item.symbol}`,
    description: item.name,
    exchange: item.exchange,
    type: item.type,
    logo_urls: item.displayIconUrl ? [item.displayIconUrl] : [],
  }));
}

// ─── historical bars ────────────────────────────────────────────────────────

type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };

type UdfHistoryResponse =
  | { s: "ok"; t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[] }
  | { s: "no_data"; nextTime?: number }
  | { s: "error"; errmsg: string };

function resolutionToMinutes(resolution: string): number {
  if (resolution === "D") return 1440;
  if (resolution === "W") return 10080;
  if (resolution === "M") return 43200;
  return Number.parseInt(resolution, 10) || 60;
}

function candleDurationMs(resolution: string): number {
  return resolutionToMinutes(resolution) * 60 * 1000;
}

/**
 * Build OHLCV bars from the fallback candle dataset (scenario-based historical data)
 * or from the real simulation session data.
 * In production this would query a time-series DB like TimescaleDB or InfluxDB.
 */
async function getHistoricalBars(
  symbolName: string,
  resolution: string,
  fromSec: number,
  toSec: number,
): Promise<UdfHistoryResponse> {
  const upper = symbolName.trim().toUpperCase();
  const rawSymbol = upper.includes(":") ? upper.split(":").pop()! : upper;
  const candleMs = candleDurationMs(resolution);

  // Try fallback candles for known scenarios
  const SCENARIOS = ["2008-crash", "covid", "dotcom"];
  let allCandles: Bar[] = [];

  for (const scenario of SCENARIOS) {
    const raw = getFallbackCandles(scenario, rawSymbol);
    if (raw.length > 0) {
      // Retime candles to end at "now" spread backwards
      const nowMs = Date.now();
      const durationMs = raw.length * candleMs;
      const startMs = nowMs - durationMs;
      allCandles = raw.map((c, i) => ({
        time: Math.floor((startMs + i * candleMs) / 1000),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
      break;
    }
  }

  if (allCandles.length === 0) {
    // Generate synthetic candles
    allCandles = generateSyntheticBars(rawSymbol, fromSec, toSec, candleMs);
  }

  const filtered = allCandles.filter((b) => b.time >= fromSec && b.time <= toSec);

  if (filtered.length === 0) {
    const lastBefore = allCandles.filter((b) => b.time < fromSec).pop();
    return { s: "no_data", nextTime: lastBefore ? lastBefore.time : undefined };
  }

  return {
    s: "ok",
    t: filtered.map((b) => b.time),
    o: filtered.map((b) => b.open),
    h: filtered.map((b) => b.high),
    l: filtered.map((b) => b.low),
    c: filtered.map((b) => b.close),
    v: filtered.map((b) => b.volume),
  };
}

function generateSyntheticBars(
  symbol: string,
  fromSec: number,
  toSec: number,
  candleMs: number,
): Bar[] {
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bars: Bar[] = [];
  let price = 100 + (seed % 900); // deterministic start price per symbol

  let tSec = fromSec;
  while (tSec <= toSec) {
    const t = tSec + seed;
    const move = (Math.sin(t / 8000) * 0.015) + (Math.cos(t / 3333) * 0.008) + ((seed % 11 - 5) * 0.0001);
    const open = price;
    const close = Math.max(0.01, price * (1 + move));
    const spread = Math.max(open, close) * 0.005;
    bars.push({
      time: tSec,
      open: Number(open.toFixed(2)),
      high: Number((Math.max(open, close) + spread).toFixed(2)),
      low: Number((Math.max(0.01, Math.min(open, close) - spread)).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.max(1000, (seed * 100 + tSec) % 1000000),
    });
    price = close;
    tSec += Math.floor(candleMs / 1000);
  }
  return bars;
}

// ─── marks (trade markers on chart) ────────────────────────────────────────

export interface TradeMarkInput {
  id: string;
  time: number;
  color: "red" | "green" | "blue" | "yellow" | "orange";
  text: string;
  label: string;
  labelFontColor: string;
  minSize: number;
}

// ─── controller factory ─────────────────────────────────────────────────────

export function createDatafeedController() {
  return {
    config: (_req: Request, res: Response) => {
      res.json(datafeedConfig());
    },

    serverTime: (_req: Request, res: Response) => {
      res.json(serverTime());
    },

    symbols: async (req: Request, res: Response) => {
      const symbolParam = typeof req.query.symbol === "string" ? req.query.symbol : "";
      if (!symbolParam) {
        res.status(400).json({ s: "error", errmsg: "symbol param required" });
        return;
      }

      const cacheKey = clusterScopedKey("app:datafeed:symbol", symbolParam.toUpperCase());
      let info = await getCachedJson<UdfSymbolInfo | null>(cacheKey);
      if (info === null) {
        info = await resolveSymbol(symbolParam);
        if (info) await setCachedJson(cacheKey, info, 300);
      }

      if (!info) {
        res.status(404).json({ s: "error", errmsg: "Symbol not found" });
        return;
      }

      res.json(info);
    },

    search: async (req: Request, res: Response) => {
      const query = typeof req.query.query === "string" ? req.query.query : "";
      const type = typeof req.query.type === "string" ? req.query.type : "";
      const exchange = typeof req.query.exchange === "string" ? req.query.exchange : "";
      const limit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 30;
      const userId = (req as AuthenticatedRequest).user?.userId;
      const results = await searchForSymbols(query, type, exchange, limit, userId);
      res.json(results);
    },

    history: async (req: Request, res: Response) => {
      const symbol = typeof req.query.symbol === "string" ? req.query.symbol : "";
      const resolution = typeof req.query.resolution === "string" ? req.query.resolution : "D";
      const from = typeof req.query.from === "string" ? Number.parseInt(req.query.from, 10) : 0;
      const to = typeof req.query.to === "string" ? Number.parseInt(req.query.to, 10) : Math.floor(Date.now() / 1000);

      if (!symbol) {
        res.json({ s: "error", errmsg: "symbol required" });
        return;
      }

      const result = await getHistoricalBars(symbol, resolution, from, to);
      res.json(result);
    },

    marks: (req: Request, res: Response) => {
      // Returns trade markers; in production these come from the trade DB
      res.json([]);
    },

    timescaleMarks: (req: Request, res: Response) => {
      res.json([]);
    },
  };
}