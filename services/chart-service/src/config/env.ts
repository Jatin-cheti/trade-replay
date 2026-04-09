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
  CHART_CACHE_TTL_SECONDS: Number(read("CHART_CACHE_TTL_SECONDS", "120")),
  CHART_CANDLE_SOURCE_PATH: read("CHART_CANDLE_SOURCE_PATH", "/api/live/candles"),
  CHART_SERVICE_TIMEOUT_MS: Number(read("CHART_SERVICE_TIMEOUT_MS", "5000")),
};
