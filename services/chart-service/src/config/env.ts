import { z } from "zod";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function loadOptionalSecrets(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const explicitPath = process.env.CHART_SERVICE_SECRETS_PATH;
  const candidates = [
    explicitPath,
    path.resolve(here, "../../../../.env.secrets"),
    path.resolve(here, "../../../.env.secrets"),
    path.resolve(process.cwd(), ".env.secrets"),
  ].filter((value): value is string => Boolean(value));

  const visited = new Set<string>();
  for (const candidate of candidates) {
    const normalized = path.resolve(candidate);
    if (visited.has(normalized)) {
      continue;
    }
    visited.add(normalized);

    if (!fs.existsSync(normalized)) {
      continue;
    }

    dotenv.config({ path: normalized, override: false });
    break;
  }
}

loadOptionalSecrets();

const boolFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on"].includes(normalized);
  }
  return value;
}, z.boolean());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.string().default("local"),
  PORT: z.coerce.number().int().positive().default(3009),
  BACKEND_URL: z.string().url().default("http://127.0.0.1:4000"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  KAFKA_BROKERS: z.string().default("localhost:19092"),
  CHART_SERVICE_AUTH_ENABLED: boolFromEnv.default(false),
  CHART_SERVICE_AUTH_TOKEN: z.string().default(""),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  WARM_WINDOW: z.coerce.number().int().positive().default(150),
  ENABLE_INDICATOR_WORKER: boolFromEnv.default(true),
  CHART_UPSTREAM_WS_URL: z.string().url().optional(),
  CHART_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid chart-service environment: ${parsed.error.message}`);
}

export const env = {
  ...parsed.data,
  kafkaBrokers: parsed.data.KAFKA_BROKERS.split(",").map((v) => v.trim()).filter(Boolean),
};

export type Env = typeof env;
