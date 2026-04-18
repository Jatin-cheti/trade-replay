import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { ingestGlobalSymbolsOnce } from "../services/globalSymbolIngestion.service";
import { logger } from "../utils/logger";

async function main(): Promise<void> {
  await connectDB();

  logger.info("global_expansion_once_start");
  const result = await ingestGlobalSymbolsOnce();
  logger.info("global_expansion_once_complete", result);
}

main()
  .then(async () => {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    logger.error("global_expansion_once_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
