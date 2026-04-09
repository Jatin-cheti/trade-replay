import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, "../../../../.env");
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

function read(key: string, fallback: string): string {
  return process.env[key] ?? process.env[`LOCAL_${key}`] ?? fallback;
}

export const env = {
  PORT: Number(read("CHART_SERVICE_PORT", "4010")),
  REDIS_URL: read("REDIS_URL", "redis://127.0.0.1:6379"),
  MAIN_BACKEND_URL: read("MAIN_BACKEND_URL", "http://127.0.0.1:4000"),
  CHART_SERVICE_AUTH_ENABLED: read("CHART_SERVICE_AUTH_ENABLED", "false") === "true",
  CHART_SERVICE_AUTH_TOKEN: read("CHART_SERVICE_AUTH_TOKEN", ""),
  CHART_CACHE_TTL_SECONDS: Number(read("CHART_CACHE_TTL_SECONDS", "120")),
  CHART_CACHE_LIVE_TTL_SECONDS: Number(read("CHART_CACHE_LIVE_TTL_SECONDS", "15")),
  CHART_CACHE_HISTORICAL_TTL_SECONDS: Number(read("CHART_CACHE_HISTORICAL_TTL_SECONDS", "900")),
  CHART_CACHE_SWR_SECONDS: Number(read("CHART_CACHE_SWR_SECONDS", "30")),
  CHART_CANDLE_SOURCE_PATH: read("CHART_CANDLE_SOURCE_PATH", "/api/live/candles"),
  CHART_SERVICE_TIMEOUT_MS: Number(read("CHART_SERVICE_TIMEOUT_MS", "5000")),
  KAFKA_ENABLED: read("KAFKA_ENABLED", "false") === "true",
  KAFKA_BROKERS: read("KAFKA_BROKERS", "127.0.0.1:9092"),
  CHART_CANDLE_UPDATE_TOPIC: read("CHART_CANDLE_UPDATE_TOPIC", "chart.candle.updated"),
  CHART_KAFKA_DLQ_TOPIC: read("CHART_KAFKA_DLQ_TOPIC", "chart.candle.updated.dlq"),
  CHART_KAFKA_MAX_RETRIES: Math.max(0, Number(read("CHART_KAFKA_MAX_RETRIES", "5"))),
  CHART_KAFKA_RETRY_BASE_MS: Math.max(10, Number(read("CHART_KAFKA_RETRY_BASE_MS", "200"))),
  CHART_KAFKA_CLIENT_ID: read("CHART_KAFKA_CLIENT_ID", "chart-service"),
  CHART_KAFKA_GROUP_ID: read("CHART_KAFKA_GROUP_ID", "chart-service-consumers"),
};
