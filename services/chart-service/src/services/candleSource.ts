import { env } from "../config/env";
import type { ChartCandle } from "../lib/compute";

type SourceRequest = {
  symbol: string;
  timeframe?: string;
  from?: string;
  to?: string;
  limit?: number;
  authToken?: string;
};

function normalizeFetchedCandles(payload: unknown): ChartCandle[] {
  if (!payload || typeof payload !== "object") return [];

  const rows = Array.isArray((payload as { candles?: unknown }).candles)
    ? (payload as { candles: unknown[] }).candles
    : Array.isArray(payload)
      ? (payload as unknown[])
      : Array.isArray((payload as { data?: unknown }).data)
        ? (payload as { data: unknown[] }).data
        : [];

  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const rawTime = item.time ?? item.timestamp ?? item.ts;
      const asNumberTime = typeof rawTime === "string" ? Date.parse(rawTime) / 1000 : Number(rawTime);
      return {
        time: asNumberTime,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: item.volume == null ? undefined : Number(item.volume),
      } as ChartCandle;
    })
    .filter((row): row is ChartCandle => {
      if (!row) return false;
      return Number.isFinite(row.time)
        && Number.isFinite(row.open)
        && Number.isFinite(row.high)
        && Number.isFinite(row.low)
        && Number.isFinite(row.close);
    });
}

export async function resolveCandles(candles?: ChartCandle[], source?: SourceRequest): Promise<ChartCandle[]> {
  if (Array.isArray(candles) && candles.length > 0) {
    return candles;
  }

  if (!source?.symbol) {
    return [];
  }

  const url = new URL(env.CHART_CANDLE_SOURCE_PATH, env.MAIN_BACKEND_URL);
  url.searchParams.set("symbol", source.symbol);
  if (source.limit) url.searchParams.set("limit", String(source.limit));
  if (source.timeframe) url.searchParams.set("timeframe", source.timeframe);
  if (source.from) url.searchParams.set("from", source.from);
  if (source.to) url.searchParams.set("to", source.to);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, env.CHART_SERVICE_TIMEOUT_MS));

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...(source.authToken ? { Authorization: `Bearer ${source.authToken}` } : {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    return normalizeFetchedCandles((await response.json()) as unknown);
  } finally {
    clearTimeout(timer);
  }
}
