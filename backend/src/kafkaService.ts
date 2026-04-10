import { connectRedis } from "./config/redis";
import { env } from "./config/env";
import { CONFIG } from "./config/index";
import { bootstrapKafkaConsumersOnly, shutdownKafka } from "./kafka";
import { logger } from "./utils/logger";

async function bootstrapKafkaService() {
  logger.info("kafka_service_bootstrap_start");
  console.log("CONFIG CHECK", {
    env: process.env.APP_ENV,
    redis: CONFIG.redisUrl,
    kafka: CONFIG.kafkaBroker,
    mongo: process.env.MONGO_URI,
  });
  logger.info("redis_url_config", { url: env.REDIS_URL });
  await connectRedis();
  await bootstrapKafkaConsumersOnly();
  logger.info("kafka_service_started");

  const stop = async () => {
    logger.info("kafka_service_shutdown_start");
    await shutdownKafka();
    logger.info("kafka_service_shutdown_complete");
    process.exit(0);
  };

  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}

bootstrapKafkaService().catch((error) => {
  console.error("Worker error:", error);
  logger.error("kafka_service_bootstrap_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
