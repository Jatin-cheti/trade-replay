import { Kafka } from "kafkajs";
import { env } from "./env";

let kafka: Kafka | null = null;

export function getKafka(): Kafka {
  if (!kafka) {
    kafka = new Kafka({
      clientId: "chart-service",
      brokers: env.kafkaBrokers,
    });
  }
  return kafka;
}
