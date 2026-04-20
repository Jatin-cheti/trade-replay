import { z } from "zod";
import { loadEnv } from "./loadEnv.js";

// Load .env and .env.secrets deterministically (must be first)
const envStatus = loadEnv();

function setIfMissing(name: string, value: string | undefined): void {
  if (value === undefined) return;
  if (process.env[name] === undefined || process.env[name] === "") {
    process.env[name] = value;
  }
}

function normalizeLocalEnv(): void {
  const localMongo = process.env.LOCAL_MONGO_URL
    ?? process.env.LOCAL_MONGODB_URI
    ?? process.env.LOCAL_MONGO_URI;
  const localRedisRaw = process.env.LOCAL_REDIS_URL;
  const localKafkaRaw = process.env.LOCAL_KAFKA_BROKERS;
  const localRedis = localRedisRaw && /redis:\/\/redis[:/]/i.test(localRedisRaw)
    ? "redis://127.0.0.1:6379"
    : (localRedisRaw ?? "redis://127.0.0.1:6379");
  const localKafkaBrokers = localKafkaRaw && /(^|,)\s*kafka:\d+/i.test(localKafkaRaw)
    ? "localhost:19092"
    : (localKafkaRaw ?? "localhost:19092");

  setIfMissing("PORT", process.env.LOCAL_PORT);
  setIfMissing("CLIENT_URL", process.env.LOCAL_CLIENT_URL);
  setIfMissing("CLIENT_URLS", process.env.LOCAL_CLIENT_URLS);
  setIfMissing("API_RATE_LIMIT_MAX", "2000");

  setIfMissing("MONGO_URI", localMongo);
  setIfMissing("MONGO_URI_LOCAL", localMongo);
  setIfMissing("MONGO_URI_DOCKER", localMongo);
  setIfMissing("MONGO_URI_PRODUCTION", localMongo);

  setIfMissing("REDIS_URL", localRedis);
  setIfMissing("REDIS_URL_LOCAL", localRedis);
  setIfMissing("REDIS_URL_DOCKER", localRedis);
  setIfMissing("REDIS_URL_PRODUCTION", localRedis);
  setIfMissing("REDIS_ENABLED", process.env.LOCAL_REDIS_ENABLED ?? "false");

  setIfMissing("KAFKA_ENABLED", process.env.LOCAL_KAFKA_ENABLED ?? "false");
  setIfMissing("KAFKA_BROKER", localKafkaBrokers);
  setIfMissing("KAFKA_BROKER_LOCAL", localKafkaBrokers);
  setIfMissing("KAFKA_BROKER_DOCKER", localKafkaBrokers);
  setIfMissing("KAFKA_BROKER_PRODUCTION", localKafkaBrokers);
  setIfMissing("KAFKA_DEFAULT_PARTITIONS", "3");
  setIfMissing("KAFKA_SYMBOL_EVENT_PARTITIONS", "6");
  setIfMissing("KAFKA_PORTFOLIO_EVENT_PARTITIONS", "6");
  setIfMissing("ANALYTICS_CONSUMER_GROUP", "tradereplay-analytics-processor");
  setIfMissing("KAFKA_SASL_MECHANISM", process.env.LOCAL_KAFKA_SASL_MECHANISM ?? "plain");
  setIfMissing("KAFKA_SASL_USERNAME", process.env.LOCAL_KAFKA_SASL_USERNAME ?? "");
  setIfMissing("KAFKA_SASL_PASSWORD", process.env.LOCAL_KAFKA_SASL_PASSWORD ?? "");

  setIfMissing("JWT_SECRET", process.env.LOCAL_JWT_SECRET);
  setIfMissing("CURSOR_SIGNING_SECRET", process.env.LOCAL_JWT_SECRET);
  setIfMissing("ALPHA_VANTAGE_KEY", process.env.LOCAL_ALPHA_VANTAGE_KEY ?? "");
  setIfMissing("GOOGLE_CLIENT_ID", process.env.LOCAL_GOOGLE_CLIENT_ID ?? "");

  setIfMissing("LOG_REQUEST_SAMPLE_RATE", "0.1");
  setIfMissing("LOGO_ENRICHMENT_ENABLED", "false");
  setIfMissing("LOGO_ENRICHMENT_INTERVAL_MS", "21600000");
  setIfMissing("LOGO_FALLBACK_TARGET_RATIO", "0.05");
  setIfMissing("LOGO_SERVICE_ENABLED", (process.env.APP_ENV ?? "local") === "local" ? "false" : "true");
  setIfMissing("LOGO_SERVICE_MODE", (process.env.APP_ENV ?? "local") === "local" ? "remote" : "local");
  setIfMissing("LOGO_SERVICE_URL", process.env.LOCAL_LOGO_SERVICE_URL ?? "");
  setIfMissing("DEV_AUTO_START_INFRA", "true");
  setIfMissing("DEV_ALLOW_MEMORY_DB", "true");
  setIfMissing("DEV_ALLOW_MOCK_REDIS", "true");
  setIfMissing("DEV_DISABLE_KAFKA_IF_UNAVAILABLE", "true");
  setIfMissing("E2E_USE_MEMORY_MONGO", "false");
  setIfMissing("E2E_USE_MOCK_REDIS", "false");
  setIfMissing("E2E", process.env.PLAYWRIGHT_TEST ? "1" : "0");
  setIfMissing("USD_TO_INR", process.env.LOCAL_USD_TO_INR ?? "83.5");
}

normalizeLocalEnv();

const appEnv = (process.env.APP_ENV ?? "local").toLowerCase();

const EnvSchema = z.object({
  APP_ENV: z.enum(["local", "docker", "production"]).optional(),
  NODE_ENV: z.string().optional(),
  PORT: z.string().min(1),
  API_RATE_LIMIT_MAX: z.string().min(1),
  CLIENT_URL: z.string().min(1),
  MONGO_URI: z.string().min(1),
  MONGO_URI_LOCAL: z.string().min(1),
  MONGO_URI_DOCKER: z.string().min(1),
  MONGO_URI_PRODUCTION: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_URL_LOCAL: z.string().min(1),
  REDIS_URL_DOCKER: z.string().min(1),
  REDIS_URL_PRODUCTION: z.string().min(1),
  REDIS_ENABLED: z.enum(["true", "false"]),
  KAFKA_ENABLED: z.enum(["true", "false"]),
  KAFKA_BROKER: z.string().min(1),
  KAFKA_BROKER_LOCAL: z.string().min(1),
  KAFKA_BROKER_DOCKER: z.string().min(1),
  KAFKA_BROKER_PRODUCTION: z.string().min(1),
  KAFKA_DEFAULT_PARTITIONS: z.string().min(1),
  KAFKA_SYMBOL_EVENT_PARTITIONS: z.string().min(1),
  KAFKA_PORTFOLIO_EVENT_PARTITIONS: z.string().min(1),
  ANALYTICS_CONSUMER_GROUP: z.string().min(1),
  KAFKA_SASL_MECHANISM: z.string().min(1),
  KAFKA_SASL_USERNAME: z.string().optional(),
  KAFKA_SASL_PASSWORD: z.string().optional(),
  JWT_SECRET: z.string().min(1),
  CURSOR_SIGNING_SECRET: z.string().min(1),
  ALPHA_VANTAGE_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  FMP_API_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  OPENFIGI_API_KEY: z.string().optional(),
  AWS_REGION: z.string().min(1).optional(),
  AWS_S3_BUCKET: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  AWS_CDN_BASE_URL: z.string().optional(),
  LOG_REQUEST_SAMPLE_RATE: z.string().min(1),
  LOGO_ENRICHMENT_ENABLED: z.enum(["true", "false"]),
  LOGO_ENRICHMENT_INTERVAL_MS: z.string().min(1),
  LOGO_FALLBACK_TARGET_RATIO: z.string().min(1),
  CLIENT_URLS: z.string().optional(),
  CHART_SERVICE_ENABLED: z.enum(["true", "false"]).optional(),
  CHART_SERVICE_URL: z.string().optional(),
  CHART_SERVICE_AUTH_ENABLED: z.enum(["true", "false"]).optional(),
  CHART_SERVICE_AUTH_TOKEN: z.string().optional(),
  CHART_SERVICE_TIMEOUT_MS: z.string().optional(),
  CHART_SERVICE_RETRY_COUNT: z.string().optional(),
  CHART_SERVICE_RETRY_BASE_MS: z.string().optional(),
  CHART_SERVICE_BREAKER_FAILURE_THRESHOLD: z.string().optional(),
  CHART_SERVICE_BREAKER_FAILURE_WINDOW_MS: z.string().optional(),
  CHART_SERVICE_BREAKER_COOLDOWN_MS: z.string().optional(),
  ASSET_SERVICE_URL: z.string().optional(),
  ASSET_SERVICE_INTERNAL_PORT: z.string().optional(),
  ASSET_SERVICE_INTERNAL_TOKEN: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  LOGO_SERVICE_ENABLED: z.enum(["true", "false"]).optional(),
  LOGO_SERVICE_MODE: z.enum(["local", "remote", "disabled"]).optional(),
  LOGO_SERVICE_URL: z.string().optional(),
  DEV_AUTO_START_INFRA: z.enum(["true", "false"]).optional(),
  DEV_ALLOW_MEMORY_DB: z.enum(["true", "false"]).optional(),
  DEV_ALLOW_MOCK_REDIS: z.enum(["true", "false"]).optional(),
  DEV_DISABLE_KAFKA_IF_UNAVAILABLE: z.enum(["true", "false"]).optional(),
  E2E_USE_MEMORY_MONGO: z.enum(["true", "false"]).optional(),
  E2E_USE_MOCK_REDIS: z.enum(["true", "false"]).optional(),
  E2E: z.enum(["0", "1"]).optional(),
  USD_TO_INR: z.string().min(1),
});

EnvSchema.parse(process.env);

// Production safety: reject weak/placeholder secrets
if (appEnv === "production") {
  const jwtSecret = process.env.JWT_SECRET ?? "";
  if (jwtSecret.length < 32 || /^(change.me|test|dev|secret)$/i.test(jwtSecret)) {
    throw new Error("FATAL: JWT_SECRET is too weak or a placeholder. Generate with: openssl rand -hex 32");
  }
  const cursorSecret = process.env.CURSOR_SIGNING_SECRET ?? "";
  if (cursorSecret.length < 16 || /^(change.me|test|dev|secret)$/i.test(cursorSecret)) {
    throw new Error("FATAL: CURSOR_SIGNING_SECRET is too weak or a placeholder.");
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string {
  return process.env[name] ?? "";
}

function numberEnv(name: string): number {
  const raw = requiredEnv(name);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid numeric env ${name}: ${raw}`);
  }
  return value;
}

function booleanEnv(name: string): boolean {
  const raw = requiredEnv(name).toLowerCase();
  if (raw !== "true" && raw !== "false") {
    throw new Error(`Invalid boolean env ${name}: ${raw}`);
  }
  return raw === "true";
}

function envByAppMode(baseName: string): string {
  const modeKey = `${baseName}_${appEnv.toUpperCase()}`;
  const value = process.env[modeKey] ?? process.env[baseName];
  if (!value) {
    throw new Error(`Missing ${modeKey} or ${baseName}`);
  }
  return value;
}

function assertBrokerSafetyForMode(mode: string, broker: string): void {
  if (mode !== "production") return;
  const normalized = broker.trim().toLowerCase();
  if (!normalized) {
    throw new Error("KAFKA_BROKER_PRODUCTION must be set for production mode");
  }
  if (normalized.includes("localhost") || normalized.includes("127.0.0.1")) {
    throw new Error("KAFKA_BROKER_PRODUCTION must not use localhost or loopback addresses");
  }
}

function readAwsConfigByMode(mode: string): {
  awsRegion: string;
  awsS3Bucket: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsCdnBaseUrl: string;
} {
  const awsRegion = optionalEnv("AWS_REGION");
  const awsS3Bucket = optionalEnv("AWS_S3_BUCKET");
  const awsAccessKeyId = optionalEnv("AWS_ACCESS_KEY_ID");
  const awsSecretAccessKey = optionalEnv("AWS_SECRET_ACCESS_KEY");
  const awsCdnBaseUrl = optionalEnv("AWS_CDN_BASE_URL");

  const values = [awsRegion, awsS3Bucket, awsAccessKeyId, awsSecretAccessKey];
  const hasAny = values.some((value) => value.length > 0);
  const hasAll = values.every((value) => value.length > 0);

  if (mode === "production" && !hasAll) {
    throw new Error("Production mode requires AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY");
  }

  if (mode === "production" && hasAny && !hasAll) {
    throw new Error("AWS config must provide all required fields or none");
  }

  return {
    awsRegion,
    awsS3Bucket,
    awsAccessKeyId,
    awsSecretAccessKey,
    awsCdnBaseUrl,
  };
}

const awsConfig = readAwsConfigByMode(appEnv);

export const CONFIG = {
  appEnv,
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: numberEnv("PORT"),
  apiRateLimitMax: numberEnv("API_RATE_LIMIT_MAX"),
  clientUrl: requiredEnv("CLIENT_URL"),
  mongoUri: envByAppMode("MONGO_URI"),
  redisUrl: envByAppMode("REDIS_URL"),
  redisEnabled: booleanEnv("REDIS_ENABLED"),
  kafkaEnabled: booleanEnv("KAFKA_ENABLED"),
  kafkaBroker: (() => {
    const resolved = envByAppMode("KAFKA_BROKER");
    assertBrokerSafetyForMode(appEnv, resolved);
    return resolved;
  })(),
  kafkaDefaultPartitions: numberEnv("KAFKA_DEFAULT_PARTITIONS"),
  kafkaSymbolEventPartitions: numberEnv("KAFKA_SYMBOL_EVENT_PARTITIONS"),
  kafkaPortfolioEventPartitions: numberEnv("KAFKA_PORTFOLIO_EVENT_PARTITIONS"),
  analyticsConsumerGroup: requiredEnv("ANALYTICS_CONSUMER_GROUP"),
  kafkaSaslMechanism: requiredEnv("KAFKA_SASL_MECHANISM"),
  kafkaSaslUsername: optionalEnv("KAFKA_SASL_USERNAME"),
  kafkaSaslPassword: optionalEnv("KAFKA_SASL_PASSWORD"),
  jwtSecret: requiredEnv("JWT_SECRET"),
  cursorSigningSecret: requiredEnv("CURSOR_SIGNING_SECRET"),
  alphaVantageKey: optionalEnv("ALPHA_VANTAGE_KEY"),
  googleClientId: optionalEnv("GOOGLE_CLIENT_ID"),
  fmpApiKey: optionalEnv("FMP_API_KEY"),
  coingeckoApiKey: optionalEnv("COINGECKO_API_KEY"),
  openfigiApiKey: optionalEnv("OPENFIGI_API_KEY"),
  awsRegion: awsConfig.awsRegion,
  awsS3Bucket: awsConfig.awsS3Bucket,
  awsAccessKeyId: awsConfig.awsAccessKeyId,
  awsSecretAccessKey: awsConfig.awsSecretAccessKey,
  awsCdnBaseUrl: awsConfig.awsCdnBaseUrl,
  logRequestSampleRate: numberEnv("LOG_REQUEST_SAMPLE_RATE"),
  logoEnrichmentEnabled: booleanEnv("LOGO_ENRICHMENT_ENABLED"),
  logoEnrichmentIntervalMs: numberEnv("LOGO_ENRICHMENT_INTERVAL_MS"),
  logoFallbackTargetRatio: numberEnv("LOGO_FALLBACK_TARGET_RATIO"),
  clientUrls: (() => {
    const raw = optionalEnv("CLIENT_URLS");
    return raw ? raw.split(",").map(origin => origin.trim()).filter(Boolean) : [requiredEnv("CLIENT_URL")];
  })(),
  chartServiceEnabled: optionalEnv("CHART_SERVICE_ENABLED") === "true",
  chartServiceUrl: optionalEnv("CHART_SERVICE_URL") || "http://127.0.0.1:4010",
  chartServiceAuthEnabled: optionalEnv("CHART_SERVICE_AUTH_ENABLED") === "true",
  chartServiceAuthToken: optionalEnv("CHART_SERVICE_AUTH_TOKEN"),
  chartServiceTimeoutMs: optionalEnv("CHART_SERVICE_TIMEOUT_MS") ? Number(optionalEnv("CHART_SERVICE_TIMEOUT_MS")) : 1500,
  chartServiceRetryCount: optionalEnv("CHART_SERVICE_RETRY_COUNT") ? Math.max(0, Number(optionalEnv("CHART_SERVICE_RETRY_COUNT"))) : 1,
  chartServiceRetryBaseMs: optionalEnv("CHART_SERVICE_RETRY_BASE_MS") ? Math.max(10, Number(optionalEnv("CHART_SERVICE_RETRY_BASE_MS"))) : 150,
  chartServiceBreakerFailureThreshold: optionalEnv("CHART_SERVICE_BREAKER_FAILURE_THRESHOLD") ? Math.max(1, Number(optionalEnv("CHART_SERVICE_BREAKER_FAILURE_THRESHOLD"))) : 5,
  chartServiceBreakerFailureWindowMs: optionalEnv("CHART_SERVICE_BREAKER_FAILURE_WINDOW_MS") ? Math.max(1000, Number(optionalEnv("CHART_SERVICE_BREAKER_FAILURE_WINDOW_MS"))) : 30000,
  chartServiceBreakerCooldownMs: optionalEnv("CHART_SERVICE_BREAKER_COOLDOWN_MS") ? Math.max(1000, Number(optionalEnv("CHART_SERVICE_BREAKER_COOLDOWN_MS"))) : 30000,
  logoServiceEnabled: optionalEnv("LOGO_SERVICE_ENABLED") !== "false",
  logoServiceMode: (() => {
    const raw = optionalEnv("LOGO_SERVICE_MODE").toLowerCase();
    if (raw === "local" || raw === "remote" || raw === "disabled") {
      return raw;
    }
    return appEnv === "local" ? "remote" : "local";
  })(),
  logoServiceUrl: optionalEnv("LOGO_SERVICE_URL"),
  ASSET_SERVICE_URL: optionalEnv("ASSET_SERVICE_URL") || `http://127.0.0.1:${optionalEnv("ASSET_SERVICE_INTERNAL_PORT") || "4011"}`,
  ASSET_SERVICE_INTERNAL_PORT: Number(optionalEnv("ASSET_SERVICE_INTERNAL_PORT") || "4011"),
  ASSET_SERVICE_INTERNAL_TOKEN: optionalEnv("ASSET_SERVICE_INTERNAL_TOKEN") || requiredEnv("CURSOR_SIGNING_SECRET"),
  GEMINI_API_KEY: optionalEnv("GEMINI_API_KEY"),
  devAutoStartInfra: optionalEnv("DEV_AUTO_START_INFRA") !== "false",
  devAllowMemoryDb: optionalEnv("DEV_ALLOW_MEMORY_DB") !== "false",
  devAllowMockRedis: optionalEnv("DEV_ALLOW_MOCK_REDIS") !== "false",
  devDisableKafkaIfUnavailable: optionalEnv("DEV_DISABLE_KAFKA_IF_UNAVAILABLE") !== "false",
  e2eUseMemoryMongo: optionalEnv("E2E_USE_MEMORY_MONGO") === "true",
  e2eUseMockRedis: optionalEnv("E2E_USE_MOCK_REDIS") === "true",
  e2e: optionalEnv("E2E") === "1",
  usdToInr: numberEnv("USD_TO_INR"),
};



