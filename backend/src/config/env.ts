import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, "../../../.env");
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

const targetEnv = (process.env.NODE_ENV ?? "local").toLowerCase();

function getPrefixForNodeEnv(nodeEnv: string): "LOCAL" | "DEV" | "QA" | "PROD" {
  if (nodeEnv === "production" || nodeEnv === "prod") return "PROD";
  if (nodeEnv === "qa" || nodeEnv === "test") return "QA";
  if (nodeEnv === "development" || nodeEnv === "dev") return "DEV";
  return "LOCAL";
}

const envPrefix = getPrefixForNodeEnv(targetEnv);

function readProfileVar(key: string, fallback: string): string {
  return process.env[`${envPrefix}_${key}`]
    ?? process.env[`LOCAL_${key}`]
    ?? process.env[key]
    ?? fallback;
}

function readMongoUri(fallback: string): string {
  return process.env[`${envPrefix}_MONGODB_URI`]
    ?? process.env[`LOCAL_MONGODB_URI`]
    ?? process.env.MONGODB_URI
    ?? process.env[`${envPrefix}_MONGO_URL`]
    ?? process.env[`LOCAL_MONGO_URL`]
    ?? process.env.MONGO_URL
    ?? process.env[`${envPrefix}_MONGO_URI`]
    ?? process.env[`LOCAL_MONGO_URI`]
    ?? process.env.MONGO_URI
    ?? fallback;
}

export const env = {
  NODE_ENV: targetEnv,
  PORT: Number(readProfileVar("PORT", "4000")),
  CLIENT_URL: readProfileVar("CLIENT_URL", "http://localhost:8080"),
  CLIENT_URLS: readProfileVar("CLIENT_URLS", "http://localhost:8080,http://localhost:8081")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  MONGO_URI: readMongoUri("mongodb://127.0.0.1:27017/tradereplay"),
  REDIS_URL: readProfileVar("REDIS_URL", "redis://127.0.0.1:6379"),
  KAFKA_ENABLED: readProfileVar("KAFKA_ENABLED", "false") === "true",
  KAFKA_BROKERS: readProfileVar("KAFKA_BROKERS", "127.0.0.1:9092"),
  KAFKA_SASL_MECHANISM: readProfileVar("KAFKA_SASL_MECHANISM", "plain"),
  KAFKA_SASL_USERNAME: readProfileVar("KAFKA_SASL_USERNAME", ""),
  KAFKA_SASL_PASSWORD: readProfileVar("KAFKA_SASL_PASSWORD", ""),
  JWT_SECRET: readProfileVar("JWT_SECRET", "dev-secret"),
  CURSOR_SIGNING_SECRET: readProfileVar("CURSOR_SIGNING_SECRET", readProfileVar("JWT_SECRET", "dev-secret")),
  ALPHA_VANTAGE_KEY: readProfileVar("ALPHA_VANTAGE_KEY", ""),
  GOOGLE_CLIENT_ID: readProfileVar("GOOGLE_CLIENT_ID", ""),
  FMP_API_KEY: readProfileVar("FMP_API_KEY", ""),
  AWS_REGION: process.env.AWS_REGION ?? "",
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET ?? "",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  AWS_CDN_BASE_URL: process.env.AWS_CDN_BASE_URL ?? "",
  LOG_REQUEST_SAMPLE_RATE: Math.max(0, Math.min(1, Number(readProfileVar("LOG_REQUEST_SAMPLE_RATE", "0.1")) || 0.1)),
  LOGO_ENRICHMENT_ENABLED: readProfileVar("LOGO_ENRICHMENT_ENABLED", "true") === "true",
  LOGO_ENRICHMENT_INTERVAL_MS: Number(readProfileVar("LOGO_ENRICHMENT_INTERVAL_MS", String(6 * 60 * 60 * 1000))),
  LOGO_FALLBACK_TARGET_RATIO: Number(readProfileVar("LOGO_FALLBACK_TARGET_RATIO", "0.05")),
  CHART_SERVICE_ENABLED: readProfileVar("CHART_SERVICE_ENABLED", "false") === "true",
  CHART_SERVICE_URL: readProfileVar("CHART_SERVICE_URL", "http://127.0.0.1:4010"),
  CHART_SERVICE_AUTH_ENABLED: readProfileVar("CHART_SERVICE_AUTH_ENABLED", "false") === "true",
  CHART_SERVICE_AUTH_TOKEN: readProfileVar("CHART_SERVICE_AUTH_TOKEN", ""),
  CHART_SERVICE_TIMEOUT_MS: Number(readProfileVar("CHART_SERVICE_TIMEOUT_MS", "1500")),
  CHART_SERVICE_RETRY_COUNT: Math.max(0, Number(readProfileVar("CHART_SERVICE_RETRY_COUNT", "1"))),
  CHART_SERVICE_RETRY_BASE_MS: Math.max(10, Number(readProfileVar("CHART_SERVICE_RETRY_BASE_MS", "150"))),
  CHART_SERVICE_BREAKER_FAILURE_THRESHOLD: Math.max(1, Number(readProfileVar("CHART_SERVICE_BREAKER_FAILURE_THRESHOLD", "5"))),
  CHART_SERVICE_BREAKER_FAILURE_WINDOW_MS: Math.max(1000, Number(readProfileVar("CHART_SERVICE_BREAKER_FAILURE_WINDOW_MS", "30000"))),
  CHART_SERVICE_BREAKER_COOLDOWN_MS: Math.max(1000, Number(readProfileVar("CHART_SERVICE_BREAKER_COOLDOWN_MS", "30000"))),
  USD_TO_INR: Number(readProfileVar("USD_TO_INR", "83.5")),
};
