import assert from "node:assert/strict";
import { getCached, setCached } from "../src/services/cache";
import { buildIndicatorsCacheKey } from "../src/services/cacheKeys";
import { handleKafkaMessageValue } from "../src/services/streaming";

async function run(): Promise<void> {
  const key = buildIndicatorsCacheKey({
    source: {
      symbol: "AAPL",
      timeframe: "1m",
      from: "2025-01-01T00:00:00.000Z",
      to: "2025-01-01T00:10:00.000Z",
    },
    indicators: [{ id: "sma", params: { period: 20 } }],
  });

  await setCached(key, { ok: true }, { freshTtlSeconds: 120, staleTtlSeconds: 30 });
  const before = await getCached<{ ok: boolean }>(key);
  assert.equal(before?.ok, true);

  await handleKafkaMessageValue(JSON.stringify({
    eventId: "evt-1",
    topic: "chart.candle.updated",
    timestamp: Date.now(),
    source: "test",
    payload: {
      symbol: "AAPL",
      timeframe: "1m",
      time: "2025-01-01T00:11:00.000Z",
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 1,
    },
  }));

  const after = await getCached<{ ok: boolean }>(key);
  assert.equal(after, null);

  await handleKafkaMessageValue(JSON.stringify({ payload: { symbol: "", timeframe: "1m" } }));
  await handleKafkaMessageValue(JSON.stringify({ payload: { symbol: "AAPL", timeframe: "" } }));

  assert.equal(true, true);
  console.log("streaming.test.ts passed");
}

void run();
