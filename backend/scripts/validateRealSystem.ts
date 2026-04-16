import IORedis from "ioredis";
import { Queue } from "bullmq";

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
  data?: unknown;
};

type MetricsPayload = {
  queueDepth?: {
    logoEnrichment?: {
      waiting?: number;
      active?: number;
      delayed?: number;
      total?: number;
    };
  };
  queueProcessing?: {
    logoEnrichment?: {
      completed?: number;
      failed?: number;
      processingRatePerMin?: number;
      successRate?: number;
      failureRate?: number;
    };
  };
  cache?: {
    hits?: number;
    misses?: number;
    hitRate?: number;
  };
};

type SnapshotPayload = {
  quotes?: Record<string, { price?: number; source?: string }>;
};

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api";
const REDIS_URL = process.env.REDIS_URL ?? "rediss://default:gQAAAAAAAYUaAAIncDJhYWY3MjY0Mzk3NjY0OTBhOWQ4M2UyMDZjY2Q1MmE2NHAyOTk2MTA@related-mole-99610.upstash.io:6379";
const QUEUE_NAME = "logo-enrichment";
const QUEUE_JOB = "symbol-logo-enrichment";
const QUEUE_BATCH = Number(process.env.REAL_QUEUE_BATCH_SIZE ?? "100");
const QUEUE_DRAIN_TIMEOUT_MS = Number(process.env.REAL_QUEUE_DRAIN_TIMEOUT_MS ?? "120000");
const SEARCH_CONCURRENCY = Number(process.env.REAL_SEARCH_CONCURRENCY ?? "1000");
const SEARCH_BATCH = Number(process.env.REAL_SEARCH_BATCH ?? "200");
const SEARCH_QUERY = process.env.REAL_SEARCH_QUERY ?? "AAPL";

function nowMs(): number {
  return Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRedisUrl(url: string): { host: string; port: number; username?: string; password?: string; db: number } {
  const parsed = new URL(url);
  const db = parsed.pathname ? Number(parsed.pathname.replace("/", "")) : 0;
  return {
    host: parsed.hostname,
    port: Number(parsed.port || "6379"),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isFinite(db) ? db : 0,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const response = await fetch(url, init);
  const data = await response.json() as T;
  return { status: response.status, data };
}

async function registerTempUser(): Promise<string> {
  const email = `real-validate-${Date.now()}@example.com`;
  const { status, data } = await fetchJson<{ token?: string }>(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "Real#12345",
      name: "Real Validator",
    }),
  });

  if (status !== 200 || !data.token) {
    throw new Error(`REGISTER_FAILED status=${status}`);
  }

  return data.token;
}

async function validateHealth(results: CheckResult[]): Promise<void> {
  try {
    const started = nowMs();
    const response = await fetch(`${API_BASE_URL}/health`);
    const elapsed = nowMs() - started;
    results.push({
      name: "api_health",
      ok: response.ok,
      detail: response.ok ? `healthy in ${elapsed}ms` : `status=${response.status}`,
    });
  } catch (error) {
    results.push({
      name: "api_health",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function validateQueue(results: CheckResult[]): Promise<void> {
  const redis = new IORedis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  let queue: Queue | null = null;

  try {
    await redis.connect();
    await redis.ping();

    queue = new Queue(QUEUE_NAME, {
      connection: parseRedisUrl(REDIS_URL),
    });

    const before = await queue.getJobCounts("waiting", "active", "delayed", "completed", "failed");
    const startedAt = nowMs();

    const jobs = Array.from({ length: QUEUE_BATCH }).map((_, index) => {
      const symbol = `REALVAL${index}`;
      return {
        name: QUEUE_JOB,
        data: {
          symbol,
          fullSymbol: `NSE:${symbol}`,
          name: `Real Validate ${index}`,
          exchange: "NSE",
          type: "stock",
          createdAt: Date.now(),
        },
        opts: {
          removeOnComplete: 1000,
          removeOnFail: 1000,
          jobId: `real-validate-${startedAt}-${index}`,
        },
      };
    });

    await queue.addBulk(jobs);

    let drained = false;
    let latest = before;
    const deadline = startedAt + QUEUE_DRAIN_TIMEOUT_MS;

    while (nowMs() < deadline) {
      latest = await queue.getJobCounts("waiting", "active", "delayed", "completed", "failed");
      const waiting = latest.waiting ?? 0;
      const active = latest.active ?? 0;
      const delayed = latest.delayed ?? 0;
      if (waiting + active + delayed === 0) {
        drained = true;
        break;
      }
      await sleep(2000);
    }

    const waiting = latest.waiting ?? 0;
    const failed = latest.failed ?? 0;

    results.push({
      name: "queue_logo_batch",
      ok: drained && waiting === 0 && failed === 0,
      detail: `drained=${drained} waiting=${waiting} failed=${failed}`,
      data: { before, after: latest },
    });
  } catch (error) {
    results.push({
      name: "queue_logo_batch",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (queue) {
      await queue.close().catch(() => {});
    }
    redis.disconnect(false);
  }
}

async function validateSnapshotAndRedis(results: CheckResult[]): Promise<void> {
  const redis = new IORedis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });

  try {
    const payload = {
      symbols: ["AAPL", "BTC", "RELIANCE"],
      candleSymbols: ["AAPL"],
      candleLimit: 50,
    };

    const started = nowMs();
    const { status, data } = await fetchJson<SnapshotPayload | { success: false; message?: string }>(`${API_BASE_URL}/live/snapshot/public`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const elapsed = nowMs() - started;

    const ok = status === 200 && Boolean((data as SnapshotPayload).quotes?.AAPL?.price);
    results.push({
      name: "snapshot_public_post",
      ok,
      detail: `status=${status} latencyMs=${elapsed}`,
      data,
    });

    await redis.connect();
    const raw = await redis.get("symbol:AAPL");
    let validPrice = false;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { price?: number };
        validPrice = typeof parsed.price === "number" && Number.isFinite(parsed.price);
      } catch {
        validPrice = false;
      }
    }

    results.push({
      name: "redis_symbol_aapl",
      ok: Boolean(raw) && validPrice,
      detail: raw ? "key exists with numeric price" : "key missing",
    });
  } catch (error) {
    results.push({
      name: "snapshot_and_redis",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    redis.disconnect(false);
  }
}

async function validateSearchCases(results: CheckResult[]): Promise<void> {
  const cases = ["BTC", "AAPL", "RELIANCE", "HDFC", "GOLD"];

  for (const query of cases) {
    try {
      const started = nowMs();
      const { status, data } = await fetchJson<Array<{ symbol?: string; type?: string; logo_urls?: string[] }>>(
        `${API_BASE_URL}/datafeed/search?query=${encodeURIComponent(query)}&limit=30`,
      );
      const elapsed = nowMs() - started;
      const first = data[0];

      results.push({
        name: `search_${query}`,
        ok: status === 200 && Array.isArray(data) && data.length > 0,
        detail: `status=${status} count=${Array.isArray(data) ? data.length : 0} latencyMs=${elapsed}`,
        data: {
          firstSymbol: first?.symbol,
          firstType: first?.type,
          firstHasLogo: Boolean(first?.logo_urls && first.logo_urls.length > 0),
        },
      });
    } catch (error) {
      results.push({
        name: `search_${query}`,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function validateLoadAndMetrics(results: CheckResult[], token: string): Promise<void> {
  const latencies: number[] = [];
  let failed = 0;

  for (let i = 0; i < SEARCH_CONCURRENCY; i += SEARCH_BATCH) {
    const chunk = Math.min(SEARCH_BATCH, SEARCH_CONCURRENCY - i);
    const requests = Array.from({ length: chunk }).map(async () => {
      const started = nowMs();
      const response = await fetch(
        `${API_BASE_URL}/simulation/assets?q=${encodeURIComponent(SEARCH_QUERY)}&limit=50`,
        {
          method: "GET",
          headers: { authorization: `Bearer ${token}` },
        },
      );
      const elapsed = nowMs() - started;
      if (response.ok) {
        latencies.push(elapsed);
      } else {
        failed += 1;
      }
    });

    await Promise.all(requests);
  }

  const success = latencies.length;
  const avg = success > 0 ? latencies.reduce((sum, ms) => sum + ms, 0) / success : 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const p95 = sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;

  results.push({
    name: "search_load_1000",
    ok: failed === 0,
    detail: `success=${success} failed=${failed} avgMs=${avg.toFixed(2)} p95Ms=${p95}`,
  });

  try {
    const { status, data } = await fetchJson<MetricsPayload>(`${API_BASE_URL}/metrics`);
    const queue = data.queueDepth?.logoEnrichment;
    const processing = data.queueProcessing?.logoEnrichment;
    const cacheHitRate = data.cache?.hitRate ?? 0;

    results.push({
      name: "metrics_queue_health",
      ok: status === 200 && (queue?.waiting ?? 0) === 0 && (processing?.failed ?? 0) === 0,
      detail: `status=${status} waiting=${queue?.waiting ?? -1} failed=${processing?.failed ?? -1}`,
      data,
    });

    results.push({
      name: "metrics_redis_hit_rate",
      ok: cacheHitRate >= 90,
      detail: `cacheHitRate=${cacheHitRate}`,
      data: data.cache,
    });
  } catch (error) {
    results.push({
      name: "metrics_checks",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function main(): Promise<void> {
  const results: CheckResult[] = [];

  await validateHealth(results);

  let token = "";
  try {
    token = await registerTempUser();
    results.push({ name: "auth_register", ok: true, detail: "temporary auth token acquired" });
  } catch (error) {
    results.push({
      name: "auth_register",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  await validateQueue(results);
  await validateSnapshotAndRedis(results);
  await validateSearchCases(results);

  if (token) {
    await validateLoadAndMetrics(results, token);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log(JSON.stringify({
    mode: "real-system-validation",
    apiBaseUrl: API_BASE_URL,
    redisUrl: REDIS_URL,
    totalChecks: results.length,
    passed,
    failed,
    checks: results,
  }, null, 2));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("real_system_validation_failed", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
