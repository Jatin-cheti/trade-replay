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

export const env = {
  NODE_ENV: targetEnv,
  PORT: Number(readProfileVar("PORT", "4000")),
  CLIENT_URL: readProfileVar("CLIENT_URL", "http://localhost:8080"),
  MONGO_URI: readProfileVar("MONGO_URI", "mongodb://127.0.0.1:27017/tradereplay"),
  REDIS_URL: readProfileVar("REDIS_URL", "redis://127.0.0.1:6379"),
  JWT_SECRET: readProfileVar("JWT_SECRET", "dev-secret"),
  ALPHA_VANTAGE_KEY: readProfileVar("ALPHA_VANTAGE_KEY", ""),
  GOOGLE_CLIENT_ID: readProfileVar("GOOGLE_CLIENT_ID", ""),
  USD_TO_INR: Number(readProfileVar("USD_TO_INR", "83.5")),
};
