import IORedis from "ioredis";
import { env } from "./env";

export const redisClient = new IORedis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: () => null,
});

export async function connectRedis(): Promise<void> {
  if (redisClient.status === "ready") return;
  if (redisClient.status === "wait") {
    await redisClient.connect();
  }
}

export function isRedisReady(): boolean {
  return redisClient.status === "ready";
}
