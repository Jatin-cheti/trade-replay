import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { bootstrapKafkaProducerOnly, shutdownKafka } from "./kafka";
import { logLogoQueueStats } from "./services/logoQueue.service";
import { logger } from "./utils/logger";

async function bootstrapWorker() {
  logger.info("worker_bootstrap_start");
  await connectDB();
  await connectRedis();
  await bootstrapKafkaProducerOnly();
  setInterval(() => logLogoQueueStats(), 30000).unref();
  logger.info("worker_started");

  const stop = async () => {
    logger.info("worker_shutdown_start");
    await shutdownKafka();
    logger.info("worker_shutdown_complete");
    process.exit(0);
  };

  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}

bootstrapWorker().catch((error) => {
  console.error("Worker error:", error);
  logger.error("worker_bootstrap_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
