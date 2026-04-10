import IORedis, { type RedisOptions } from "ioredis";
import { env } from "./env";

const REDIS_CONNECT_RETRIES = 10;
const REDIS_RETRY_DELAY_MS = 500;
let hasLoggedRedisError = false;
let hasLoggedRedisUnavailable = false;

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
const redisClientOptions: RedisOptions = {
  ...redisConnectionOptions,
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy: () => null,
};

export const redisClient = new IORedis(env.REDIS_URL, {
  ...redisClientOptions,
});

redisClient.on("error", (error) => {
  void error;
  if (hasLoggedRedisError) return;
  hasLoggedRedisError = true;
  console.error("Redis connection issue.");
});

redisClient.on("ready", () => {
  hasLoggedRedisError = false;
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

function safeDisconnect(client: IORedis): void {
  try {
    if (client.status !== "end") {
      client.disconnect(false);
    }
  } catch {
    // Best-effort cleanup.
  }
}

export function isRedisReady(): boolean {
  return redisClient.status === "ready";
}

export function getRedisClient(): IORedis {
  return redisClient;
}

export async function ensureRedisReady(): Promise<void> {
  if (isRedisReady()) return;

  console.log(`REDIS CONNECTING TO: ${env.REDIS_URL}`);

  const ready = await waitForRedisClient(redisClient);
  if (ready) {
    hasLoggedRedisUnavailable = false;
    console.log(JSON.stringify({ message: "logo_service_redis_connected" }));
    return;
  }

  safeDisconnect(redisClient);

  if (!hasLoggedRedisUnavailable) {
    hasLoggedRedisUnavailable = true;
    console.error(JSON.stringify({ message: "logo_service_redis_unavailable", url: env.REDIS_URL }));
  }

  throw new Error(`Redis unavailable after ${REDIS_CONNECT_RETRIES} retries`);
}

export async function connectRedis(): Promise<void> {
  await ensureRedisReady();
}
