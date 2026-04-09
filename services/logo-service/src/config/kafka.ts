import { Kafka, logLevel, type Producer } from "kafkajs";
import { env } from "./env";

const kafka = new Kafka({
  clientId: "logo-service",
  brokers: env.KAFKA_BROKERS.split(",").map((value) => value.trim()).filter(Boolean),
  logLevel: logLevel.NOTHING,
});

let producer: Producer | null = null;

export async function connectKafkaProducer(): Promise<void> {
  if (!env.KAFKA_ENABLED || producer) return;

  producer = kafka.producer();
  await producer.connect();
  console.log(JSON.stringify({ message: "logo_service_kafka_connected" }));
}

export async function emitLogoEnriched(payload: {
  fullSymbol: string;
  symbol: string;
  logoUrl: string;
  source: "cdn" | "remote";
  domain?: string;
}): Promise<void> {
  if (!env.KAFKA_ENABLED || !producer) return;

  await producer.send({
    topic: "symbol.logo.enriched",
    messages: [
      {
        key: payload.fullSymbol,
        value: JSON.stringify(payload),
      },
    ],
  });
}

export async function shutdownKafka(): Promise<void> {
  if (!producer) return;
  await producer.disconnect();
  producer = null;
}
