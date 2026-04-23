import { createServer } from "node:http";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { connectKafka, shutdownKafka } from "./config/kafka";
import { connectRedis, disconnectRedis } from "./config/redis";
import { createApp } from "./app";

async function bootstrap(): Promise<void> {
  console.log(JSON.stringify({ message: "portfolio_service_bootstrap_start" }));

  await connectDB();
  await connectRedis();
  await connectKafka();

  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    console.log(JSON.stringify({
      message: "portfolio_service_started",
      port: env.PORT,
      kafkaEnabled: env.KAFKA_ENABLED,
    }));
  });

  const stop = async () => {
    console.log(JSON.stringify({ message: "portfolio_service_shutdown_start" }));
    await shutdownKafka();
    await disconnectRedis();

    server.close(() => {
      console.log(JSON.stringify({ message: "portfolio_service_shutdown_complete" }));
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}

bootstrap().catch((error) => {
  console.error(JSON.stringify({
    message: "portfolio_service_bootstrap_failed",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exit(1);
});
