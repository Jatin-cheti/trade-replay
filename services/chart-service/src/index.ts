import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { connectRedis } from "./config/redis";
import { startStreaming } from "./services/streaming";
import { logError, logInfo } from "./services/logger";

async function bootstrap(): Promise<void> {
  const app = createApp();
  let stopStreaming: (() => Promise<void>) | null = null;

  try {
    await connectRedis();
  } catch {
    // Continue with in-memory cache fallback.
  }

  const server = createServer(app);
  server.listen(env.PORT, () => {
    logInfo("chart_service_started", { port: env.PORT });
  });

  stopStreaming = await startStreaming();

  const stop = () => {
    void (async () => {
      if (stopStreaming) {
        await stopStreaming();
      }
      server.close(() => process.exit(0));
    })();
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

bootstrap().catch((error) => {
  logError("chart_service_bootstrap_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
