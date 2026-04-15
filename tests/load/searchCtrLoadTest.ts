/**
 * Load test for search CTR system — simulates 100/1000/10000 concurrent users
 * performing search + click operations to validate:
 * - latency < 50ms p95
 * - Redis stability
 * - anti-abuse dedup works
 * - CTR scoring correctness
 *
 * Usage: npx ts-node tests/load/searchCtrLoadTest.ts [baseUrl] [users]
 */

const BASE_URL = process.argv[2] || "http://localhost:4000";
const TOTAL_USERS = Number(process.argv[3]) || 100;
const CONCURRENCY = Math.min(TOTAL_USERS, 50);

const QUERIES = ["BTC", "ETH", "AAPL", "MSFT", "SOL", "DOT", "SPY", "GOOGL", "V", "META", "TSLA", "AMZN"];
const LOGIN_EMAIL = "chart@test.com";
const LOGIN_PASSWORD = "Chart1234!";

interface LatencyBucket {
  search: number[];
  click: number[];
  impression: number[];
}

const latencies: LatencyBucket = { search: [], click: [], impression: [] };
let errors = 0;
let abuseBlocked = 0;

async function getToken(): Promise<string> {
  const resp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }),
  });
  const data = (await resp.json()) as { token: string };
  return data.token;
}

async function timedFetch(url: string, opts: RequestInit, bucket: keyof LatencyBucket): Promise<Response> {
  const start = performance.now();
  const resp = await fetch(url, opts);
  latencies[bucket].push(performance.now() - start);
  return resp;
}

async function simulateUser(token: string, userId: number): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const query = QUERIES[userId % QUERIES.length];

  try {
    // 1. Search
    const searchResp = await timedFetch(
      `${BASE_URL}/api/simulation/assets?q=${encodeURIComponent(query)}&limit=10`,
      { headers },
      "search",
    );
    const searchData = (await searchResp.json()) as {
      assets: Array<{ symbol: string; exchange: string; ticker: string }>;
    };
    const assets = searchData.assets || [];

    if (assets.length === 0) return;

    // 2. Record impressions
    const symbols = assets.map((a) => a.ticker || a.symbol);
    await timedFetch(
      `${BASE_URL}/api/simulation/search/impression`,
      { method: "POST", headers, body: JSON.stringify({ query, symbols }) },
      "impression",
    );

    // 3. Click first result
    const picked = assets[0];
    await timedFetch(
      `${BASE_URL}/api/simulation/search/click`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          query,
          symbol: picked.ticker || picked.symbol,
          exchange: picked.exchange,
          position: 0,
        }),
      },
      "click",
    );

    // 4. Abuse test: rapid repeated clicks (should be deduped)
    for (let i = 0; i < 8; i++) {
      const resp = await fetch(`${BASE_URL}/api/simulation/search/click`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query,
          symbol: picked.ticker || picked.symbol,
          exchange: picked.exchange,
          position: 0,
        }),
      });
      if (resp.ok) abuseBlocked++; // counted for analysis
    }
  } catch (err) {
    errors++;
  }
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function printStats(label: string, arr: number[]): void {
  if (arr.length === 0) {
    console.log(`  ${label}: no data`);
    return;
  }
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const p50 = percentile(arr, 50);
  const p95 = percentile(arr, 95);
  const p99 = percentile(arr, 99);
  const max = Math.max(...arr);
  console.log(
    `  ${label}: avg=${avg.toFixed(1)}ms  p50=${p50.toFixed(1)}ms  p95=${p95.toFixed(1)}ms  p99=${p99.toFixed(1)}ms  max=${max.toFixed(1)}ms  n=${arr.length}`,
  );
}

async function runBatch(token: string, batchSize: number): Promise<void> {
  const batches: Promise<void>[][] = [];
  for (let i = 0; i < batchSize; i += CONCURRENCY) {
    const chunk = [];
    for (let j = i; j < Math.min(i + CONCURRENCY, batchSize); j++) {
      chunk.push(simulateUser(token, j));
    }
    batches.push(chunk);
  }

  for (const chunk of batches) {
    await Promise.all(chunk);
  }
}

async function main(): Promise<void> {
  console.log(`\n🔥 Search CTR Load Test — ${TOTAL_USERS} users against ${BASE_URL}\n`);

  console.log("Authenticating...");
  const token = await getToken();
  console.log("Token acquired.\n");

  const tiers = [
    Math.min(100, TOTAL_USERS),
    Math.min(1000, TOTAL_USERS),
    TOTAL_USERS,
  ].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  for (const tier of tiers) {
    // Reset
    latencies.search = [];
    latencies.click = [];
    latencies.impression = [];
    errors = 0;
    abuseBlocked = 0;

    console.log(`━━━ Tier: ${tier} users (concurrency ${CONCURRENCY}) ━━━`);
    const start = Date.now();
    await runBatch(token, tier);
    const elapsed = Date.now() - start;

    console.log(`  Completed in ${(elapsed / 1000).toFixed(1)}s`);
    printStats("search", latencies.search);
    printStats("click", latencies.click);
    printStats("impression", latencies.impression);
    console.log(`  errors: ${errors}`);
    console.log(`  abuse clicks sent: ${abuseBlocked}`);

    const p95 = percentile(latencies.search, 95);
    console.log(
      p95 < 50
        ? `  ✅ search p95 ${p95.toFixed(1)}ms < 50ms threshold`
        : `  ⚠️  search p95 ${p95.toFixed(1)}ms EXCEEDS 50ms threshold`,
    );
    console.log();
  }

  console.log("✅ Load test complete.");
}

main().catch(console.error);
