import { env } from "../config/env";
import { logger } from "../utils/logger";
import { getLiveCandles } from "./liveMarketService";
import {
  computeIndicatorsLocal,
  transformCandlesLocal,
  type ChartCandle,
  type IndicatorRequest,
  type TransformType,
} from "./chartComputeLocal.service";

type SourceRequest = {
  symbol: string;
  timeframe?: string;
  from?: string;
  to?: string;
  limit?: number;
};

type IndicatorComputeInput = {
  candles?: ChartCandle[];
  source?: SourceRequest;
  indicators: IndicatorRequest[];
};

type TransformInput = {
  candles?: ChartCandle[];
  source?: SourceRequest;
  transformType: TransformType;
  params?: Record<string, number>;
};

async function resolveCandles(candles?: ChartCandle[], source?: SourceRequest): Promise<ChartCandle[]> {
  if (Array.isArray(candles) && candles.length > 0) {
    return candles;
  }

  if (source?.symbol) {
    const payload = getLiveCandles({ symbol: source.symbol, limit: source.limit });
    return payload.candles.map((row) => ({
      time: Math.floor(new Date(row.time).getTime() / 1000),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    }));
  }

  return [];
}

async function postChartService<T>(path: string, body: unknown): Promise<T> {
  const base = env.CHART_SERVICE_URL.replace(/\/$/, "");
  const url = `${base}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, env.CHART_SERVICE_TIMEOUT_MS));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`CHART_SERVICE_HTTP_${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function computeIndicators(input: IndicatorComputeInput) {
  if (env.CHART_SERVICE_ENABLED) {
    try {
      return await postChartService("/compute/indicators", input);
    } catch (error) {
      logger.warn("chart_service_indicator_delegate_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const candles = await resolveCandles(input.candles, input.source);
  return computeIndicatorsLocal({ candles, indicators: input.indicators });
}

export async function transformCandles(input: TransformInput) {
  if (env.CHART_SERVICE_ENABLED) {
    try {
      return await postChartService("/transform", input);
    } catch (error) {
      logger.warn("chart_service_transform_delegate_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const candles = await resolveCandles(input.candles, input.source);
  return transformCandlesLocal({ candles, transformType: input.transformType, params: input.params });
}
