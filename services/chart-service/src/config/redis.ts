import Redis from "ioredis";
import { env } from "./env";

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }
  return client;
}

export async function connectRedis(): Promise<void> {
  const redis = getRedisClient();
  if (redis.status === "ready") {
    return;
  }
  await redis.connect();
}

export async function closeRedis(): Promise<void> {
  if (!client) {
    return;
  }
  await client.quit();
  client = null;
}
