import { kafka, isKafkaEnabled, isKafkaReady } from "../config/kafka";
import { ALL_TOPICS } from "./topics";
import { logger } from "../utils/logger";

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
          numPartitions: 1,
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
