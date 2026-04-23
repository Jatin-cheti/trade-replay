import mongoose from "mongoose";
import { env } from "./env";

let connected = false;

export async function connectDB(): Promise<void> {
  if (connected) return;

  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  connected = true;
  console.log(JSON.stringify({ message: "portfolio_service_mongodb_connected" }));
}
