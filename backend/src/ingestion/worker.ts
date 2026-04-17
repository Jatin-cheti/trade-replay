/**
 * ingestion/worker.ts — BullMQ worker that processes ingestion jobs.
 *
 * Dispatches each job to the appropriate source fetcher, upserts results
 * into MongoDB, and records progress via checkpoint.
 */
import { Worker, type Job } from "bullmq";
import { redisConnectionOptions } from "../config/redis";
import { SymbolModel } from "../models/Symbol";
import { logger } from "../utils/logger";
import { INGESTION_QUEUE_NAME, type IngestionJobData } from "./queue";
import {
  recordSourceResult,
  addError,
  setState,
  getProgress,
  setCheckpoint,
  getCheckpoint,
} from "./checkpoint";
import {
  fetchNasdaqTrader,
  fetchAlphaVantage,
  fetchSEC,
  fetchCoinGeckoPage,
  fetchCoinGeckoList,
  fetchBinance,
  fetchCoinbase,
  fetchKraken,
  fetchOKX,
  fetchBybit,
  fetchGateio,
  fetchKucoin,
  fetchMexc,
  fetchNSE,
  fetchBSE,
  generateForex,
  generateIndices,
  generateBondsEconomy,
  generateETFs,
  type RawSymbol,
} from "./sources";
import { buildCleanAssets } from "../services/cleanAsset.service";

/* ── Helpers ────────────────────────────────────────────────────────── */

async function upsertSymbols(rows: RawSymbol[]): Promise<{ fetched: number; newCount: number }> {
  if (rows.length === 0) return { fetched: 0, newCount: 0 };

  let newCount = 0;
  const BATCH = 1000;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const ops = slice.map((r) => ({
      updateOne: {
        filter: { fullSymbol: r.fullSymbol },
        update: {
          $setOnInsert: {
            symbol: r.symbol,
            fullSymbol: r.fullSymbol,
            name: r.name,
            exchange: r.exchange,
            country: r.country,
            type: r.type,
            currency: r.currency,
            source: r.source,
            iconUrl: r.iconUrl || "",
            priorityScore: r.priorityScore || 0,
            marketCap: r.marketCap || 0,
            volume: r.volume || 0,
          },
        },
        upsert: true,
      },
    }));

    const result = await SymbolModel.bulkWrite(ops, { ordered: false });
    newCount += result.upsertedCount;

    // Yield to event loop every batch
    await new Promise((resolve) => setImmediate(resolve));
  }

  return { fetched: rows.length, newCount };
}

/* ── Source dispatcher ──────────────────────────────────────────────── */

async function fetchSource(data: IngestionJobData): Promise<RawSymbol[]> {
  switch (data.source) {
    case "nasdaq-trader":
      return fetchNasdaqTrader();
    case "alpha-vantage":
      return fetchAlphaVantage();
    case "sec-edgar":
      return fetchSEC();
    case "coingecko-markets": {
      const page = data.page ?? 1;
      // Check if already completed (for resume)
      const cp = await getCheckpoint(`coingecko-markets:${page}`);
      if (cp > 0) {
        logger.info("ingestion_skip_checkpoint", { source: data.source, page });
        return [];
      }
      return fetchCoinGeckoPage(page);
    }
    case "coingecko-list":
      return fetchCoinGeckoList();
    case "binance":
      return fetchBinance();
    case "coinbase":
      return fetchCoinbase();
    case "kraken":
      return fetchKraken();
    case "okx":
      return fetchOKX();
    case "bybit":
      return fetchBybit();
    case "gateio":
      return fetchGateio();
    case "kucoin":
      return fetchKucoin();
    case "mexc":
      return fetchMexc();
    case "nse":
      return fetchNSE();
    case "bse":
      return fetchBSE();
    case "forex":
      return generateForex();
    case "indices":
      return generateIndices();
    case "bonds-economy":
      return generateBondsEconomy();
    case "etfs":
      return generateETFs();
    default:
      throw new Error(`Unknown source: ${data.source}`);
  }
}

/* ── Job processor ─────────────────────────────────────────────────── */

async function processJob(job: Job<IngestionJobData>): Promise<void> {
  const { source, page } = job.data;
  const label = page ? `${source}:p${page}` : source;

  logger.info("ingestion_job_start", { label, attempt: job.attemptsMade + 1 });

  try {
    const rows = await fetchSource(job.data);
    const { fetched, newCount } = await upsertSymbols(rows);

    // Record checkpoint for CoinGecko pages
    if (source === "coingecko-markets" && page) {
      await setCheckpoint(`coingecko-markets:${page}`, page);
    }

    await recordSourceResult(label, fetched, newCount, "done");
    logger.info("ingestion_job_done", { label, fetched, new: newCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await addError(`${label}: ${msg}`);
    await recordSourceResult(label, 0, 0, "failed");
    logger.error("ingestion_job_failed", { label, error: msg, attempt: job.attemptsMade + 1 });
    throw err; // Let BullMQ handle retry
  }
}

/* ── Completion handler ────────────────────────────────────────────── */

async function checkPipelineCompletion(): Promise<void> {
  const progress = await getProgress();
  const { totalJobs, completedJobs, failedJobs } = progress;

  if (completedJobs + failedJobs < totalJobs) return;

  logger.info("ingestion_all_jobs_settled", {
    completed: completedJobs,
    failed: failedJobs,
    total: totalJobs,
  });

  // Build gold layer
  try {
    await setState("building-gold");
    logger.info("ingestion_gold_layer_start");
    const goldResult = await buildCleanAssets();
    logger.info("ingestion_gold_layer_done", goldResult);
    await setState("complete");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await addError(`gold-layer: ${msg}`);
    await setState("failed");
    logger.error("ingestion_gold_layer_failed", { error: msg });
  }
}

/* ── Worker bootstrap ──────────────────────────────────────────────── */

let ingestionWorker: Worker | null = null;

export function startIngestionWorker(): Worker {
  if (ingestionWorker) return ingestionWorker;

  ingestionWorker = new Worker<IngestionJobData>(
    INGESTION_QUEUE_NAME,
    async (job) => processJob(job),
    {
      connection: redisConnectionOptions,
      concurrency: 3,
      limiter: {
        max: 5,
        duration: 1000,
      },
    },
  );

  ingestionWorker.on("completed", () => {
    void checkPipelineCompletion();
  });

  ingestionWorker.on("failed", (job, err) => {
    logger.warn("ingestion_worker_job_failed", {
      job: job?.name,
      error: err.message,
      attempts: job?.attemptsMade,
    });
    void checkPipelineCompletion();
  });

  ingestionWorker.on("error", (err) => {
    logger.error("ingestion_worker_error", { error: err.message });
  });

  logger.info("ingestion_worker_started", { concurrency: 3 });
  return ingestionWorker;
}

export function stopIngestionWorker(): void {
  if (ingestionWorker) {
    void ingestionWorker.close();
    ingestionWorker = null;
    logger.info("ingestion_worker_stopped");
  }
}
