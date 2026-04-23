import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "../../../../");
const rootEnv = path.join(rootDir, ".env");
const rootSecrets = path.join(rootDir, ".env.secrets");
const ciEnv = path.join(rootDir, "deploy", "env", ".env.ci");
const ciSecrets = path.join(rootDir, "deploy", "env", ".env.secrets.ci");

if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv, override: false });
}

if (fs.existsSync(rootSecrets)) {
  dotenv.config({ path: rootSecrets, override: true });
}

if ((process.env.APP_ENV ?? "local").toLowerCase() === "docker") {
  if (fs.existsSync(ciEnv)) {
    dotenv.config({ path: ciEnv, override: true });
  }

  if (fs.existsSync(ciSecrets)) {
    dotenv.config({ path: ciSecrets, override: true });
  }
}

const appEnv = (process.env.APP_ENV ?? "local").toLowerCase();

const EnvSchema = z.object({
  APP_ENV: z.enum(["local", "docker", "production"]).optional(),
  NODE_ENV: z.string().optional(),
  PORT: z.string().min(1),
  PORTFOLIO_SERVICE_PORT: z.string().optional(),
  MONGO_URI: z.string().min(1),
  MONGO_URI_LOCAL: z.string().min(1),
  MONGO_URI_DOCKER: z.string().min(1),
  MONGO_URI_PRODUCTION: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_URL_LOCAL: z.string().min(1),
  REDIS_URL_DOCKER: z.string().min(1),
  REDIS_URL_PRODUCTION: z.string().min(1),
  KAFKA_ENABLED: z.enum(["true", "false"]),
  KAFKA_BROKER: z.string().min(1),
  KAFKA_BROKER_LOCAL: z.string().min(1),
  KAFKA_BROKER_DOCKER: z.string().min(1),
  KAFKA_BROKER_PRODUCTION: z.string().min(1),
  KAFKA_SASL_MECHANISM: z.string().optional(),
  KAFKA_SASL_USERNAME: z.string().optional(),
  KAFKA_SASL_PASSWORD: z.string().optional(),
  KAFKA_PORTFOLIO_EVENT_PARTITIONS: z.string().optional(),
});

EnvSchema.parse(process.env);

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

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
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

export const CONFIG = {
  appEnv,
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: numberEnv("PORTFOLIO_SERVICE_PORT", numberEnv("PORT", 4011)),
  mongoUri: envByAppMode("MONGO_URI"),
  redisUrl: envByAppMode("REDIS_URL"),
  kafkaEnabled: booleanEnv("KAFKA_ENABLED"),
  kafkaBroker: envByAppMode("KAFKA_BROKER"),
  kafkaSaslMechanism: optionalEnv("KAFKA_SASL_MECHANISM"),
  kafkaSaslUsername: optionalEnv("KAFKA_SASL_USERNAME"),
  kafkaSaslPassword: optionalEnv("KAFKA_SASL_PASSWORD"),
  kafkaPortfolioPartitions: numberEnv("KAFKA_PORTFOLIO_EVENT_PARTITIONS", 6),
};
