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
  NODE_ENV: process.env.NODE_ENV ?? "local",
  MONGO_URI: read("MONGO_URI", "mongodb://127.0.0.1:27017/tradereplay"),
  REDIS_URL: read("REDIS_URL", "redis://127.0.0.1:6379"),
  KAFKA_ENABLED: read("KAFKA_ENABLED", "false") === "true",
  KAFKA_BROKERS: read("KAFKA_BROKERS", "127.0.0.1:9092"),
  AWS_REGION: process.env.AWS_REGION ?? "",
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET ?? "",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  AWS_CDN_BASE_URL: process.env.AWS_CDN_BASE_URL ?? "",
};

export const hasAwsConfig = Boolean(
  env.AWS_REGION
  && env.AWS_S3_BUCKET
  && env.AWS_ACCESS_KEY_ID
  && env.AWS_SECRET_ACCESS_KEY,
);
