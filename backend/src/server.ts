import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { env } from "./config/env";
import { CONFIG } from "./config/index";
import { createApp } from "./app";
import { bootstrapKafkaProducerOnly, shutdownKafka } from "./kafka";
import { logger } from "./utils/logger";
import { bootstrapAlerts } from "./services/alertsEngine.service";
import { SymbolModel } from "./models/Symbol";
import { ingestGlobalSymbols } from "./services/ingestion.service";

type NodeErrorWithCode = Error & { code?: string };

async function ensureSymbolsIngested(): Promise<void> {
  const symbolCount = await SymbolModel.estimatedDocumentCount();
  if (symbolCount > 0) {
    logger.info("symbol_ingestion_skip_existing", { count: symbolCount });
    return;
  }

  logger.warn("symbol_ingestion_auto_bootstrap_start", { reason: "empty_symbols_collection" });
  const result = await ingestGlobalSymbols();
  logger.info("symbol_ingestion_auto_bootstrap_done", result);
}

async function bootstrap() {
  logger.info("bootstrap_start");
  console.log("CONFIG CHECK", {
    env: process.env.APP_ENV,
    redis: CONFIG.redisUrl,
    kafka: CONFIG.kafkaBroker,
    mongo: process.env.MONGO_URI,
    hasGoogleClientId: Boolean(env.GOOGLE_CLIENT_ID),
    clientUrl: env.CLIENT_URL,
  });
  logger.info("redis_url_config", { url: env.REDIS_URL });
  logger.info("bootstrap_connect_mongodb");
  await connectDB();
  logger.info("bootstrap_connect_redis");
  await connectRedis();
  await ensureSymbolsIngested();
  await bootstrapKafkaProducerOnly();
  logger.info("bootstrap_alerts");
  await bootstrapAlerts();
  logger.info("bootstrap_create_app");
  const { httpServer } = createApp();
  const listenPort = env.PORT;

  httpServer.on("error", (error: unknown) => {
    const nodeError = error as NodeErrorWithCode;
    if (nodeError?.code === "EADDRINUSE") {
      logger.error("http_server_port_in_use", {
        port: listenPort,
        code: nodeError.code,
        error: nodeError.message,
      });
      process.exit(1);
      return;
    }

    logger.error("http_server_error", {
      error: error instanceof Error ? error.message : String(error),
      code: nodeError?.code,
    });
  });

  httpServer.listen(listenPort, () => {
    logger.info("backend_listening", { port: listenPort });
  });

  const stop = async () => {
    logger.info("backend_shutdown_start");
    await shutdownKafka();
    httpServer.close(() => {
      logger.info("backend_shutdown_complete");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}

bootstrap().catch((error) => {
  logger.error("bootstrap_failed", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});