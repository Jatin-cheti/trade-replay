import type { Timeframe } from "../models/candle.model";
import { getCandles } from "./candle.service";
import {
  computeIndicatorsLocal,
  transformCandlesLocal,
  type ChartCandle,
  type IndicatorRequest,
  type TransformType,
} from "../lib/legacy-compute";

export type LegacySourceRequest = {
  symbol: string;
  timeframe?: string;
  from?: string | number;
  to?: string | number;
  limit?: number;
  dataMode?: "default" | "parity-live";
  authToken?: string;
};

export type LegacyComputeIndicatorsInput = {
  candles?: ChartCandle[];
  source?: LegacySourceRequest;
  indicators: IndicatorRequest[];
};

export type LegacyTransformInput = {
  candles?: ChartCandle[];
  source?: LegacySourceRequest;
  transformType: TransformType;
  params?: Record<string, number>;
};

export type LegacyBundleInput = {
  candles?: ChartCandle[];
  source?: LegacySourceRequest;
  transformType?: TransformType;
  params?: Record<string, number>;
  indicators?: IndicatorRequest[];
};

const VALID_TIMEFRAMES = new Set<Timeframe>(["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W", "1M"]);

function toTimeframe(value?: string): Timeframe {
  if (value && VALID_TIMEFRAMES.has(value as Timeframe)) {
    return value as Timeframe;
  }
  return "1m";
}

function toNumber(value: string | number | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function mapToChartCandle(rows: Awaited<ReturnType<typeof getCandles>>): ChartCandle[] {
  return rows.map((row) => ({
    time: Math.floor(row.timestamp / 1000),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  }));
}

async function resolveCandles(candles?: ChartCandle[], source?: LegacySourceRequest): Promise<ChartCandle[]> {
  if (Array.isArray(candles) && candles.length > 0) {
    return candles;
  }

  if (!source?.symbol) {
    return [];
  }

  const rows = await getCandles({
    symbol: source.symbol,
    timeframe: toTimeframe(source.timeframe),
    from: toNumber(source.from),
    to: toNumber(source.to),
    limit: source.limit,
  });

  return mapToChartCandle(rows);
}

export async function computeIndicatorsLegacy(input: LegacyComputeIndicatorsInput) {
  const candles = await resolveCandles(input.candles, input.source);
  return computeIndicatorsLocal({ candles, indicators: input.indicators });
}

export async function transformCandlesLegacy(input: LegacyTransformInput) {
  const candles = await resolveCandles(input.candles, input.source);
  return transformCandlesLocal({
    candles,
    transformType: input.transformType,
    params: input.params,
  });
}

export async function computeBundleLegacy(input: LegacyBundleInput) {
  const candles = await resolveCandles(input.candles, input.source);
  const transformed = input.transformType
    ? transformCandlesLocal({ candles, transformType: input.transformType, params: input.params })
    : null;
  const indicators = input.indicators && input.indicators.length > 0
    ? computeIndicatorsLocal({ candles: transformed?.candles ?? candles, indicators: input.indicators })
    : null;

  return {
    candlesCount: candles.length,
    candles,
    transformed,
    indicators,
    meta: {
      symbol: input.source?.symbol ?? null,
      timeframe: input.source?.timeframe ?? null,
      from: input.source?.from ?? null,
      to: input.source?.to ?? null,
    },
    cached: false,
    stale: false,
  };
}
