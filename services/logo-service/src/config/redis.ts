import IORedis, { type RedisOptions } from "ioredis";
import { env } from "./env";

function parseRedisUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  const db = parsed.pathname ? Number(parsed.pathname.replace("/", "")) : 0;
  const isTls = parsed.protocol === "rediss:";

  return {
    host: parsed.hostname,
    port: Number(parsed.port || "6379"),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isFinite(db) ? db : 0,
    tls: isTls ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export const redisConnectionOptions = parseRedisUrl(env.REDIS_URL);
export const redisClient = new IORedis(env.REDIS_URL, {
  ...redisConnectionOptions,
  lazyConnect: true,
});

export function isRedisReady(): boolean {
  return redisClient.status === "ready";
}

export async function connectRedis(): Promise<void> {
  if (isRedisReady()) return;

  if (redisClient.status === "wait") {
    await redisClient.connect();
  }

  console.log(JSON.stringify({ message: "logo_service_redis_connected" }));
}
