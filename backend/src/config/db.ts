import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectDB(): Promise<void> {
  let connected = false;

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 2500 });
      logger.info("mongodb_connected", { uri: env.MONGO_URI });
      connected = true;
      break;
    } catch (_error) {
      logger.warn("mongodb_connect_retry", { attempt });
      await wait(1500);
    }
  }

  if (!connected) {
    throw new Error("MongoDB unavailable");
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

    logger.info("mongodb_collections_ready", { collections: requiredCollections });
  }
}
