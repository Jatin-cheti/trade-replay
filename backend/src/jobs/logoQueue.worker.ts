import { Job, Worker } from "bullmq";
import { redisQueueConnectionOptions } from "../config/redis";
import { SymbolModel } from "../models/Symbol";
import { resolveLogoForSymbol } from "../services/logo.service";
import { validateLogoImage } from "../services/logoAudit.service";
import { getLogoQueue } from "../services/logoQueue.service";
import { logger } from "../utils/logger";

const LOGO_QUEUE_NAME = "logo-enrichment";
const LOGO_QUEUE_JOB = "symbol-logo-enrichment";

type LogoQueueJob = {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange?: string;
  type?: string;
  country?: string;
  iconUrl?: string;
  s3Icon?: string;
  companyDomain?: string;
};

let logoQueueWorker: Worker<LogoQueueJob> | null = null;
let processedSymbols = 0;
let mappedSymbols = 0;
let manualReviewSymbols = 0;
let failedSymbols = 0;
const workerStartedAt = Date.now();

function avgTimePerSymbolMs(): number {
  if (processedSymbols <= 0) return 0;
  return (Date.now() - workerStartedAt) / processedSymbols;
}

function logProgress(queueDepth: number): void {
  if (processedSymbols === 0 || processedSymbols % 1000 !== 0) return;
  logger.info("logo_pipeline_progress", {
    processed: processedSymbols,
    mapped: mappedSymbols,
    needsReview: manualReviewSymbols,
    failed: failedSymbols,
    workersActive: "8/8",
    avgTimeMs: Number(avgTimePerSymbolMs().toFixed(1)),
    queueDepth,
  });

  if (processedSymbols % 10000 === 0) {
    const mappedPct = processedSymbols > 0 ? (mappedSymbols / processedSymbols) * 100 : 0;
    const reviewPct = processedSymbols > 0 ? (manualReviewSymbols / processedSymbols) * 100 : 0;
    const failedPct = processedSymbols > 0 ? (failedSymbols / processedSymbols) * 100 : 0;
    logger.info("logo_pipeline_summary_10k", {
      progress: `${processedSymbols}`,
      mapped: `${mappedSymbols} (${mappedPct.toFixed(1)}%)`,
      needsReview: `${manualReviewSymbols} (${reviewPct.toFixed(1)}%)`,
      failed: `${failedSymbols} (${failedPct.toFixed(1)}%)`,
      workers: "6/8",
      avgTimeMs: Number(avgTimePerSymbolMs().toFixed(1)),
      batchSaved: true,
    });
  }
}

async function processLogoQueueJob(job: Job<LogoQueueJob>): Promise<void> {
  if (job.name !== LOGO_QUEUE_JOB) return;

  const fullSymbol = String(job.data.fullSymbol || "").toUpperCase();
  if (!fullSymbol) return;

  const existing = await SymbolModel.findOne({ fullSymbol })
    .select({ symbol: 1, fullSymbol: 1, name: 1, exchange: 1, country: 1, type: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1 })
    .lean<{
      symbol?: string;
      fullSymbol?: string;
      name?: string;
      exchange?: string;
      country?: string;
      type?: string;
      iconUrl?: string;
      s3Icon?: string;
      companyDomain?: string;
    } | null>();

  if (!existing) return;
  if ((existing.iconUrl && existing.iconUrl.trim()) || (existing.s3Icon && existing.s3Icon.trim())) return;

  processedSymbols += 1;
  const mappingAttempts = 7;

  const resolved = await resolveLogoForSymbol({
    symbol: String(existing.symbol || job.data.symbol || "").toUpperCase(),
    fullSymbol,
    name: String(existing.name || job.data.name || existing.symbol || ""),
    exchange: String(existing.exchange || job.data.exchange || ""),
    companyDomain: existing.companyDomain || job.data.companyDomain,
    type: String(existing.type || job.data.type || "").toLowerCase(),
    country: String(existing.country || job.data.country || "GLOBAL").toUpperCase(),
    strategy: "normal",
  });

  if (!resolved.logoUrl) {
    await SymbolModel.updateOne(
      { fullSymbol },
      {
        $set: {
          logoStatus: "failed",
          logoLastUpdated: new Date(),
          iconUrl: "",
          logoSource: "",
          allSourcesTried: true,
          needsManualReview: true,
          mappingAttempts,
          domainUsed: resolved.domain || "",
          mappingConfidence: resolved.mappingConfidence || "low",
          validated: false,
          styleValidated: false,
        },
      },
    );
    failedSymbols += 1;
    const queueDepth = await getLogoQueue().getWaitingCount();
    logProgress(queueDepth);
    return;
  }

  let styleValidated = false;
  let validated = false;
  if (resolved.logoUrl.startsWith("http")) {
    const imageValidation = await validateLogoImage(resolved.logoUrl);
    styleValidated = imageValidation.isValid;
    validated = imageValidation.isValid;
  }

  const needsManualReview = Boolean(resolved.needsManualReview) || !validated;

  await SymbolModel.updateOne(
    { fullSymbol },
    {
      $set: {
        iconUrl: resolved.logoUrl,
        companyDomain: resolved.domain || existing.companyDomain || "",
        logoStatus: needsManualReview ? "pending" : "mapped",
        logoLastUpdated: new Date(),
        logoValidatedAt: new Date(),
        logoSource: resolved.source || "",
        allSourcesTried: Boolean(resolved.allSourcesTried),
        needsManualReview,
        mappingAttempts,
        domainUsed: resolved.domain || existing.companyDomain || "",
        mappingConfidence: resolved.mappingConfidence || "medium",
        lastMappedAt: new Date(),
        validated,
        styleValidated,
      },
    },
  );

  if (needsManualReview) {
    manualReviewSymbols += 1;
  } else {
    mappedSymbols += 1;
  }

  const queueDepth = await getLogoQueue().getWaitingCount();
  logProgress(queueDepth);
}

export function startLogoQueueWorker(): Worker<LogoQueueJob> {
  if (logoQueueWorker) return logoQueueWorker;

  logoQueueWorker = new Worker<LogoQueueJob>(
    LOGO_QUEUE_NAME,
    async (job) => processLogoQueueJob(job),
    {
      connection: redisQueueConnectionOptions,
      concurrency: 8,
      limiter: {
        max: 20,
        duration: 1000,
      },
    },
  );

  logoQueueWorker.on("completed", (_job) => {
    // completed event — no action needed
  });

  logoQueueWorker.on("failed", (job, err) => {
    logger.warn("logo_queue_job_failed", {
      fullSymbol: job?.data?.fullSymbol,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  logoQueueWorker.on("error", (err) => {
    logger.error("logo_queue_worker_error", { error: err.message });
  });

  logger.info("logo_queue_worker_started", { queue: LOGO_QUEUE_NAME, concurrency: 8 });
  return logoQueueWorker;
}

export function stopLogoQueueWorker(): void {
  if (!logoQueueWorker) return;
  void logoQueueWorker.close();
  logoQueueWorker = null;
  logger.info("logo_queue_worker_stopped", { queue: LOGO_QUEUE_NAME });
}
