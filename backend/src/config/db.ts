import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

let mongoMemoryServer: { stop: () => Promise<boolean>; getUri: () => string } | null = null;

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getMongoDbName(uri: string): string {
  try {
    const parsed = new URL(uri);
    return parsed.pathname.replace(/^\//, "") || "tradereplay";
  } catch {
    return "tradereplay";
  }
}

export async function connectDB(): Promise<void> {
  let connected = false;
  let mongoUri = env.MONGO_URI;
  const dbName = getMongoDbName(mongoUri);

  logger.info("mongodb_connect_start", {
    uri: env.MONGO_URI,
    dbName,
    supportedEnvKeys: [
      "MONGODB_URI",
      "MONGO_URL",
      "MONGO_URI",
      "LOCAL_MONGODB_URI",
      "LOCAL_MONGO_URL",
      "LOCAL_MONGO_URI",
      "DEV_MONGODB_URI",
      "DEV_MONGO_URL",
      "DEV_MONGO_URI",
    ],
  });

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2500 });
      logger.info("mongodb_connected", { uri: mongoUri, dbName });
      connected = true;
      break;
    } catch (_error) {
      logger.warn("mongodb_connect_retry", { attempt, uri: mongoUri, dbName });
      await wait(1500);
    }
  }

  const shouldUseMemoryMongo = (env.NODE_ENV === "test" || env.E2E) && env.E2E_USE_MEMORY_MONGO;
  if (!connected && shouldUseMemoryMongo) {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const memoryServer = await MongoMemoryServer.create();
    mongoMemoryServer = memoryServer;
    mongoUri = memoryServer.getUri();
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2500 });
    logger.warn("mongodb_memory_server_enabled", { uri: mongoUri });
    connected = true;
  }

  if (!connected) {
    throw new Error(`MongoDB unavailable after retries: ${mongoUri} (${dbName})`);
  }

  const db = mongoose.connection.db;
  if (db) {
    const requiredCollections = ["users", "portfolios", "trades", "simulationsessions"];
    const existing = await db.listCollections().toArray();
    const existingNames = new Set(existing.map((collection) => collection.name));

    for (const name of requiredCollections) {
      if (!existingNames.has(name)) {
        await db.createCollection(name);
      }
    }

    logger.info("mongodb_collections_ready", { collections: requiredCollections, dbName });
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
    mongoMemoryServer = null;
  }
}
