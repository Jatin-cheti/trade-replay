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

type BundleInput = {
  candles?: ChartCandle[];
  source?: SourceRequest;
  transformType?: TransformType;
  params?: Record<string, number>;
  indicators?: IndicatorRequest[];
};

type FallbackReason = "timeout" | "breaker_open" | "5xx" | "network" | "unknown";

type BreakerState = "closed" | "open" | "half-open";

type ChartBundleMetrics = {
  delegatedSuccess: number;
  delegatedFail: number;
  fallbackUsed: number;
  latencyCount: number;
  latencyTotalMs: number;
};

type ChartServiceHealth = {
  enabled: boolean;
  url: string;
  breakerState: BreakerState;
  retryCount: number;
  timeoutMs: number;
  metrics: {
    delegated_success: number;
    delegated_fail: number;
    fallback_used: number;
    avg_latency_ms: number;
  };
};

const breaker = {
  state: "closed" as BreakerState,
  failureTimestamps: [] as number[],
  openedAtMs: 0,
};

const bundleMetrics: ChartBundleMetrics = {
  delegatedSuccess: 0,
  delegatedFail: 0,
  fallbackUsed: 0,
  latencyCount: 0,
  latencyTotalMs: 0,
};

type ChartServiceError = Error & {
  reason: FallbackReason;
  retryable: boolean;
};

function nowMs(): number {
  return Date.now();
}

function pruneFailures(ts: number): void {
  const windowStart = ts - env.CHART_SERVICE_BREAKER_FAILURE_WINDOW_MS;
  breaker.failureTimestamps = breaker.failureTimestamps.filter((value) => value >= windowStart);
}

function setBreakerState(next: BreakerState): void {
  if (breaker.state === next) return;
  breaker.state = next;
  logger.info("chart_service_breaker_state_changed", { state: next });
}

function markBreakerSuccess(): void {
  breaker.failureTimestamps = [];
  breaker.openedAtMs = 0;
  setBreakerState("closed");
}

function markBreakerFailure(ts: number): void {
  pruneFailures(ts);
  breaker.failureTimestamps.push(ts);

  if (breaker.state === "half-open") {
    breaker.openedAtMs = ts;
    setBreakerState("open");
    return;
  }

  if (breaker.failureTimestamps.length >= env.CHART_SERVICE_BREAKER_FAILURE_THRESHOLD) {
    breaker.openedAtMs = ts;
    setBreakerState("open");
  }
}

function shouldAllowDelegation(ts: number): boolean {
  if (breaker.state !== "open") {
    return true;
  }

  if ((ts - breaker.openedAtMs) >= env.CHART_SERVICE_BREAKER_COOLDOWN_MS) {
    setBreakerState("half-open");
    return true;
  }

  return false;
}

function isRetryableStatus(status: number): boolean {
  return status >= 500;
}

function classifyError(error: unknown): ChartServiceError {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("CHART_SERVICE_BREAKER_OPEN")) {
    return Object.assign(new Error(message), { reason: "breaker_open" as FallbackReason, retryable: false });
  }

  if (message.includes("ABORT") || message.includes("TIMEOUT")) {
    return Object.assign(new Error(message), { reason: "timeout" as FallbackReason, retryable: true });
  }

  const statusMatch = message.match(/CHART_SERVICE_HTTP_(\d+)/);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    const reason: FallbackReason = status >= 500 ? "5xx" : "unknown";
    return Object.assign(new Error(message), {
      reason,
      retryable: isRetryableStatus(status),
    });
  }

  if (message.includes("fetch") || message.includes("network") || message.includes("ECONN")) {
    return Object.assign(new Error(message), { reason: "network" as FallbackReason, retryable: true });
  }

  return Object.assign(new Error(message), { reason: "unknown" as FallbackReason, retryable: false });
}

function jitterDelayMs(attempt: number): number {
  const base = env.CHART_SERVICE_RETRY_BASE_MS * (attempt + 1);
  return base + Math.floor(Math.random() * 50);
}

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

function markBundleLatency(durationMs: number): void {
  bundleMetrics.latencyCount += 1;
  bundleMetrics.latencyTotalMs += durationMs;
}

function bundleMetricsSnapshot() {
  return {
    delegated_success: bundleMetrics.delegatedSuccess,
    delegated_fail: bundleMetrics.delegatedFail,
    fallback_used: bundleMetrics.fallbackUsed,
    avg_latency_ms: bundleMetrics.latencyCount > 0
      ? Number((bundleMetrics.latencyTotalMs / bundleMetrics.latencyCount).toFixed(2))
      : 0,
  };
}

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

async function delegateWithResilience<T>(path: string, body: unknown): Promise<T> {
  const startedAt = nowMs();
  const ts = nowMs();

  if (!shouldAllowDelegation(ts)) {
    throw Object.assign(new Error("CHART_SERVICE_BREAKER_OPEN"), {
      reason: "breaker_open" as FallbackReason,
      retryable: false,
    });
  }

  const maxAttempts = Math.max(1, env.CHART_SERVICE_RETRY_COUNT + 1);
  let lastError: ChartServiceError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await postChartService<T>(path, body);
      markBreakerSuccess();
      markBundleLatency(nowMs() - startedAt);
      return result;
    } catch (error) {
      const classified = classifyError(error);
      lastError = classified;
      if (!classified.retryable || attempt === maxAttempts - 1) {
        markBreakerFailure(nowMs());
        break;
      }
      await delay(jitterDelayMs(attempt));
    }
  }

  throw (lastError ?? Object.assign(new Error("CHART_SERVICE_DELEGATE_FAILED"), {
    reason: "unknown" as FallbackReason,
    retryable: false,
  }));
}

function fallbackBundle(input: BundleInput) {
  return resolveCandles(input.candles, input.source).then((candles) => {
    const transformed = input.transformType
      ? transformCandlesLocal({ candles, transformType: input.transformType, params: input.params })
      : null;
    const indicators = (input.indicators && input.indicators.length > 0)
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
      delegated: false,
    };
  });
}

function logBundleResult(meta: {
  delegated: boolean;
  latencyMs: number;
  cached: boolean;
  stale: boolean;
  fallbackReason?: FallbackReason;
}) {
  logger.info("chart_bundle_result", {
    delegated: meta.delegated,
    latencyMs: meta.latencyMs,
    cache: meta.cached ? (meta.stale ? "stale_hit" : "hit") : "miss",
    fallbackReason: meta.fallbackReason,
    breakerState: breaker.state,
  });
}

export function resetChartServiceStateForTests(): void {
  breaker.state = "closed";
  breaker.failureTimestamps = [];
  breaker.openedAtMs = 0;
  bundleMetrics.delegatedSuccess = 0;
  bundleMetrics.delegatedFail = 0;
  bundleMetrics.fallbackUsed = 0;
  bundleMetrics.latencyCount = 0;
  bundleMetrics.latencyTotalMs = 0;
}

export function getChartServiceHealthStatus(): ChartServiceHealth {
  return {
    enabled: env.CHART_SERVICE_ENABLED,
    url: env.CHART_SERVICE_URL,
    breakerState: breaker.state,
    retryCount: env.CHART_SERVICE_RETRY_COUNT,
    timeoutMs: env.CHART_SERVICE_TIMEOUT_MS,
    metrics: bundleMetricsSnapshot(),
  };
}

export async function computeIndicators(input: IndicatorComputeInput) {
  if (env.CHART_SERVICE_ENABLED) {
    try {
      return await delegateWithResilience("/compute/indicators", input);
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
      return await delegateWithResilience("/transform", input);
    } catch (error) {
      logger.warn("chart_service_transform_delegate_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const candles = await resolveCandles(input.candles, input.source);
  return transformCandlesLocal({ candles, transformType: input.transformType, params: input.params });
}

export async function computeBundle(input: BundleInput) {
  const startedAt = nowMs();

  if (env.CHART_SERVICE_ENABLED) {
    try {
      const delegated = await delegateWithResilience<{
        candlesCount: number;
        candles: ChartCandle[];
        transformed: unknown;
        indicators: unknown;
        meta: Record<string, unknown>;
        cached?: boolean;
        stale?: boolean;
      }>("/bundle", input);

      bundleMetrics.delegatedSuccess += 1;
      const payload = {
        ...delegated,
        delegated: true,
      };
      logBundleResult({
        delegated: true,
        latencyMs: nowMs() - startedAt,
        cached: Boolean(delegated.cached),
        stale: Boolean(delegated.stale),
      });
      return payload;
    } catch (error) {
      bundleMetrics.delegatedFail += 1;
      const classified = classifyError(error);
      logger.warn("chart_service_bundle_delegate_failed", {
        error: classified.message,
        reason: classified.reason,
        breakerState: breaker.state,
      });

      const fallback = await fallbackBundle(input);
      bundleMetrics.fallbackUsed += 1;
      markBundleLatency(nowMs() - startedAt);
      const payload = {
        ...fallback,
        fallbackReason: classified.reason,
      };
      logBundleResult({
        delegated: false,
        latencyMs: nowMs() - startedAt,
        cached: false,
        stale: false,
        fallbackReason: classified.reason,
      });
      return payload;
    }
  }

  const fallback = await fallbackBundle(input);
  bundleMetrics.fallbackUsed += 1;
  markBundleLatency(nowMs() - startedAt);
  logBundleResult({
    delegated: false,
    latencyMs: nowMs() - startedAt,
    cached: false,
    stale: false,
    fallbackReason: "unknown",
  });
  return {
    ...fallback,
    fallbackReason: "unknown" as FallbackReason,
  };
}
