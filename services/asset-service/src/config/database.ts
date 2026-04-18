import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB(): Promise<void> {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 2500 });
      console.log(`[asset-service] MongoDB connected`);
      return;
    } catch {
      console.warn(`[asset-service] MongoDB retry ${attempt}/10`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error("MongoDB unavailable after 10 retries");
}
