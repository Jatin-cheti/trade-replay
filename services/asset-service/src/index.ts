import { env } from "./config/env.js";
import { connectDB } from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import { createApp } from "./app.js";

async function main() {
  await connectDB();
  await connectRedis();

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`[asset-service] listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("[asset-service] Fatal:", err);
  process.exit(1);
});
