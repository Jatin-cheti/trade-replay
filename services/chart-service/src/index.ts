import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { closeRedis, connectRedis } from "./config/redis";
import { startStreaming, stopStreaming } from "./services/streaming.service";

async function bootstrap(): Promise<void> {
  const app = createApp();
  await connectRedis().catch(() => {});
  const server = createServer(app);

  startStreaming(server);
  server.listen(env.PORT, () => {
    process.stdout.write(`chart-service listening on ${env.PORT}\n`);
  });

  const stop = () => {
    void (async () => {
      stopStreaming();
      await closeRedis().catch(() => {});
      server.close(() => process.exit(0));
    })();
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

bootstrap().catch((error) => {
  process.stderr.write(`chart_service_bootstrap_failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
