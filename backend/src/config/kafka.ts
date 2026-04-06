import { Kafka, logLevel, SASLOptions } from "kafkajs";
import { env } from "./env";
import { logger } from "../utils/logger";

function buildKafka(): Kafka {
  const brokers = env.KAFKA_BROKERS.split(",").map((b) => b.trim()).filter(Boolean);

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

export function isKafkaEnabled(): boolean {
  return env.KAFKA_ENABLED;
}

export function isKafkaReady(): boolean {
  return kafkaReady;
}

export function setKafkaReady(ready: boolean): void {
  kafkaReady = ready;
  logger.info("kafka_ready_state", { ready });
}
