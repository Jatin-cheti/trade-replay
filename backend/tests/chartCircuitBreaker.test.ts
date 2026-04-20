import assert from "node:assert/strict";
import { computeBundle, getChartServiceHealthStatus, resetChartServiceStateForTests } from "../src/services/chartCompute.service";
import { env } from "../src/config/env";

const originalFetch = globalThis.fetch;

async function run(): Promise<void> {
  const original = {
    enabled: env.CHART_SERVICE_ENABLED,
    threshold: env.CHART_SERVICE_BREAKER_FAILURE_THRESHOLD,
    windowMs: env.CHART_SERVICE_BREAKER_FAILURE_WINDOW_MS,
    cooldownMs: env.CHART_SERVICE_BREAKER_COOLDOWN_MS,
    retries: env.CHART_SERVICE_RETRY_COUNT,
  };

  env.CHART_SERVICE_ENABLED = true;
  env.CHART_SERVICE_BREAKER_FAILURE_THRESHOLD = 2;
  env.CHART_SERVICE_BREAKER_FAILURE_WINDOW_MS = 60_000;
  env.CHART_SERVICE_BREAKER_COOLDOWN_MS = 60_000;
  env.CHART_SERVICE_RETRY_COUNT = 0;

  let delegateCalls = 0;
  globalThis.fetch = (async () => {
    delegateCalls += 1;
    throw new Error("TIMEOUT");
  }) as typeof globalThis.fetch;

  resetChartServiceStateForTests();

  const first = await computeBundle({ source: { symbol: "AAPL", timeframe: "1m", limit: 120 } });
  const second = await computeBundle({ source: { symbol: "AAPL", timeframe: "1m", limit: 120 } });
  const third = await computeBundle({ source: { symbol: "AAPL", timeframe: "1m", limit: 120 } });

  assert.equal((first as { delegated?: boolean }).delegated, false);
  assert.equal((first as { fallbackReason?: string }).fallbackReason, "timeout");
  assert.equal((second as { fallbackReason?: string }).fallbackReason, "timeout");
  assert.equal((third as { fallbackReason?: string }).fallbackReason, "breaker_open");

  const health = getChartServiceHealthStatus();
  assert.equal(health.breakerState, "open");
  assert.equal(delegateCalls, 2);

  env.CHART_SERVICE_ENABLED = original.enabled;
  env.CHART_SERVICE_BREAKER_FAILURE_THRESHOLD = original.threshold;
  env.CHART_SERVICE_BREAKER_FAILURE_WINDOW_MS = original.windowMs;
  env.CHART_SERVICE_BREAKER_COOLDOWN_MS = original.cooldownMs;
  env.CHART_SERVICE_RETRY_COUNT = original.retries;
  globalThis.fetch = originalFetch;

  console.log("chartCircuitBreaker.test.ts passed");
}

void run();
