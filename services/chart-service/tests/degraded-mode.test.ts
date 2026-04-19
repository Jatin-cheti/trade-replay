import assert from "node:assert/strict";
import { kafkaConfig } from "../src/config/kafka";
import {
  preflightStreamingOrDisableForDev,
  resetStreamingStateForTests,
} from "../src/services/streaming";
import {
  maybeLogRedisErrorSummary,
  resetRedisLogStateForTests,
} from "../src/config/redis";
import { env } from "../src/config/env";

async function testStreamingPreflightSummaryOnce(): Promise<void> {
  const original = {
    kafkaEnabled: kafkaConfig.enabled,
    streamingEnabled: kafkaConfig.streamingEnabled,
    autoDisable: kafkaConfig.autoDisableWhenUnavailable,
    appEnv: env.APP_ENV,
  };

  kafkaConfig.enabled = true;
  kafkaConfig.streamingEnabled = true;
  kafkaConfig.autoDisableWhenUnavailable = true;
  env.APP_ENV = "local";
  resetStreamingStateForTests();

  let summaryLogs = 0;

  await preflightStreamingOrDisableForDev({
    probe: async () => ({ reachable: false, broker: "localhost:19092", reason: "tcp_connect_failed" }),
    logWarn: () => {
      summaryLogs += 1;
    },
  });

  await preflightStreamingOrDisableForDev({
    probe: async () => ({ reachable: false, broker: "localhost:19092", reason: "tcp_connect_failed" }),
    logWarn: () => {
      summaryLogs += 1;
    },
  });

  assert.equal(summaryLogs, 1);

  kafkaConfig.enabled = original.kafkaEnabled;
  kafkaConfig.streamingEnabled = original.streamingEnabled;
  kafkaConfig.autoDisableWhenUnavailable = original.autoDisable;
  env.APP_ENV = original.appEnv;
}

function testRedisThrottleSummary(): void {
  resetRedisLogStateForTests();
  let logs = 0;
  const fakeLog = () => {
    logs += 1;
  };

  maybeLogRedisErrorSummary("connect ECONNREFUSED 127.0.0.1:6379", 16_000, fakeLog);
  maybeLogRedisErrorSummary("connect ECONNREFUSED 127.0.0.1:6379", 17_000, fakeLog);
  maybeLogRedisErrorSummary("connect ECONNREFUSED 127.0.0.1:6379", 18_000, fakeLog);
  maybeLogRedisErrorSummary("connect ECONNREFUSED 127.0.0.1:6379", 32_500, fakeLog);

  assert.equal(logs, 2);
}

async function run(): Promise<void> {
  await testStreamingPreflightSummaryOnce();
  testRedisThrottleSummary();
  console.log("degraded-mode.test.ts passed");
}

void run();
