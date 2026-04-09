type StressConfig = {
  apiBase: string;
  concurrentUsers: number;
  searchRounds: number;
  queueSpikeJobs: number;
  maxInFlight: number;
};

type LatencySummary = {
  total: number;
  success: number;
  failed: number;
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  statusCodes: Record<string, number>;
};

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

function summarize(latencies: number[], failed: number, statusCodes: Record<string, number>): LatencySummary {
  const total = latencies.length + failed;
  const success = latencies.length;
  const avg = success ? latencies.reduce((sum, ms) => sum + ms, 0) / success : 0;

  return {
    total,
    success,
    failed,
    p50: Number(percentile(latencies, 50).toFixed(2)),
    p95: Number(percentile(latencies, 95).toFixed(2)),
    p99: Number(percentile(latencies, 99).toFixed(2)),
    avg: Number(avg.toFixed(2)),
    statusCodes,
  };
}

async function registerTempUser(apiBase: string): Promise<string> {
  const email = `stress-${Date.now()}@example.com`;
  const response = await fetch(`${apiBase}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "Stress#12345",
      name: "Stress Tester",
    }),
  });

  if (!response.ok) {
    throw new Error(`REGISTER_FAILED_${response.status}`);
  }

  const data = await response.json() as { token?: string };
  if (!data.token) {
    throw new Error("REGISTER_TOKEN_MISSING");
  }

  return data.token;
}

async function timedRequest(url: string, init: RequestInit): Promise<{ ok: boolean; latencyMs: number; statusCode: number }> {
  const startedAt = Date.now();
  const response = await fetch(url, init);
  return {
    ok: response.ok,
    latencyMs: Date.now() - startedAt,
    statusCode: response.status,
  };
}

async function runWithPool(total: number, maxInFlight: number, task: (index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, maxInFlight) }, async () => {
    while (cursor < total) {
      const index = cursor;
      cursor += 1;
      // eslint-disable-next-line no-await-in-loop
      await task(index);
    }
  });

  await Promise.all(workers);
}

async function runConcurrentSearchLoad(config: StressConfig, token: string): Promise<LatencySummary> {
  const latencies: number[] = [];
  let failed = 0;
  const statusCodes: Record<string, number> = {};
  const totalRequests = config.concurrentUsers * config.searchRounds;

  const querySeeds = ["A", "N", "T", "US", "IN", "BTC", "EUR", "BANK", "TECH", "ENERGY"];

  await runWithPool(totalRequests, config.maxInFlight, async (index) => {
    const q = querySeeds[index % querySeeds.length];
    const url = `${config.apiBase}/simulation/assets?q=${encodeURIComponent(q)}&limit=50`;

    try {
      const result = await timedRequest(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      statusCodes[String(result.statusCode)] = (statusCodes[String(result.statusCode)] ?? 0) + 1;

      if (result.ok) {
        latencies.push(result.latencyMs);
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  });

  return summarize(latencies, failed, statusCodes);
}

async function runQueueSpike(config: StressConfig, token: string): Promise<LatencySummary> {
  const latencies: number[] = [];
  let failed = 0;
  const statusCodes: Record<string, number> = {};

  await runWithPool(config.queueSpikeJobs, Math.max(20, Math.floor(config.maxInFlight / 2)), async (index) => {
    const symbol = `SPIKE${index}`;
    const payload = {
      symbol,
      fullSymbol: `FX:${symbol}`,
      name: `Queue Spike ${index}`,
      exchange: "FX",
      type: "forex",
      country: "GLOBAL",
      fallbackType: "exchange",
    };

    try {
      const result = await timedRequest(`${config.apiBase}/symbols/missing-logo`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      statusCodes[String(result.statusCode)] = (statusCodes[String(result.statusCode)] ?? 0) + 1;

      if (result.ok) {
        latencies.push(result.latencyMs);
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  });

  return summarize(latencies, failed, statusCodes);
}

async function fetchMetrics(apiBase: string, token: string): Promise<unknown> {
  const response = await fetch(`${apiBase}/metrics`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return { error: `METRICS_FAILED_${response.status}` };
  }

  return response.json();
}

async function main(): Promise<void> {
  const config: StressConfig = {
    apiBase: process.env.API_BASE_URL ?? "http://localhost:4000/api",
    concurrentUsers: Number(process.env.STRESS_CONCURRENT_USERS ?? "1000"),
    searchRounds: Number(process.env.STRESS_SEARCH_ROUNDS ?? "1"),
    queueSpikeJobs: Number(process.env.STRESS_QUEUE_SPIKE_JOBS ?? "500"),
    maxInFlight: Number(process.env.STRESS_MAX_IN_FLIGHT ?? "200"),
  };

  const token = await registerTempUser(config.apiBase);
  const [search, queue] = await Promise.all([
    runConcurrentSearchLoad(config, token),
    runQueueSpike(config, token),
  ]);
  const metrics = await fetchMetrics(config.apiBase, token);

  console.log(JSON.stringify({
    config,
    search,
    queue,
    metrics,
  }, null, 2));
}

main().catch((error) => {
  console.error("stress_test_failed", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
