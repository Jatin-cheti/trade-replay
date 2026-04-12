import { kafka, isKafkaEnabled, isKafkaReady } from "../config/kafka";
import { ALL_TOPICS } from "./topics";
import { logger } from "../utils/logger";
import { env } from "../config/env";

function partitionsForTopic(topic: string): number {
  // Scaling pipeline topics get higher partition counts for throughput
  const scalingTopics = new Set(["symbol.ingest", "logo.resolve", "logo.retry", "logo.completed"]);
  if (scalingTopics.has(topic)) {
    return Math.max(12, env.KAFKA_SYMBOL_EVENT_PARTITIONS * 4);
  }

  if (topic === "symbol.logo.enriched") {
    return Math.max(1, env.KAFKA_SYMBOL_EVENT_PARTITIONS);
  }

  if (topic === "portfolio.update") {
    return Math.max(1, env.KAFKA_PORTFOLIO_EVENT_PARTITIONS);
  }

  return Math.max(1, env.KAFKA_DEFAULT_PARTITIONS);
}

export async function ensureTopics(): Promise<void> {
  if (!isKafkaEnabled()) return;

  const admin = kafka.admin();
  try {
    await admin.connect();
    const existing = await admin.listTopics();
    const missing = ALL_TOPICS.filter((t) => !existing.includes(t));

    if (missing.length > 0) {
      await admin.createTopics({
        topics: missing.map((topic) => ({
          topic,
          numPartitions: partitionsForTopic(topic),
          replicationFactor: 1,
        })),
      });
      logger.info("kafka_topics_created", { topics: missing });
    } else {
      logger.info("kafka_topics_exist", { count: ALL_TOPICS.length });
    }
  } finally {
    await admin.disconnect();
  }
}
