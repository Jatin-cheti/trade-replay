import { Kafka, logLevel, SASLOptions } from "kafkajs";
import { env } from "./env";
import { logger } from "../utils/logger";

function buildKafka(): Kafka {
  const brokers = env.KAFKA_BROKERS.split(",").map((b: string) => b.trim()).filter(Boolean);

  const useSasl = Boolean(env.KAFKA_SASL_USERNAME && env.KAFKA_SASL_PASSWORD);

  const sasl: SASLOptions | undefined = useSasl
    ? {
        mechanism: (env.KAFKA_SASL_MECHANISM as "plain" | "scram-sha-256" | "scram-sha-512") || "plain",
        username: env.KAFKA_SASL_USERNAME,
        password: env.KAFKA_SASL_PASSWORD,
      }
    : undefined;

  return new Kafka({
    clientId: "tradereplay",
    brokers,
    ssl: useSasl,
    sasl,
    logLevel: logLevel.WARN,
    retry: { initialRetryTime: 300, retries: 8 },
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
  });
}

export const kafka = buildKafka();

let kafkaReady = false;
let kafkaRuntimeDisabled = false;
let kafkaRuntimeDisableReason: string | null = null;

export function isKafkaEnabled(): boolean {
  return env.KAFKA_ENABLED && !kafkaRuntimeDisabled;
}

export function isKafkaReady(): boolean {
  return kafkaReady;
}

export function setKafkaReady(ready: boolean): void {
  kafkaReady = ready;
  logger.info("kafka_ready_state", { ready });
}

export function disableKafkaRuntime(reason: string): void {
  kafkaRuntimeDisabled = true;
  kafkaRuntimeDisableReason = reason;
  kafkaReady = false;
  logger.warn("kafka_runtime_disabled", { reason });
}

export function getKafkaHealthStatus(): {
  enabledByConfig: boolean;
  runtimeEnabled: boolean;
  ready: boolean;
  degraded: boolean;
  reason: string | null;
  optional: boolean;
  brokers: string[];
} {
  return {
    enabledByConfig: env.KAFKA_ENABLED,
    runtimeEnabled: env.KAFKA_ENABLED && !kafkaRuntimeDisabled,
    ready: kafkaReady,
    degraded: kafkaRuntimeDisabled,
    reason: kafkaRuntimeDisableReason,
    optional: env.APP_ENV !== "production",
    brokers: env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean),
  };
}
