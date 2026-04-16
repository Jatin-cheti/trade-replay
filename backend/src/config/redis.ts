import IORedis, { type RedisOptions } from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

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
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  enableOfflineQueue: false,
  retryStrategy: (times: number) => {
    if (times > REDIS_CONNECT_RETRIES) return null;
    return Math.min(times * REDIS_RETRY_DELAY_MS, 5000);
  },
};

function createRedisClient(): IORedis {
  return new IORedis(env.REDIS_URL, { ...redisClientOptions });
}

export const redisClient = createRedisClient();
export const redisPublisher = redisClient.duplicate(redisClientOptions);
export const redisSubscriber = redisClient.duplicate(redisClientOptions);

function logRedisErrorOnce(channel: string): void {
  if (hasLoggedRedisError) return;
  hasLoggedRedisError = true;
  logger.error(channel, { message: "Redis connection issue" });
}

function resetRedisErrorFlag(): void {
  hasLoggedRedisError = false;
}

redisClient.on("ready", resetRedisErrorFlag);
redisPublisher.on("ready", resetRedisErrorFlag);
redisSubscriber.on("ready", resetRedisErrorFlag);

redisClient.on("error", (error) => {
  void error;
  logRedisErrorOnce("redis_error");
});

redisPublisher.on("error", (error) => {
  void error;
  logRedisErrorOnce("redis_publisher_error");
});

redisSubscriber.on("error", (error) => {
  void error;
  logRedisErrorOnce("redis_subscriber_error");
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

async function safeDisconnect(client: IORedis): Promise<void> {
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

export function isRedisPubSubReady(): boolean {
  return redisPublisher.status === "ready" && redisSubscriber.status === "ready";
}

export function isRedisMockMode(): boolean {
  return false;
}

export function getRedisClient(): IORedis {
  return redisClient;
}

export function getRedisPublisher(): IORedis {
  return redisPublisher;
}

export function getRedisSubscriber(): IORedis {
  return redisSubscriber;
}

export async function ensureRedisReady(): Promise<void> {
  if (isRedisReady() && isRedisPubSubReady()) return;

  console.log(`REDIS CONNECTING TO: ${env.REDIS_URL.replace(/(:\/\/[^:]+:)[^@]+@/, "$1***@")}`);

  const [mainReady, publisherReady, subscriberReady] = await Promise.all([
    waitForRedisClient(redisClient),
    waitForRedisClient(redisPublisher),
    waitForRedisClient(redisSubscriber),
  ]);

  if (mainReady && publisherReady && subscriberReady) {
    logger.info("redis_connected", { host: redisConnectionOptions.host });
    hasLoggedRedisUnavailable = false;
    return;
  }

  await Promise.all([
    safeDisconnect(redisClient),
    safeDisconnect(redisPublisher),
    safeDisconnect(redisSubscriber),
  ]);

  if (!hasLoggedRedisUnavailable) {
    hasLoggedRedisUnavailable = true;
    logger.error("redis_unavailable", { host: redisConnectionOptions.host });
  }

  throw new Error(`Redis unavailable after ${REDIS_CONNECT_RETRIES} retries`);
}

export async function connectRedis(): Promise<void> {
  await ensureRedisReady();
  await configureRedisMemoryPolicy();
}

async function configureRedisMemoryPolicy(): Promise<void> {
  if (!isRedisReady()) return;
  try {
    const maxmem = process.env.REDIS_MAXMEMORY || "256mb";
    const policy = process.env.REDIS_MAXMEMORY_POLICY || "allkeys-lru";
    await redisClient.config("SET", "maxmemory", maxmem);
    await redisClient.config("SET", "maxmemory-policy", policy);
    logger.info("redis_memory_configured", { maxmemory: maxmem, policy });
  } catch {
    // CONFIG SET may be disabled on managed Redis (Upstash) — non-fatal
    logger.warn("redis_memory_config_skipped", { reason: "config_set_not_allowed" });
  }
}