import mongoose from "mongoose";
import { Queue } from "bullmq";
import { connectDB } from "../config/db";
import { connectRedis, redisConnectionOptions } from "../config/redis";
import { SymbolModel } from "../models/Symbol";
import { logger } from "../utils/logger";

const QUEUE_NAME = "logo-enrichment";
const JOB_NAME = "symbol-logo-enrichment";
const BATCH_SIZE = 400;
const QUEUE_HIGH_WATER = 2000;
const POLL_MS = 5000;
const MAX_STUCK_POLLS = 60;
const MAX_PASSES = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function getQueueDepth(queue: Queue): Promise<number> {
  const [w, a, d] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
  ]);
  return w + a + d;
}

async function countMapped(): Promise<number> {
  return SymbolModel.countDocuments({
    iconUrl: { $ne: "", $exists: true },
  });
}

function makeRunId(pass: number): string {
  return `${Date.now()}-p${pass}`;
}

async function enqueuePass(queue: Queue, totalAll: number, pass: number): Promise<number> {
  let enqueued = 0;
  let batchNum = 0;
  let lastId: mongoose.Types.ObjectId | null = null;
  const runId = makeRunId(pass);

  while (true) {
    let depth = await getQueueDepth(queue);
    while (depth > QUEUE_HIGH_WATER) {
      const nowWith = await countMapped();
      const cov = ((nowWith / totalAll) * 100).toFixed(2);
      console.log(`Pass ${pass}: Backpressure queue=${depth} > ${QUEUE_HIGH_WATER}. Coverage=${cov}%`);
      await sleep(POLL_MS);
      depth = await getQueueDepth(queue);
    }

    const conditions: mongoose.FilterQuery<unknown>[] = [
      { $or: [{ iconUrl: "" }, { iconUrl: { $exists: false } }] },
    ];

    if (lastId) {
      conditions.push({ _id: { $gt: lastId } });
    }

    const batch = await SymbolModel.find({ $and: conditions })
      .sort({ _id: 1 })
      .select("symbol fullSymbol name exchange type iconUrl s3Icon companyDomain country")
      .limit(BATCH_SIZE)
      .lean();

    if (batch.length === 0) break;

    lastId = batch[batch.length - 1]._id as mongoose.Types.ObjectId;

    const jobs = [] as Array<{ name: string; data: Record<string, unknown>; opts: { jobId: string } }>;
    for (let i = 0; i < batch.length; i += 1) {
      const sym = batch[i] as Record<string, unknown>;
      jobs.push({
        name: JOB_NAME,
        data: {
          symbol: (sym.symbol as string) || "",
          fullSymbol: (sym.fullSymbol as string) || "",
          name: (sym.name as string) || "",
          exchange: (sym.exchange as string) || "",
          type: (sym.type as string) || "stock",
          iconUrl: (sym.iconUrl as string) || "",
          s3Icon: (sym.s3Icon as string) || "",
          companyDomain: (sym.companyDomain as string) || "",
          createdAt: Date.now(),
        },
        opts: {
          jobId: `${((sym.fullSymbol as string) || "").replace(/[^a-zA-Z0-9._-]/g, "-")}__${runId}`,
        },
      });

      if ((i + 1) % 100 === 0) {
        await sleep(0);
      }
    }

    await queue.addBulk(jobs);
    enqueued += batch.length;
    batchNum += 1;
    console.log(`Pass ${pass}: batch ${batchNum} +${batch.length} (enqueued ${enqueued})`);
  }

  return enqueued;
}

async function waitForDrain(queue: Queue, totalAll: number, pass: number): Promise<void> {
  let stuckPolls = 0;
  let lastDepth = -1;

  while (true) {
    const depth = await getQueueDepth(queue);
    if (depth === 0) return;

    const nowWith = await countMapped();
    const cov = ((nowWith / totalAll) * 100).toFixed(2);
    console.log(`Pass ${pass}: queue=${depth}, coverage=${cov}%`);

    if (depth === lastDepth) {
      stuckPolls += 1;
      if (stuckPolls >= MAX_STUCK_POLLS) {
        console.log(`Pass ${pass}: Queue stuck at depth=${depth} for ${stuckPolls} polls. Forcing continue.`);
        return;
      }
    } else {
      stuckPolls = 0;
      lastDepth = depth;
    }

    await sleep(POLL_MS);
  }
}

async function main(): Promise<void> {
  logger.info("full_logo_sweep_start");
  await connectDB();
  await connectRedis();

  const queue = new Queue(QUEUE_NAME, {
    connection: redisConnectionOptions,
  });

  const totalAll = await SymbolModel.estimatedDocumentCount();
  let mapped = await countMapped();
  let remaining = totalAll - mapped;

  console.log("\n=== FULL LOGO SWEEP MULTI-PASS ===");
  console.log(`Total symbols: ${totalAll}`);
  console.log(`Initial mapped: ${mapped}`);
  console.log(`Initial remaining: ${remaining}`);

  if (remaining <= 0) {
    console.log("Already at 100% coverage.");
    await queue.close();
    await mongoose.connection.close();
    return;
  }

  let pass = 0;

  while (remaining > 0 && pass < MAX_PASSES) {
    pass += 1;
    console.log(`\n--- PASS ${pass} START ---`);

    const enqueued = await enqueuePass(queue, totalAll, pass);

    if (enqueued === 0) {
      console.log(`Pass ${pass}: Nothing to enqueue. Breaking.`);
      break;
    }

    console.log(`Pass ${pass}: enqueued=${enqueued}. Waiting for drain...`);
    await waitForDrain(queue, totalAll, pass);

    mapped = await countMapped();
    remaining = totalAll - mapped;
    const coverage = ((mapped / totalAll) * 100).toFixed(2);
    console.log(`Pass ${pass} DONE: mapped=${mapped}/${totalAll} (${coverage}%), remaining=${remaining}`);

    if (remaining <= 0) break;

    // Brief cooldown between passes
    console.log(`Pass ${pass}: ${remaining} remaining. Starting next pass in 3s...`);
    await sleep(3000);
  }

  mapped = await countMapped();
  remaining = totalAll - mapped;
  const finalCoverage = ((mapped / totalAll) * 100).toFixed(2);

  console.log("\n=== SWEEP COMPLETE ===");
  console.log(`Total symbols : ${totalAll}`);
  console.log(`Icons mapped  : ${mapped}`);
  console.log(`Still pending : ${remaining}`);
  console.log(`Coverage      : ${finalCoverage}%`);
  console.log(`Passes        : ${pass}`);
  console.log("======================\n");

  logger.info("full_logo_sweep_complete", {
    total: totalAll,
    resolved: mapped,
    pending: remaining,
    coverage: finalCoverage,
    passCount: pass,
  });

  await queue.close();
  await mongoose.connection.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error("full_logo_sweep_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });