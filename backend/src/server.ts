import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { env } from "./config/env";
import { createApp } from "./app";
import net from "node:net";
import { logger } from "./utils/logger";

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.close(() => resolve(true));
      })
      .listen(port);
  });
}

async function resolvePort(preferredPort: number): Promise<number> {
  const candidatePorts = Array.from({ length: 16 }, (_v, index) => preferredPort + index);

  for (const port of candidatePorts) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error("NO_AVAILABLE_PORT");
}

async function bootstrap() {
  logger.info("bootstrap_start");
  logger.info("bootstrap_connect_mongodb");
  await connectDB();
  logger.info("bootstrap_connect_redis");
  await connectRedis();
  logger.info("bootstrap_create_app");
  const { httpServer } = createApp();
  const listenPort = await resolvePort(env.PORT);

  if (listenPort !== env.PORT) {
    logger.warn("port_fallback", { requestedPort: env.PORT, selectedPort: listenPort });
  }

  httpServer.on("error", (error: unknown) => {
    logger.error("http_server_error", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  httpServer.listen(listenPort, () => {
    logger.info("backend_listening", { port: listenPort });
  });
}

bootstrap().catch((error) => {
  logger.error("bootstrap_failed", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
