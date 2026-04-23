import IORedis, { type RedisOptions } from "ioredis";
import { env } from "./env";

const REDIS_CONNECT_RETRIES = 10;
const REDIS_RETRY_DELAY_MS = 500;

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
    enableOfflineQueue: false,
    retryStrategy: () => null,
  };
}

export const redisConnectionOptions = parseRedisUrl(env.REDIS_URL);

export const redisClient = new IORedis(env.REDIS_URL, {
  ...redisConnectionOptions,
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy: () => null,
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRedisClient(client: IORedis): Promise<boolean> {
  let retries = REDIS_CONNECT_RETRIES;

  while (retries-- > 0) {
    try {
      if (client.status === "wait") {
        await client.connect();
      }

      await client.ping();
      return true;
    } catch {
      if (retries <= 0) {
        return false;
      }
      await delay(REDIS_RETRY_DELAY_MS);
    }
  }

  return false;
}

export async function connectRedis(): Promise<void> {
  console.log(`PORTFOLIO REDIS CONNECTING TO: ${env.REDIS_URL}`);
  const ready = await waitForRedisClient(redisClient);
  if (!ready) {
    throw new Error(`Redis unavailable after ${REDIS_CONNECT_RETRIES} retries`);
  }
  console.log(JSON.stringify({ message: "portfolio_service_redis_connected" }));
}

export async function disconnectRedis(): Promise<void> {
  await redisClient.quit();
}
