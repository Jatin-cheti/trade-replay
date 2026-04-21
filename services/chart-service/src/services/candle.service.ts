import type { CandleQuery, MultiSymbolCandleQuery, OHLCV, SymbolMetadata, Timeframe } from "../models/candle.model";
import { env } from "../config/env";
import { withCache } from "./cache.service";
import { fetchYahooCandles, isSyntheticCandleSeries } from "./yahoo-chart.service";

// Loop 3 CHART-001: synthetic fallback is DEV-ONLY. Set ALLOW_SYNTHETIC_CANDLES=true
// explicitly to keep legacy behaviour. In production, we prefer surfacing an empty
// array so the client shows a clear "no data" state rather than fictitious prices.
const ALLOW_SYNTHETIC =
  String(process.env.ALLOW_SYNTHETIC_CANDLES ?? "").toLowerCase() === "true";

const KNOWN_SYMBOLS: SymbolMetadata[] = [
  { symbol: "AAPL", description: "Apple Inc.", exchange: "NASDAQ", type: "stock" },
  { symbol: "MSFT", description: "Microsoft Corp.", exchange: "NASDAQ", type: "stock" },
  { symbol: "NVDA", description: "NVIDIA Corp.", exchange: "NASDAQ", type: "stock" },
  { symbol: "BTCUSD", description: "Bitcoin / US Dollar", exchange: "CRYPTO", type: "crypto" },
  { symbol: "ETHUSD", description: "Ethereum / US Dollar", exchange: "CRYPTO", type: "crypto" },
];

const msByTf: Record<Timeframe, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1D": 86_400_000,
  "1W": 604_800_000,
  "1M": 2_592_000_000,
};

function normalizeRows(rows: unknown[]): OHLCV[] {
  return rows
    .map((row) => {
      const c = row as Record<string, unknown>;
      const rawTs = Number(c.timestamp ?? c.time ?? c.t ?? Date.now());
      const timestamp = rawTs < 1_000_000_000_000 ? rawTs * 1000 : rawTs;
      return {
        timestamp,
        open: Number(c.open ?? c.o ?? 0),
        high: Number(c.high ?? c.h ?? 0),
        low: Number(c.low ?? c.l ?? 0),
        close: Number(c.close ?? c.c ?? 0),
        volume: Number(c.volume ?? c.v ?? 0),
      };
    })
    .filter((c) => Number.isFinite(c.timestamp) && Number.isFinite(c.close));
}

function seed(symbol: string): number {
  return symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function syntheticCandles(query: CandleQuery): OHLCV[] {
  const limit = query.limit ?? 300;
  const step = msByTf[query.timeframe] ?? 60_000;
  const end = query.to ?? Date.now();
  const start = query.from ?? (end - (limit * step));
  const out: OHLCV[] = [];
  const rng = seed(query.symbol) % 100;
  let last = 90 + rng;

  for (let t = start; t <= end && out.length < limit; t += step) {
    const drift = Math.sin((t / step) / 8) * 0.6;
    const shock = Math.cos((t / step) / 13) * 0.35;
    const close = Math.max(0.5, last + drift + shock);
    const spread = 0.3 + Math.abs(Math.sin((t / step) / 5));
    const open = last;
    const high = Math.max(open, close) + spread;
    const low = Math.min(open, close) - spread;
    const volume = 1_000 + Math.abs(Math.round((close - open) * 2000)) + rng * 5;
    out.push({ timestamp: t, open, high, low, close, volume });
    last = close;
  }

  return out.slice(-limit);
}

async function fromBackend(query: CandleQuery): Promise<OHLCV[]> {
  const limit = query.limit ?? 300;
  const url = new URL("/api/live/candles", env.BACKEND_URL);
  url.searchParams.set("symbol", query.symbol);
  url.searchParams.set("limit", String(Math.min(limit, 500)));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`CANDLE_SOURCE_FAILED:${response.status}`);
  }

  const payload = await response.json() as { candles?: unknown[] };
  const normalized = normalizeRows(payload.candles ?? []);
  if (normalized.length > 0 && !isSyntheticCandleSeries(normalized)) {
    return normalized;
  }
  // Backend returned empty / synthetic-looking data — fall through to Yahoo.
  throw new Error("CANDLE_SOURCE_EMPTY_OR_SYNTHETIC");
}

export async function getCandles(query: CandleQuery): Promise<OHLCV[]> {
  const key = `candles:${query.symbol}:${query.timeframe}:${query.from ?? "na"}:${query.to ?? "na"}:${query.limit ?? "na"}`;
  return withCache(key, async () => {
    // 1. Try internal backend first (if configured for live data).
    try {
      return await fromBackend(query);
    } catch {
      // fall through
    }
    // 2. Yahoo Finance — real OHLCV, no API key, global coverage.
    try {
      const yahoo = await fetchYahooCandles(query);
      if (!isSyntheticCandleSeries(yahoo.candles)) {
        return yahoo.candles;
      }
    } catch {
      // fall through
    }
    // 3. Synthetic is only permitted when explicitly allowed (dev / CI).
    if (ALLOW_SYNTHETIC) {
      return syntheticCandles(query);
    }
    return [];
  });
}

export async function getMultiCandles(query: MultiSymbolCandleQuery): Promise<Record<string, OHLCV[]>> {
  const entries = await Promise.all(query.symbols.map(async (symbol) => [symbol, await getCandles({ ...query, symbol })] as const));
  return Object.fromEntries(entries);
}

export function getSymbols(): SymbolMetadata[] {
  return KNOWN_SYMBOLS;
}
