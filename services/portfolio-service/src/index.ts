import { env } from "./config/env.js";
import { connectDB } from "./config/database.js";
import { createApp } from "./app.js";

async function main() {
  await connectDB();
  const app = createApp();
  app.listen(env.PORT, () => console.log(`[portfolio-service] listening on :${env.PORT}`));
}

main().catch((err) => { console.error("[portfolio-service] Fatal:", err); process.exit(1); });
