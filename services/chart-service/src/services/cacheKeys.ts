import type { ChartCandle, IndicatorRequest, TransformType } from "../lib/compute";
import { stableSha256 } from "../lib/hash";

type SourceRequest = {
  symbol?: string;
  timeframe?: string;
  from?: string;
  to?: string;
};

function sanitizeSegment(value: string | number | undefined): string {
  if (value == null) return "na";
  return String(value).trim().replace(/[:\s]+/g, "_") || "na";
}

function sourceWindow(source?: SourceRequest, candles?: ChartCandle[]): {
  symbol: string;
  timeframe: string;
  from: string;
  to: string;
} {
  const first = candles?.[0];
  const last = candles && candles.length > 0 ? candles[candles.length - 1] : undefined;

  return {
    symbol: sanitizeSegment(source?.symbol ?? "custom"),
    timeframe: sanitizeSegment(source?.timeframe ?? "custom"),
    from: sanitizeSegment(source?.from ?? (first ? String(first.time) : "na")),
    to: sanitizeSegment(source?.to ?? (last ? String(last.time) : "na")),
  };
}

export function buildCandlesCacheKey(source?: SourceRequest, candles?: ChartCandle[]): string {
  const window = sourceWindow(source, candles);
  return `v1:chart:candles:${window.symbol}:${window.timeframe}:${window.from}:${window.to}`;
}

export function buildTransformCacheKey(input: {
  source?: SourceRequest;
  candles?: ChartCandle[];
  transformType: TransformType;
  params?: Record<string, number>;
}): string {
  const window = sourceWindow(input.source, input.candles);
  const paramsHash = stableSha256(input.params ?? {});
  return `v1:chart:transform:${sanitizeSegment(input.transformType)}:${paramsHash}:${window.symbol}:${window.timeframe}:${window.from}:${window.to}`;
}

export function buildIndicatorsCacheKey(input: {
  source?: SourceRequest;
  candles?: ChartCandle[];
  indicators: IndicatorRequest[];
}): string {
  const window = sourceWindow(input.source, input.candles);
  const indicatorsHash = stableSha256(
    input.indicators.map((indicator) => ({
      id: indicator.id,
      params: indicator.params ?? {},
    })),
  );
  return `v1:chart:indicators:${indicatorsHash}:${window.symbol}:${window.timeframe}:${window.from}:${window.to}`;
}

export function buildBundleCacheKey(input: {
  source?: SourceRequest;
  candles?: ChartCandle[];
  transformType?: TransformType;
  params?: Record<string, number>;
  indicators?: IndicatorRequest[];
}): string {
  const window = sourceWindow(input.source, input.candles);
  const transformType = sanitizeSegment(input.transformType ?? "none");
  const paramsHash = stableSha256(input.params ?? {});
  const indicatorsHash = stableSha256(
    (input.indicators ?? []).map((indicator) => ({
      id: indicator.id,
      params: indicator.params ?? {},
    })),
  );
  return `v1:chart:bundle:${transformType}:${paramsHash}:${indicatorsHash}:${window.symbol}:${window.timeframe}:${window.from}:${window.to}`;
}
