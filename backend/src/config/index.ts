import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../../.env");
const secretsPath = path.resolve(__dirname, "../../../.env.secrets");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}
if (fs.existsSync(secretsPath)) {
  dotenv.config({ path: secretsPath, override: true });
}

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
  REDIS_URL_QUEUE: z.string().optional(),
  REDIS_URL_PUBSUB: z.string().optional(),
  REDIS_URL_FALLBACK: z.string().optional(),
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
  ASSET_SERVICE_URL: z.string().optional(),
  ASSET_SERVICE_INTERNAL_PORT: z.string().optional(),
  ASSET_SERVICE_INTERNAL_TOKEN: z.string().optional(),
  LOG_REQUEST_SAMPLE_RATE: z.string().min(1),
  LOGO_ENRICHMENT_ENABLED: z.enum(["true", "false"]),
  LOGO_ENRICHMENT_INTERVAL_MS: z.string().min(1),
  LOGO_FALLBACK_TARGET_RATIO: z.string().min(1),
  USD_TO_INR: z.string().min(1),
  GEMINI_API_KEY: z.string().optional(),
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

  if (hasAny && !hasAll) {
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
  redisQueueUrl: process.env.REDIS_URL_QUEUE || envByAppMode("REDIS_URL"),
  redisPubsubUrl: process.env.REDIS_URL_PUBSUB || envByAppMode("REDIS_URL"),
  redisFallbackUrl: process.env.REDIS_URL_FALLBACK || "",
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
  assetServiceUrl: process.env.ASSET_SERVICE_URL || `http://127.0.0.1:${process.env.ASSET_SERVICE_INTERNAL_PORT || "4011"}`,
  assetServiceInternalPort: Number(process.env.ASSET_SERVICE_INTERNAL_PORT || "4011"),
  assetServiceInternalToken: process.env.ASSET_SERVICE_INTERNAL_TOKEN || requiredEnv("CURSOR_SIGNING_SECRET"),
  logRequestSampleRate: numberEnv("LOG_REQUEST_SAMPLE_RATE"),
  logoEnrichmentEnabled: booleanEnv("LOGO_ENRICHMENT_ENABLED"),
  logoEnrichmentIntervalMs: numberEnv("LOGO_ENRICHMENT_INTERVAL_MS"),
  logoFallbackTargetRatio: numberEnv("LOGO_FALLBACK_TARGET_RATIO"),
  usdToInr: numberEnv("USD_TO_INR"),
  geminiApiKey: optionalEnv("GEMINI_API_KEY"),
};



