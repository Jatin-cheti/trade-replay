import { Queue, Worker } from "bullmq";
import { redisConnectionOptions, redisClient, isRedisReady } from "../config/redis";
import { SymbolModel } from "../models/Symbol";
import { resolveLogo } from "./logoResolver.service";
import { uploadRemoteLogoToS3 } from "./s3.service";
import { emitLogoEnriched } from "../config/kafka";

type QueueSymbol = {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  type: "stock" | "crypto" | "forex" | "index";
  iconUrl?: string;
  s3Icon?: string;
  companyDomain?: string;
};

const LOGO_QUEUE_NAME = "logo-enrichment";
const LOGO_QUEUE_JOB = "symbol-logo-enrichment";
const SUMMARY_LOG_INTERVAL_MS = 30000;
const MAX_ATTEMPTS = 3;
const ATTEMPT_COOLDOWN_MS = 60 * 60 * 1000;
const WORKER_CONCURRENCY = 20;

let processed = 0;
let resolved = 0;
let failed = 0;
let skipped = 0;

type ClaimedSymbol = {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  type: "stock" | "crypto" | "forex" | "index";
  companyDomain?: string;
};

async function claimAttempt(fullSymbol: string): Promise<ClaimedSymbol | null> {
  const now = Date.now();
  const cooldownCutoff = now - ATTEMPT_COOLDOWN_MS;

  const claimed = await SymbolModel.findOneAndUpdate(
    {
      fullSymbol,
      $and: [
        {
          $or: [{ iconUrl: { $exists: false } }, { iconUrl: "" }],
        },
        {
          $or: [{ s3Icon: { $exists: false } }, { s3Icon: "" }],
        },
        {
          $or: [{ logoAttempts: { $exists: false } }, { logoAttempts: { $lt: MAX_ATTEMPTS } }],
        },
        {
          $or: [{ lastLogoAttemptAt: { $exists: false } }, { lastLogoAttemptAt: { $lt: cooldownCutoff } }],
        },
      ],
    },
    {
      $inc: { logoAttempts: 1 },
      $set: { lastLogoAttemptAt: now },
    },
    {
      new: true,
      projection: {
        symbol: 1,
        fullSymbol: 1,
        name: 1,
        exchange: 1,
        type: 1,
        companyDomain: 1,
      },
      lean: true,
    },
  ).lean<ClaimedSymbol | null>();

  return claimed;
}

async function processJob(payload: QueueSymbol): Promise<void> {
  if (!isRedisReady()) {
    throw new Error("REDIS_NOT_READY");
  }

  const dedupe = await redisClient.set(
    `app:dedupe:logo-worker:${payload.fullSymbol}`,
    "1",
    "EX",
    60,
    "NX",
  );
  if (dedupe !== "OK") {
    skipped += 1;
    return;
  }

  const claimed = await claimAttempt(payload.fullSymbol.toUpperCase());
  if (!claimed) {
    skipped += 1;
    return;
  }

  const resolvedLogo = await resolveLogo({
    symbol: claimed.symbol,
    name: claimed.name,
    exchange: claimed.exchange,
    type: claimed.type,
    companyDomain: claimed.companyDomain,
  });

  if (!resolvedLogo.logoUrl) {
    failed += 1;
    return;
  }

  let s3 = null;
  try {
    s3 = await uploadRemoteLogoToS3(claimed.fullSymbol, resolvedLogo.logoUrl);
  } catch {
    s3 = null;
  }

  const finalIcon = s3?.cdnUrl || resolvedLogo.logoUrl;

  await SymbolModel.updateOne(
    { fullSymbol: claimed.fullSymbol },
    {
      $set: {
        iconUrl: finalIcon,
        s3Icon: s3?.cdnUrl || "",
        companyDomain: resolvedLogo.domain || claimed.companyDomain || "",
        logoValidatedAt: new Date(),
      },
    },
  );

  await emitLogoEnriched({
    fullSymbol: claimed.fullSymbol,
    symbol: claimed.symbol,
    logoUrl: finalIcon,
    source: s3 ? "cdn" : "remote",
    domain: resolvedLogo.domain || undefined,
  });

  resolved += 1;
}

export function getLogoQueue() {
  return new Queue<QueueSymbol>(LOGO_QUEUE_NAME, {
    connection: redisConnectionOptions,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 5000,
      removeOnFail: 5000,
    },
  });
}

export function startLogoWorker(): Worker<QueueSymbol> {
  const worker = new Worker<QueueSymbol>(
    LOGO_QUEUE_NAME,
    async (job) => {
      await processJob(job.data);
      processed += 1;
    },
    {
      connection: redisConnectionOptions,
      concurrency: WORKER_CONCURRENCY,
    },
  );

  worker.on("ready", async () => {
    const queue = getLogoQueue();
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    console.log(JSON.stringify({ message: "logo_service_worker_ready", waiting, active, concurrency: WORKER_CONCURRENCY }));
  });

  worker.on("failed", () => {
    failed += 1;
  });

  setInterval(async () => {
    const queue = getLogoQueue();
    const waiting = await queue.getWaitingCount();
    const delayed = await queue.getDelayedCount();
    const active = await queue.getActiveCount();

    console.log(JSON.stringify({
      message: "logo_service_queue_metrics",
      queueSize: waiting + delayed,
      activeJobs: active,
      processed,
      resolved,
      failed,
      skipped,
    }));
  }, SUMMARY_LOG_INTERVAL_MS).unref();

  return worker;
}
