import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { connectRedis } from "./config/redis";

async function bootstrap(): Promise<void> {
  const app = createApp();

  try {
    await connectRedis();
  } catch {
    // Continue with in-memory cache fallback.
  }

  const server = createServer(app);
  server.listen(env.PORT, () => {
    console.log(JSON.stringify({ message: "chart_service_started", port: env.PORT }));
  });

  const stop = () => {
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

bootstrap().catch((error) => {
  console.error(JSON.stringify({
    message: "chart_service_bootstrap_failed",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exit(1);
});
