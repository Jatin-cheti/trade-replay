import { Consumer, EachBatchPayload } from "kafkajs";
import { kafka, isKafkaEnabled } from "../config/kafka";
import { KafkaEvent, KafkaTopic } from "./topics";
import { logger } from "../utils/logger";
import { acquireIdempotencyLock, toIdempotencyKey } from "../services/idempotency.service";

export type MessageHandler<T = unknown> = (event: KafkaEvent<T>) => Promise<void>;

interface ConsumerConfig {
  groupId: string;
  topics: KafkaTopic[];
  handler: MessageHandler;
  batchSize?: number;
  maxBatchSize?: number;
  maxProcessingTimeMs?: number;
}

const consumers: Consumer[] = [];

/**
 * Idempotency: consumers track processed eventIds in a Set (bounded).
 * In production, use Redis SET with TTL for distributed idempotency.
 */
const processedEvents = new Set<string>();
const MAX_PROCESSED_CACHE = 50_000;

function markProcessed(eventId: string): boolean {
  if (processedEvents.has(eventId)) return true; // duplicate
  if (processedEvents.size >= MAX_PROCESSED_CACHE) {
    // Evict oldest entries (simple strategy)
    const iterator = processedEvents.values();
    for (let i = 0; i < MAX_PROCESSED_CACHE / 4; i++) {
      const next = iterator.next();
      if (next.done) break;
      processedEvents.delete(next.value);
    }
  }
  processedEvents.add(eventId);
  return false;
}

export async function createConsumer(config: ConsumerConfig): Promise<Consumer | null> {
  if (!isKafkaEnabled()) return null;

  const consumer = kafka.consumer({
    groupId: config.groupId,
    sessionTimeout: 30_000,
    heartbeatInterval: 3_000,
    maxBytesPerPartition: 1_048_576, // 1MB
    retry: { retries: 3 },
  });

  await consumer.connect();
  logger.info("kafka_consumer_connected", { groupId: config.groupId });

  for (const topic of config.topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachBatchAutoResolve: true,
    eachBatch: async (batchPayload: EachBatchPayload) => {
      const { batch, resolveOffset, heartbeat } = batchPayload;
      const batchStartedAt = Date.now();
      let processedInBatch = 0;

      for (const message of batch.messages) {
        if (config.maxBatchSize && processedInBatch >= config.maxBatchSize) {
          logger.warn("kafka_batch_size_guard", {
            groupId: config.groupId,
            topic: batch.topic,
            maxBatchSize: config.maxBatchSize,
          });
          break;
        }

        if (config.maxProcessingTimeMs && (Date.now() - batchStartedAt) >= config.maxProcessingTimeMs) {
          logger.warn("kafka_batch_time_guard", {
            groupId: config.groupId,
            topic: batch.topic,
            maxProcessingTimeMs: config.maxProcessingTimeMs,
          });
          break;
        }

        if (!message.value) continue;

        try {
          const event: KafkaEvent = JSON.parse(message.value.toString());

          // Idempotency check
          const localDuplicate = markProcessed(event.eventId);
          const distributedDuplicate = !(await acquireIdempotencyLock(
            "kafka-event",
            toIdempotencyKey([event.eventId, batch.topic]),
          ));

          if (localDuplicate || distributedDuplicate) {
            logger.warn("kafka_duplicate_event", { eventId: event.eventId, topic: batch.topic });
            resolveOffset(message.offset);
            continue;
          }

          await config.handler(event);
          resolveOffset(message.offset);
          await heartbeat();
          processedInBatch += 1;
        } catch (error) {
          logger.error("kafka_consume_error", {
            topic: batch.topic,
            offset: message.offset,
            error: error instanceof Error ? error.message : String(error),
          });
          // Resolve offset to avoid infinite retry on poison messages
          resolveOffset(message.offset);
        }
      }
    },
  });

  consumers.push(consumer);
  return consumer;
}

export async function disconnectAllConsumers(): Promise<void> {
  for (const consumer of consumers) {
    try {
      await consumer.disconnect();
    } catch (error) {
      logger.error("kafka_consumer_disconnect_error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  consumers.length = 0;
  logger.info("kafka_all_consumers_disconnected");
}
