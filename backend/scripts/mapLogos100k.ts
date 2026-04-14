/**
 * 100K Logo Mapping Pipeline
 *
 * Processes symbols in batches from clean_assets (gold layer),
 * queues them to the logo-enrichment BullMQ queue,
 * and tracks progress with checkpointing.
 *
 * Usage: cd backend && npx tsx scripts/mapLogos100k.ts
 */

import mongoose from "mongoose";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.secrets") });

// ── Config ──────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tradereplay";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const BATCH_SIZE = 100;
const QUEUE_MAX_DEPTH = 2000;
const QUEUE_FILL_TARGET = 500; // refill when queue drops below this
const TARGET_LOGOS = 100_000;
const LOGO_QUEUE_NAME = "logo-enrichment";
const LOGO_QUEUE_JOB = "symbol-logo-enrichment";
const PROGRESS_INTERVAL_MS = 10_000;
const PAUSE_BETWEEN_BATCHES_MS = 200;

// ── MongoDB Schema (inline to avoid import issues) ──────
const symbolSchema = new mongoose.Schema(
  {
    symbol: String,
    fullSymbol: { type: String, unique: true },
    name: String,
    exchange: String,
    country: String,
    type: String,
    currency: String,
    iconUrl: { type: String, default: "" },
    s3Icon: { type: String, default: "" },
    companyDomain: { type: String, default: "" },
    logoStatus: { type: String, enum: ["pending", "mapped", "failed"], default: "pending" },
    logoLastUpdated: Date,
    logoValidatedAt: Date,
    logoAttempts: { type: Number, default: 0 },
    lastLogoAttemptAt: Number,
    popularity: { type: Number, default: 0 },
    searchFrequency: { type: Number, default: 0 },
    priorityScore: { type: Number, default: 0 },
    marketCap: { type: Number, default: 0 },
    volume: { type: Number, default: 0 },
    source: String,
    isSynthetic: Boolean,
    baseSymbol: String,
  },
  { timestamps: true },
);
const SymbolModel = mongoose.models.Symbol || mongoose.model("Symbol", symbolSchema);

// ── Helpers ─────────────────────────────────────────────
function safeJobId(fullSymbol: string): string {
  return fullSymbol.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function toQueueType(type: string): "stock" | "crypto" | "forex" | "index" {
  if (type === "crypto") return "crypto";
  if (type === "forex") return "forex";
  if (type === "index") return "index";
  return "stock";
}

// ── Main Pipeline ───────────────────────────────────────
async function main() {
  console.log("=== 100K Logo Mapping Pipeline ===");
  console.log(`Target: ${TARGET_LOGOS.toLocaleString()} logos`);
  console.log(`Mongo: ${MONGO_URI}`);
  console.log(`Redis: ${REDIS_URL}`);

  // Connect
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");

  const redis = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(LOGO_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 5000,
      removeOnFail: 5000,
    },
  });

  // Get current counts
  const totalSymbols = await SymbolModel.countDocuments({
    type: { $in: ["stock", "etf", "crypto", "forex", "index", "bond", "economy"] },
  });
  const alreadyMapped = await SymbolModel.countDocuments({
    $or: [
      { logoStatus: "mapped" },
      { iconUrl: { $ne: "" }, iconUrl: { $exists: true } },
    ],
  });
  const alreadyFailed = await SymbolModel.countDocuments({ logoStatus: "failed" });

  console.log(`\nTotal symbols: ${totalSymbols.toLocaleString()}`);
  console.log(`Already mapped: ${alreadyMapped.toLocaleString()}`);
  console.log(`Already failed: ${alreadyFailed.toLocaleString()}`);
  console.log(`Remaining to process: ${Math.max(0, TARGET_LOGOS - alreadyMapped).toLocaleString()}`);

  // First: mark all symbols that already have iconUrl as "mapped"
  console.log("\nBackfilling logoStatus for symbols with existing icons...");
  const backfillResult = await SymbolModel.updateMany(
    {
      iconUrl: { $ne: "", $exists: true },
      $or: [{ logoStatus: { $exists: false } }, { logoStatus: "pending" }],
    },
    {
      $set: { logoStatus: "mapped", logoLastUpdated: new Date() },
    },
  );
  console.log(`Backfilled ${backfillResult.modifiedCount} symbols as 'mapped'`);

  // Recount after backfill
  const mappedCount = await SymbolModel.countDocuments({ logoStatus: "mapped" });
  console.log(`Mapped after backfill: ${mappedCount.toLocaleString()}`);

  if (mappedCount >= TARGET_LOGOS) {
    console.log(`\n✅ Already at ${mappedCount.toLocaleString()} logos — target reached!`);
    await cleanup(queue, redis);
    return;
  }

  // Process symbols that need logos, ordered by priority
  let enqueued = 0;
  let batches = 0;
  let lastLogTime = Date.now();
  const startTime = Date.now();

  const filter = {
    type: { $in: ["stock", "etf", "crypto", "forex", "index", "bond", "economy"] },
    $or: [
      { logoStatus: "pending" },
      { logoStatus: { $exists: false } },
    ],
    // Skip derivatives and synthetics
    isSynthetic: { $ne: true },
  };

  const totalPending = await SymbolModel.countDocuments(filter);
  console.log(`\nPending symbols to process: ${totalPending.toLocaleString()}`);

  const cursor = SymbolModel.find(filter)
    .select({
      symbol: 1, fullSymbol: 1, name: 1, exchange: 1,
      type: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1,
      priorityScore: 1, searchFrequency: 1, marketCap: 1,
    })
    .sort({ priorityScore: -1 })
    .lean()
    .cursor({ batchSize: BATCH_SIZE });

  let batch: Array<{
    name: string;
    data: Record<string, unknown>;
    opts: { jobId: string; priority: number };
  }> = [];

  for await (const doc of cursor) {
    // Skip if already has icon
    if (doc.iconUrl && String(doc.iconUrl).trim()) continue;

    batch.push({
      name: LOGO_QUEUE_JOB,
      data: {
        symbol: doc.symbol,
        fullSymbol: doc.fullSymbol,
        name: doc.name,
        exchange: doc.exchange,
        type: toQueueType(doc.type),
        iconUrl: doc.iconUrl || "",
        s3Icon: doc.s3Icon || "",
        companyDomain: doc.companyDomain || "",
        createdAt: Date.now(),
      },
      opts: {
        jobId: safeJobId(doc.fullSymbol),
        priority: Math.max(1, (doc.priorityScore ?? 0) + (doc.searchFrequency ?? 0)),
      },
    });

    if (batch.length >= BATCH_SIZE) {
      // Wait if queue is too full
      let queueDepth = await getQueueDepth(queue);
      while (queueDepth > QUEUE_MAX_DEPTH) {
        if (Date.now() - lastLogTime > PROGRESS_INTERVAL_MS) {
          const currentMapped = await SymbolModel.countDocuments({ logoStatus: "mapped" });
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          console.log(`[${elapsed}s] Queue full (${queueDepth}), waiting... | Enqueued: ${enqueued} | Mapped: ${currentMapped.toLocaleString()}`);
          lastLogTime = Date.now();
        }
        await sleep(1000);
        queueDepth = await getQueueDepth(queue);
      }

      await queue.addBulk(batch);
      enqueued += batch.length;
      batches++;
      batch = [];

      // Progress log
      if (Date.now() - lastLogTime > PROGRESS_INTERVAL_MS) {
        const currentMapped = await SymbolModel.countDocuments({ logoStatus: "mapped" });
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        const rate = (enqueued / (Date.now() - startTime) * 1000).toFixed(1);
        console.log(`[${elapsed}s] Enqueued: ${enqueued.toLocaleString()} | Batches: ${batches} | Queue: ${await getQueueDepth(queue)} | Mapped: ${currentMapped.toLocaleString()} | Rate: ${rate}/s`);
        lastLogTime = Date.now();

        if (currentMapped >= TARGET_LOGOS) {
          console.log(`\n✅ Target reached: ${currentMapped.toLocaleString()} logos mapped!`);
          break;
        }
      }

      // Yield to event loop
      await sleep(PAUSE_BETWEEN_BATCHES_MS);
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await queue.addBulk(batch);
    enqueued += batch.length;
    batches++;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Enqueuing Complete ===`);
  console.log(`Total enqueued: ${enqueued.toLocaleString()}`);
  console.log(`Batches: ${batches}`);
  console.log(`Time: ${elapsed}s`);

  // Wait for queue to drain
  console.log("\nWaiting for logo-service worker to process queue...");
  let lastMapped = 0;
  let stallCount = 0;
  while (true) {
    const depth = await getQueueDepth(queue);
    const currentMapped = await SymbolModel.countDocuments({ logoStatus: "mapped" });
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`[${elapsedSec}s] Queue: ${depth} | Mapped: ${currentMapped.toLocaleString()}/${TARGET_LOGOS.toLocaleString()}`);

    if (currentMapped >= TARGET_LOGOS) {
      console.log(`\n✅ TARGET REACHED: ${currentMapped.toLocaleString()} logos mapped!`);
      break;
    }

    if (depth === 0) {
      console.log("\nQueue empty. Checking if more symbols need processing...");
      const remaining = await SymbolModel.countDocuments({
        type: { $in: ["stock", "etf", "crypto", "forex", "index", "bond", "economy"] },
        logoStatus: "pending",
        isSynthetic: { $ne: true },
      });
      if (remaining === 0) {
        console.log("No more pending symbols.");
        break;
      }
      console.log(`${remaining.toLocaleString()} pending — but queue is empty (worker may be slow).`);
    }

    // Detect stalls
    if (currentMapped === lastMapped) {
      stallCount++;
      if (stallCount > 30) { // 5 minutes with no progress
        console.log("\n⚠️ Stall detected — no progress for 5 minutes. Exiting.");
        break;
      }
    } else {
      stallCount = 0;
    }
    lastMapped = currentMapped;

    await sleep(10_000);
  }

  // Final stats
  const finalMapped = await SymbolModel.countDocuments({ logoStatus: "mapped" });
  const finalFailed = await SymbolModel.countDocuments({ logoStatus: "failed" });
  const finalPending = await SymbolModel.countDocuments({ logoStatus: "pending" });
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n=== Final Stats ===");
  console.log(`Mapped:  ${finalMapped.toLocaleString()}`);
  console.log(`Failed:  ${finalFailed.toLocaleString()}`);
  console.log(`Pending: ${finalPending.toLocaleString()}`);
  console.log(`Total time: ${totalElapsed}s`);

  await cleanup(queue, redis);
}

async function getQueueDepth(queue: Queue): Promise<number> {
  const [waiting, active, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
  ]);
  return waiting + active + delayed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanup(queue: Queue, redis: IORedis) {
  await queue.close();
  redis.disconnect();
  await mongoose.disconnect();
  console.log("Cleanup done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
