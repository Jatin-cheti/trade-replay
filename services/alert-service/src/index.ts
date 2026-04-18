import { env } from "./config/env.js";
import { connectDB } from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import { bootstrapAlerts } from "./services/alerts.service.js";
import { createApp } from "./app.js";

async function main() {
  await connectDB();
  await connectRedis();
  await bootstrapAlerts();
  const app = createApp();
  app.listen(env.PORT, () => console.log(`[alert-service] listening on :${env.PORT}`));
}

main().catch((err) => { console.error("[alert-service] Fatal:", err); process.exit(1); });
