import { Queue, Worker } from "bullmq";
import { redisConnectionOptions, redisClient, isRedisReady } from "../config/redis";
import { env } from "../config/env";
import { SymbolModel } from "../models/Symbol";
import { resolveLogo } from "./logoResolver.service";
import { uploadRemoteLogoToS3 } from "./s3.service";
import { emitLogoEnriched, emitLogoMapped } from "../config/kafka";

type QueueSymbol = {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  type: "stock" | "crypto" | "forex" | "index";
  iconUrl?: string;
  s3Icon?: string;
  companyDomain?: string;
  createdAt: number;
};

const LOGO_QUEUE_NAME = "logo-enrichment";
const LOGO_QUEUE_JOB = "symbol-logo-enrichment";
const SUMMARY_LOG_INTERVAL_MS = 30000;
const MAX_ATTEMPTS = 50;
const ATTEMPT_COOLDOWN_MS = 0;
const WORKER_CONCURRENCY = Math.max(1, env.LOGO_WORKER_CONCURRENCY || 20);

function domainFaviconUrl(domain: string): string {
  const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://www.google.com/s2/favicons?domain=${normalized}&sz=128`;
}

let processed = 0;
let resolved = 0;
let failed = 0;
let skipped = 0;
let totalQueueLatencyMs = 0;
let maxQueueLatencyMs = 0;

type ClaimedSymbol = {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  type: "stock" | "crypto" | "forex" | "index";
  companyDomain?: string;
  iconUrl?: string;
  s3Icon?: string;
};

async function claimAttempt(fullSymbol: string): Promise<ClaimedSymbol | null> {
  const now = Date.now();

  const claimed = await SymbolModel.findOneAndUpdate(
    {
      fullSymbol,
      $or: [{ iconUrl: { $exists: false } }, { iconUrl: "" }],
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
        iconUrl: 1,
        s3Icon: 1,
      },
      lean: true,
    },
  ).lean<ClaimedSymbol | null>();

  return claimed;
}

async function processJob(payload: QueueSymbol): Promise<void> {
  console.log(JSON.stringify({ message: "logo_job_processing", fullSymbol: payload.fullSymbol }));

  const queueLatencyMs = Math.max(0, Date.now() - payload.createdAt);
  totalQueueLatencyMs += queueLatencyMs;
  maxQueueLatencyMs = Math.max(maxQueueLatencyMs, queueLatencyMs);

  if (!isRedisReady()) {
    throw new Error("REDIS_NOT_READY");
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
    existingIconUrl: claimed.iconUrl,
    existingS3Icon: claimed.s3Icon,
  });

  if (!resolvedLogo.logoUrl) {
    console.log(JSON.stringify({ message: "logo_fetch_unresolved", fullSymbol: claimed.fullSymbol }));
    await SymbolModel.updateOne(
      { fullSymbol: claimed.fullSymbol },
      { $set: { logoStatus: "failed", logoLastUpdated: new Date() } },
    );
    failed += 1;
    return;
  }

  console.log(JSON.stringify({
    message: "logo_fetch_resolved",
    fullSymbol: claimed.fullSymbol,
    source: resolvedLogo.source,
    logoUrl: resolvedLogo.logoUrl,
  }));

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
        logoStatus: "mapped",
        logoLastUpdated: new Date(),
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

  await emitLogoMapped({
    fullSymbol: claimed.fullSymbol,
    symbol: claimed.symbol,
    logoUrl: finalIcon,
    s3Url: s3?.cdnUrl || "",
    source: resolvedLogo.source,
  });

  resolved += 1;
  console.log(JSON.stringify({ message: "logo_icon_updated", fullSymbol: claimed.fullSymbol, finalIcon }));
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
      avgQueueLatencyMs: processed > 0 ? Math.round(totalQueueLatencyMs / processed) : 0,
      maxQueueLatencyMs,
      processed,
      resolved,
      failed,
      skipped,
    }));
  }, SUMMARY_LOG_INTERVAL_MS).unref();

  return worker;
}
