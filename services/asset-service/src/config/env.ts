import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env = {
  PORT: Number(process.env.PORT || "3002"),
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGO_URI: required("MONGO_URI"),
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
} as const;
