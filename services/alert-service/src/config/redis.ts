import { Redis } from "ioredis";
import { env } from "./env.js";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: true,
      retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 500, 3000)),
    });
    client.on("error", () => {});
  }
  return client;
}

export async function connectRedis(): Promise<void> {
  const redis = getRedis();
  if (redis.status === "wait") await redis.connect();
  console.log("[alert-service] Redis connected");
}
