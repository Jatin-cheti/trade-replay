import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { connectKafkaProducer, shutdownKafka } from "./config/kafka";
import { startLogoWorker } from "./services/logoWorker.service";

async function bootstrap(): Promise<void> {
  console.log(JSON.stringify({ message: "logo_service_bootstrap_start" }));

  await connectDB();
  await connectRedis();
  await connectKafkaProducer();

  const worker = startLogoWorker();

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
