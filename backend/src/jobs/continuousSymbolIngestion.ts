import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { continuousSymbolIngestion } from "../services/globalSymbolIngestion.service";
import { logger } from "../utils/logger";

async function main(): Promise<void> {
  await connectDB();
  logger.info("global_symbol_ingestion_loop_start");
  await continuousSymbolIngestion();
}

main().catch((error) => {
  logger.error("global_symbol_ingestion_loop_failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  mongoose.connection
    .close()
    .catch(() => {})
    .finally(() => process.exit(1));
});
