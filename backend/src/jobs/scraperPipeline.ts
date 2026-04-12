import mongoose from "mongoose";
import { logger } from "../utils/logger";
import { runScraperPipeline } from "../services/scrapers/scraperPipeline.service";

(async () => {
  try {
    await runScraperPipeline();
  } catch (error) {
    logger.error("scraper_pipeline_crash", { message: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();