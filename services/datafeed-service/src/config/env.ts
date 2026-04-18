import "dotenv/config";

export const env = {
  PORT: Number(process.env.PORT) || 3008,
  MONGO_URI: process.env.MONGODB_URI || "",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  FMP_API_KEY: process.env.FMP_API_KEY || "",
  ALPHA_VANTAGE_KEY: process.env.ALPHA_VANTAGE_KEY || "",
};

if (!env.MONGO_URI) throw new Error("MONGODB_URI is required");
