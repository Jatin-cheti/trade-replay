import type { CandleData } from "@/data/stockData";
import { api } from "@/lib/api";

type IndicatorRequest = {
  id: string;
  params?: Record<string, number>;
};

type TransformType = "renko" | "rangeBars" | "lineBreak" | "kagi" | "pointFigure" | "brick";

type BundleRequest = {
  symbol: string;
  timeframe?: string;
  limit?: number;
  transformType?: TransformType;
  params?: Record<string, number>;
  indicators?: IndicatorRequest[];
};

type BundleResponse = {
  candles?: Array<{
    time: number | string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }>;
  transformed?: {
    candles?: Array<{
      time: number | string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number;
    }>;
  } | null;
  indicators?: unknown;
  cached?: boolean;
  stale?: boolean;
  delegated?: boolean;
  fallbackReason?: string;
};

type CachedEntry = {
  expiresAt: number;
  payload: BundleResult;
};

const memoryCache = new Map<string, CachedEntry>();
const inFlight = new Map<string, Promise<BundleResult>>();
const FRONTEND_BUNDLE_CACHE_MS = 2000;

function cleanupCache(now: number): void {
  for (const [key, value] of memoryCache.entries()) {
    if (value.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function toIsoTime(input: number | string): string {
  if (typeof input === "number") {
    return new Date(input * 1000).toISOString();
  }

  const asNumber = Number(input);
  if (Number.isFinite(asNumber) && String(asNumber) === input) {
    return new Date(asNumber * 1000).toISOString();
  }

  return new Date(input).toISOString();
}

function normalizeCandles(rows: BundleResponse["candles"]): CandleData[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      time: toIsoTime(row.time),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume: Number(row.volume ?? 0),
    }))
    .filter((row) => Number.isFinite(row.open)
      && Number.isFinite(row.high)
      && Number.isFinite(row.low)
      && Number.isFinite(row.close));
}

export type BundleResult = {
  candles: CandleData[];
  transformedCandles: CandleData[];
  indicators: unknown;
  meta: {
    cached: boolean;
    stale: boolean;
    delegated: boolean;
    fallbackReason: string | null;
  };
};

export async function fetchChartBundle(input: BundleRequest): Promise<BundleResult> {
  const requestBody = {
    source: {
      symbol: input.symbol,
      timeframe: input.timeframe ?? "1m",
      limit: input.limit ?? 260,
    },
    transformType: input.transformType,
    params: input.params,
    indicators: input.indicators,
  };

  const key = stableStringify(requestBody);
  const now = Date.now();
  cleanupCache(now);

  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.payload;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const promise = api.post<BundleResponse>("/chart/bundle", requestBody)
    .then((response) => {
      const payload = response.data;
      const result: BundleResult = {
        candles: normalizeCandles(payload.candles),
        transformedCandles: normalizeCandles(payload.transformed?.candles),
        indicators: payload.indicators ?? null,
        meta: {
          cached: Boolean(payload.cached),
          stale: Boolean(payload.stale),
          delegated: Boolean(payload.delegated),
          fallbackReason: payload.fallbackReason ?? null,
        },
      };

      memoryCache.set(key, {
        expiresAt: Date.now() + FRONTEND_BUNDLE_CACHE_MS,
        payload: result,
      });

      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}
