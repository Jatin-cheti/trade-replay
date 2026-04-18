import http from "node:http";
import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { env } from "./config/env";
import { CONFIG } from "./config/index";
import { connectKafkaProducer, shutdownKafka } from "./config/kafka";
import { startLogoWorker } from "./services/logoWorker.service";

const HEALTH_PORT = Number(process.env.HEALTH_PORT) || 3003;

async function bootstrap(): Promise<void> {
  console.log(JSON.stringify({ message: "logo_service_bootstrap_start" }));
  console.log("CONFIG CHECK", {
    env: process.env.APP_ENV,
    redis: CONFIG.redisUrl,
    kafka: CONFIG.kafkaBroker,
    mongo: process.env.MONGO_URI,
  });
  console.log(JSON.stringify({ message: "logo_service_redis_url_config", url: env.REDIS_URL }));

  await connectDB();
  await connectRedis();
  await connectKafkaProducer();

  const worker = startLogoWorker();

  // Health endpoint for service discovery
  http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "logo-service" }));
  }).listen(HEALTH_PORT, () => {
    console.log(JSON.stringify({ message: "logo_service_health_endpoint", port: HEALTH_PORT }));
  });

  const stop = async () => {
    console.log(JSON.stringify({ message: "logo_service_shutdown_start" }));
    await worker.close();
    await shutdownKafka();
    process.exit(0);
  };

  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());

  console.log(JSON.stringify({ message: "logo_service_started" }));
}

bootstrap().catch((error) => {
  console.error(JSON.stringify({
    message: "logo_service_bootstrap_failed",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exit(1);
});
