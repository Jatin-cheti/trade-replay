import "dotenv/config";

export const env = {
  PORT: Number(process.env.PORT) || 3006,
  MONGO_URI: process.env.MONGODB_URI || "",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  JWT_SECRET: process.env.JWT_SECRET || "change-me",
};

if (!env.MONGO_URI) throw new Error("MONGODB_URI is required");
