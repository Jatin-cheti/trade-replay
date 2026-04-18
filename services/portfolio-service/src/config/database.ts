import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB(): Promise<void> {
  let retries = 10;
  while (retries > 0) {
    try {
      await mongoose.connect(env.MONGO_URI);
      console.log("[portfolio-service] MongoDB connected");
      return;
    } catch {
      retries--;
      if (retries === 0) throw new Error("MongoDB connection failed");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
