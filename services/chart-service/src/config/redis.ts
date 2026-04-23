import Redis from "ioredis";
import { env } from "./env";

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // Stop reconnection attempts immediately on failure; prevents unhandled
      // error events from crashing the process when Redis is unavailable.
      retryStrategy: () => null,
    });
    // Attach a no-op error handler so Node.js does not treat connection
    // failures as fatal unhandled error events.
    client.on("error", () => {});
  }
  return client;
}

export async function connectRedis(): Promise<void> {
  if (process.env.REDIS_ENABLED === "false") {
    return;
  }
  const redis = getRedisClient();
  if (redis.status === "ready") {
    return;
  }
  await redis.connect().catch(() => {});
}

export async function closeRedis(): Promise<void> {
  if (!client) {
    return;
  }
  await client.quit();
  client = null;
}
