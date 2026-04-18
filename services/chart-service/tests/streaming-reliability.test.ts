import assert from "node:assert/strict";
import {
  getStreamingHealth,
  handleKafkaMessageValue,
  resetStreamingStateForTests,
} from "../src/services/streaming";

async function run(): Promise<void> {
  resetStreamingStateForTests();

  await handleKafkaMessageValue(JSON.stringify({
    eventId: "evt-ok",
    topic: "chart.candle.updated",
    timestamp: Date.now(),
    source: "test",
    payload: {
      symbol: "AAPL",
      timeframe: "1m",
      time: new Date().toISOString(),
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 1,
    },
  }), {
    maxRetries: 0,
    sleep: async () => {},
  });

  const successHealth = getStreamingHealth();
  assert.equal(successHealth.processedCount >= 1, true);

  let dlqCalled = 0;
  await assert.rejects(
    handleKafkaMessageValue("not-json", {
      maxRetries: 2,
      retryBaseMs: 1,
      sleep: async () => {},
      publishDlq: async () => {
        dlqCalled += 1;
      },
    }),
  );

  const failureHealth = getStreamingHealth();
  assert.equal(failureHealth.failedCount >= 1, true);
  assert.equal(failureHealth.dlqCount >= 1, true);
  assert.equal(dlqCalled >= 1, true);

  console.log("streaming-reliability.test.ts passed");
}

void run();
