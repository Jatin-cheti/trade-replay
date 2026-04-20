import assert from "node:assert/strict";
import { env } from "../src/config/env";
import {
  preflightKafkaOrDisableForDev,
  resetKafkaPreflightStateForTests,
} from "../src/kafka/index";

async function run(): Promise<void> {
  const original = {
    appEnv: env.APP_ENV,
    kafkaEnabled: env.KAFKA_ENABLED,
    disableWhenUnavailable: env.DEV_DISABLE_KAFKA_IF_UNAVAILABLE,
  };

  env.APP_ENV = "local";
  env.KAFKA_ENABLED = true;
  env.DEV_DISABLE_KAFKA_IF_UNAVAILABLE = true;
  resetKafkaPreflightStateForTests();

  let summaryLogs = 0;

  await preflightKafkaOrDisableForDev({
    probe: async () => ({ reachable: false, broker: "localhost:19092", reason: "tcp_connect_failed" }),
    logWarn: () => {
      summaryLogs += 1;
    },
  });

  await preflightKafkaOrDisableForDev({
    probe: async () => ({ reachable: false, broker: "localhost:19092", reason: "tcp_connect_failed" }),
    logWarn: () => {
      summaryLogs += 1;
    },
  });

  assert.equal(summaryLogs, 1);

  env.APP_ENV = original.appEnv;
  env.KAFKA_ENABLED = original.kafkaEnabled;
  env.DEV_DISABLE_KAFKA_IF_UNAVAILABLE = original.disableWhenUnavailable;

  console.log("backend degraded-mode.test.ts passed");
}

void run();
