import IORedis, { type RedisOptions } from "ioredis";
import RedisMock from "ioredis-mock";
import { env } from "./env";
import { logger } from "../utils/logger";

const REDIS_CONNECT_RETRIES = 10;
const REDIS_RETRY_DELAY_MS = 500;

let hasLoggedRedisError = false;
let hasLoggedRedisUnavailable = false;
const useMockRedis = (env.NODE_ENV === "test" || env.E2E) && env.E2E_USE_MOCK_REDIS;

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

export const redisConnectionOptions = parseRedisUrl(useMockRedis ? "redis://127.0.0.1:6379" : env.REDIS_URL);
const redisClientOptions: RedisOptions = {
  ...redisConnectionOptions,
  lazyConnect: true,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy: () => null,
};

function createRedisClient(): IORedis {
  if (useMockRedis) {
    return new (RedisMock as unknown as { new(url: string): IORedis })("redis://127.0.0.1:6379");
  }

  return new IORedis(env.REDIS_URL, {
    ...redisClientOptions,
  });
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
  if (useMockRedis) return true;
  return redisClient.status === "ready";
}

export function isRedisPubSubReady(): boolean {
  if (useMockRedis) return true;
  return redisPublisher.status === "ready" && redisSubscriber.status === "ready";
}

export function isRedisMockMode(): boolean {
  return useMockRedis;
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
  if (useMockRedis) {
    logger.warn("redis_mock_enabled", {
      reason: "test_or_e2e_mode",
    });
    return;
  }

  if (isRedisReady() && isRedisPubSubReady()) return;

  console.log(`REDIS CONNECTING TO: ${env.REDIS_URL}`);

  const [mainReady, publisherReady, subscriberReady] = await Promise.all([
    waitForRedisClient(redisClient),
    waitForRedisClient(redisPublisher),
    waitForRedisClient(redisSubscriber),
  ]);

  if (mainReady && publisherReady && subscriberReady) {
    logger.info("redis_connected", { url: env.REDIS_URL });
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
    logger.error("redis_unavailable", { url: env.REDIS_URL });
  }

  throw new Error(`Redis unavailable after ${REDIS_CONNECT_RETRIES} retries`);
}

export async function connectRedis(): Promise<void> {
  await ensureRedisReady();
}
