import IORedis, { type RedisOptions } from "ioredis";
import RedisMock from "ioredis-mock";
import { env } from "./env";
import { logger } from "../utils/logger";

const REDIS_CONNECT_RETRIES = 10;
const REDIS_RETRY_DELAY_MS = 500;

let hasLoggedRedisError = false;
let hasLoggedRedisUnavailable = false;
const useMockRedisInTest = (env.NODE_ENV === "test" || env.E2E) && env.E2E_USE_MOCK_REDIS;
const useMockRedisByConfig = !env.REDIS_ENABLED && env.APP_ENV !== "production";
const allowMockRedisFallback = (env.APP_ENV !== "production") && env.DEV_ALLOW_MOCK_REDIS;
let useMockRedis = useMockRedisInTest || useMockRedisByConfig;
let redisLastError: string | null = null;
let hasLoggedMockMode = false;
let redisDisableReason: string | null = useMockRedisByConfig ? "disabled_by_config" : null;

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

export let redisConnectionOptions = parseRedisUrl(useMockRedis ? "redis://127.0.0.1:6379" : env.REDIS_URL);
function getRedisClientOptions(): RedisOptions {
  return {
    ...redisConnectionOptions,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  };
}

function createMockClient(): IORedis {
  return new (RedisMock as unknown as { new(url: string): IORedis })("redis://127.0.0.1:6379");
}

function createRealClient(): IORedis {
  return new IORedis(env.REDIS_URL, {
    ...getRedisClientOptions(),
  });
}

function createRedisClient(): IORedis {
  if (useMockRedis) {
    return createMockClient();
  }

  return createRealClient();
}

export let redisClient = createRedisClient();
export let redisPublisher = useMockRedis ? createMockClient() : redisClient.duplicate(getRedisClientOptions());
export let redisSubscriber = useMockRedis ? createMockClient() : redisClient.duplicate(getRedisClientOptions());

function attachRedisErrorHandlers(): void {
  redisClient.on("ready", resetRedisErrorFlag);
  redisPublisher.on("ready", resetRedisErrorFlag);
  redisSubscriber.on("ready", resetRedisErrorFlag);

  redisClient.on("error", (error) => {
    redisLastError = error instanceof Error ? error.message : String(error);
    logRedisErrorOnce("redis_error");
  });

  redisPublisher.on("error", (error) => {
    redisLastError = error instanceof Error ? error.message : String(error);
    logRedisErrorOnce("redis_publisher_error");
  });

  redisSubscriber.on("error", (error) => {
    redisLastError = error instanceof Error ? error.message : String(error);
    logRedisErrorOnce("redis_subscriber_error");
  });
}

attachRedisErrorHandlers();

function logRedisErrorOnce(channel: string): void {
  if (hasLoggedRedisError) return;
  hasLoggedRedisError = true;
  logger.error(channel, { message: "Redis connection issue" });
}

function resetRedisErrorFlag(): void {
  hasLoggedRedisError = false;
}

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

export function isRedisFallbackMode(): boolean {
  return useMockRedis;
}

export function getRedisHealthStatus(): {
  enabledByConfig: boolean;
  runtimeEnabled: boolean;
  ready: boolean;
  pubSubReady: boolean;
  fallback: "mock" | "external";
  degraded: boolean;
  lastError: string | null;
  reason: string | null;
} {
  return {
    enabledByConfig: env.REDIS_ENABLED,
    runtimeEnabled: env.REDIS_ENABLED || useMockRedis,
    ready: isRedisReady(),
    pubSubReady: isRedisPubSubReady(),
    fallback: useMockRedis ? "mock" : "external",
    degraded: useMockRedis,
    lastError: redisLastError,
    reason: redisDisableReason,
  };
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
    if (!hasLoggedMockMode) {
      hasLoggedMockMode = true;
      logger.warn("redis_mock_enabled", {
        reason: redisDisableReason ?? "test_or_fallback_mode",
      });
    }
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
    redisLastError = null;
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

  if (allowMockRedisFallback) {
    useMockRedis = true;
    redisDisableReason = "redis_unreachable_in_dev";
    redisConnectionOptions = parseRedisUrl("redis://127.0.0.1:6379");
    redisClient = createMockClient();
    redisPublisher = createMockClient();
    redisSubscriber = createMockClient();
    attachRedisErrorHandlers();
    hasLoggedMockMode = false;
    logger.warn("redis_dev_fallback_mock_enabled", {
      reason: "redis_unreachable",
      url: env.REDIS_URL,
    });
    await ensureRedisReady();
    return;
  }

  throw new Error(`Redis unavailable after ${REDIS_CONNECT_RETRIES} retries`);
}

export async function connectRedis(): Promise<void> {
  await ensureRedisReady();
}
