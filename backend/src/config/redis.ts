import { createClient } from "redis";
import { env } from "./env";
import { logger } from "../utils/logger";

export const redisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: false,
  },
});

redisClient.on("error", (error) => {
  logger.error("redis_error", { message: error.message });
});

export async function connectRedis(): Promise<void> {
  if (redisClient.isOpen) return;
  try {
    await redisClient.connect();
    logger.info("redis_connected", { url: env.REDIS_URL });
  } catch (_error) {
    logger.warn("redis_unavailable");
  }
}
