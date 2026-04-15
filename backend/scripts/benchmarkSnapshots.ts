import axios from "axios";

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * ratio));
  return Number(sorted[index].toFixed(2));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

async function main() {
  const assetServiceUrl = process.env.ASSET_SERVICE_URL || "http://127.0.0.1:4011";
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:4000";
  const internalToken = process.env.ASSET_SERVICE_INTERNAL_TOKEN || process.env.CURSOR_SIGNING_SECRET || "";
  const benchmarkJwt = process.env.BENCHMARK_JWT || "";
  const iterations = Number(process.env.BENCHMARK_ITERATIONS || "30");
  const symbols = (process.env.BENCHMARK_SYMBOLS || "SPY,AAPL,MSFT,NVDA,TSLA,QQQ,AMZN,META,NFLX,GOOGL,BTCUSDT,ETHUSDT")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (!internalToken) {
    throw new Error("ASSET_SERVICE_INTERNAL_TOKEN or CURSOR_SIGNING_SECRET is required");
  }

  const assetHttp = axios.create({
    baseURL: assetServiceUrl,
    timeout: 4000,
    headers: {
      "x-internal-service-token": internalToken,
    },
  });

  const snapshotDurations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    await assetHttp.post("/asset-service/internal/snapshot", {
      symbols,
      candleSymbols: [symbols[0]],
      candleLimit: 240,
    });
    snapshotDurations.push(performance.now() - startedAt);
  }

  console.log("SNAPSHOT BENCHMARK");
  console.log(JSON.stringify({
    iterations,
    avgMs: average(snapshotDurations),
    p50Ms: percentile(snapshotDurations, 0.5),
    p95Ms: percentile(snapshotDurations, 0.95),
    targetUnder20Ms: percentile(snapshotDurations, 0.95) < 20,
  }, null, 2));

  try {
    const metrics = await axios.get(`${backendUrl}/api/metrics`, { timeout: 4000 });
    const snapshotBatchHitRate = metrics.data?.cacheHitRate?.asset_snapshot_batch?.hitRate ?? null;
    const quoteHitRate = metrics.data?.cacheHitRate?.asset_snapshot_quote?.hitRate ?? null;
    const candleHitRate = metrics.data?.cacheHitRate?.asset_snapshot_candles?.hitRate ?? null;
    console.log("CACHE METRICS");
    console.log(JSON.stringify({ snapshotBatchHitRate, quoteHitRate, candleHitRate }, null, 2));
  } catch (error) {
    console.log("CACHE METRICS");
    console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2));
  }

  if (!benchmarkJwt) {
    console.log("SEARCH BENCHMARK");
    console.log(JSON.stringify({ skipped: true, reason: "BENCHMARK_JWT not provided" }, null, 2));
    return;
  }

  const searchDurations: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    await axios.get(`${backendUrl}/api/search`, {
      timeout: 4000,
      headers: {
        Authorization: `Bearer ${benchmarkJwt}`,
      },
      params: {
        q: "aap",
        limit: 25,
      },
    });
    searchDurations.push(performance.now() - startedAt);
  }

  console.log("SEARCH BENCHMARK");
  console.log(JSON.stringify({
    iterations,
    avgMs: average(searchDurations),
    p50Ms: percentile(searchDurations, 0.5),
    p95Ms: percentile(searchDurations, 0.95),
    targetUnder50Ms: percentile(searchDurations, 0.95) < 50,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});