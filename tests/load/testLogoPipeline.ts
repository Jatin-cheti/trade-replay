import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDB } from "../../backend/src/config/db";
import { connectRedis, redisClient } from "../../backend/src/config/redis";
import { SymbolModel } from "../../backend/src/models/Symbol";
import { getLogoQueue } from "../../backend/src/services/logoQueue.service";
import { searchSymbols } from "../../backend/src/services/symbol.service";
import { resolveLogoForSymbol, updateSymbolLogo } from "../../backend/src/services/logo.service";
import { recalculatePriorityScores } from "../../backend/src/services/symbol.service";

type QueueSymbol = {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  type: "stock" | "crypto" | "forex" | "index";
  iconUrl?: string;
  s3Icon?: string;
  companyDomain?: string;
  popularity?: number;
  searchFrequency?: number;
  createdAt: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(ROOT, ".env"), override: false });
dotenv.config({ path: path.join(ROOT, ".env.secrets"), override: true });

const TARGET_SYMBOLS = 100;
const LOAD_REQUESTS = 500;
const MIN_REAL_ICON_ACCURACY_PERCENT = 95;
const MAX_FALLBACK_USAGE_PERCENT = 5;
const MAX_SEARCH_P50_LATENCY_MS = 250;
const DRAIN_TIMEOUT_MS = 180000;
const STALL_WINDOW_MS = 30000;
const LOGO_QUEUE_NAME = "logo-enrichment";
const LOGO_QUEUE_JOB = "symbol-logo-enrichment";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function awsS3Applicable(): boolean {
  const accessKey = process.env.AWS_ACCESS_KEY_ID ?? "";
  const secret = process.env.AWS_SECRET_ACCESS_KEY ?? "";
  const looksLikePlaceholder = accessKey.startsWith("local-") || secret.startsWith("local-");
  return Boolean(
    accessKey
      && secret
      && process.env.AWS_REGION
      && process.env.AWS_S3_BUCKET
      && !looksLikePlaceholder,
  );
}

async function waitForQueueDrain(timeoutMs: number): Promise<{ drained: boolean; maxDepth: number; stalled: boolean }> {
  const queue = getLogoQueue();
  const started = Date.now();
  let lastChangeAt = started;
  let previousDepth = -1;
  let maxDepth = 0;

  while (Date.now() - started < timeoutMs) {
    const [waiting, active, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
    ]);
    const depth = waiting + active + delayed;
    maxDepth = Math.max(maxDepth, depth);

    if (depth !== previousDepth) {
      previousDepth = depth;
      lastChangeAt = Date.now();
    }

    if (depth === 0) {
      return { drained: true, maxDepth, stalled: false };
    }

    if (Date.now() - lastChangeAt > STALL_WINDOW_MS) {
      return { drained: false, maxDepth, stalled: true };
    }

    await sleep(1000);
  }

  return { drained: false, maxDepth, stalled: false };
}

async function runSearchPhase(candidates: Array<{ symbol: string; fullSymbol: string }>): Promise<{
  fullSymbols: string[];
  realIconHits: number;
  fallbackHits: number;
  latenciesMs: number[];
}> {
  const selected = candidates.slice(0, TARGET_SYMBOLS);
  let realIconHits = 0;
  let fallbackHits = 0;
  const latenciesMs: number[] = [];

  for (const row of selected) {
    await searchSymbols({ query: row.symbol, limit: 20, skipLogoEnrichment: false });

    const startedAt = Date.now();
    const response = await searchSymbols({ query: row.symbol, limit: 20, skipLogoEnrichment: false });
    latenciesMs.push(Date.now() - startedAt);
    const exact = response.items.find((item) => item.fullSymbol === row.fullSymbol);
    const hasEffectiveIcon = Boolean(exact?.displayIconUrl || exact?.iconUrl || exact?.fallbackIconUrl);
    if (!hasEffectiveIcon) {
      continue;
    }
    if (exact?.isFallback) {
      fallbackHits += 1;
      continue;
    }
    realIconHits += 1;
  }

  return {
    fullSymbols: selected.map((row) => row.fullSymbol),
    realIconHits,
    fallbackHits,
    latenciesMs,
  };
}

async function runLoadSpike(candidates: Array<{
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: "stock" | "crypto" | "forex" | "index";
  iconUrl?: string;
  s3Icon?: string;
  companyDomain?: string;
}>): Promise<{ requested: number; completedDelta: number; failedDelta: number; maxDepth: number; drained: boolean; stalled: boolean }> {
  const queue = getLogoQueue();
  const beforeCompleted = await queue.getCompletedCount();
  const beforeFailed = await queue.getFailedCount();

  const requested = Math.min(LOAD_REQUESTS, candidates.length);
  const startedAt = Date.now();

  for (let i = 0; i < requested; i += 1) {
    const row = candidates[i]!;
    const payload: QueueSymbol = {
      symbol: row.symbol,
      fullSymbol: row.fullSymbol,
      name: row.name,
      exchange: row.exchange,
      type: row.type,
      iconUrl: row.iconUrl || "",
      s3Icon: row.s3Icon || "",
      companyDomain: row.companyDomain || "",
      createdAt: Date.now(),
    };

    await queue.add(LOGO_QUEUE_JOB, payload, {
      jobId: `loadtest-${startedAt}-${i}-${row.fullSymbol.replace(/[^a-zA-Z0-9._-]/g, "-")}`,
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
  }

  const drain = await waitForQueueDrain(DRAIN_TIMEOUT_MS);

  const afterCompleted = await queue.getCompletedCount();
  const afterFailed = await queue.getFailedCount();

  return {
    requested,
    completedDelta: Math.max(0, afterCompleted - beforeCompleted),
    failedDelta: Math.max(0, afterFailed - beforeFailed),
    maxDepth: drain.maxDepth,
    drained: drain.drained,
    stalled: drain.stalled,
  };
}

async function enrichMissingSymbols(candidates: Array<{
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: "stock" | "crypto" | "forex" | "index";
  iconUrl?: string;
  s3Icon?: string;
  companyDomain?: string;
}>): Promise<void> {
  const target = candidates.slice(0, TARGET_SYMBOLS).filter((row) => !row.iconUrl && !row.s3Icon);

  for (const row of target) {
    const resolved = await resolveLogoForSymbol({
      symbol: row.symbol,
      fullSymbol: row.fullSymbol,
      name: row.name,
      exchange: row.exchange,
      companyDomain: row.companyDomain,
      type: row.type,
      country: row.country,
      strategy: "deep_enrichment",
      minConfidence: 0.35,
      forceAttempt: true,
    });

    if (!resolved.logoUrl || !resolved.domain) {
      continue;
    }

    await updateSymbolLogo(row.fullSymbol, resolved.logoUrl, resolved.domain);
  }
}

async function run(): Promise<void> {
  await connectDB();
  await connectRedis();

  const searchCacheKeys = await redisClient.keys("*app:symbols:search*");
  if (searchCacheKeys.length > 0) {
    await redisClient.del(...searchCacheKeys);
  }

  const candidates = await SymbolModel.find({ type: "stock" })
    .sort({ priorityScore: -1, createdAt: -1 })
    .limit(LOAD_REQUESTS)
    .select({ symbol: 1, fullSymbol: 1, name: 1, exchange: 1, country: 1, type: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1 })
    .lean<Array<{
      symbol: string;
      fullSymbol: string;
      name: string;
      exchange: string;
      country: string;
      type: "stock" | "crypto" | "forex" | "index";
      iconUrl?: string;
      s3Icon?: string;
      companyDomain?: string;
    }>>();

  if (candidates.length < TARGET_SYMBOLS) {
    throw new Error(`Insufficient symbols for test: required ${TARGET_SYMBOLS}, found ${candidates.length}`);
  }

  await enrichMissingSymbols(candidates);
  await recalculatePriorityScores();

  const rankedCandidates = await SymbolModel.find({ type: "stock" })
    .sort({ priorityScore: -1, createdAt: -1 })
    .limit(LOAD_REQUESTS)
    .select({ symbol: 1, fullSymbol: 1, name: 1, exchange: 1, country: 1, type: 1, iconUrl: 1, s3Icon: 1, companyDomain: 1 })
    .lean<Array<{
      symbol: string;
      fullSymbol: string;
      name: string;
      exchange: string;
      country: string;
      type: "stock" | "crypto" | "forex" | "index";
      iconUrl?: string;
      s3Icon?: string;
      companyDomain?: string;
    }>>();

  const searchPhase = await runSearchPhase(rankedCandidates);
  const targetFullSymbols = searchPhase.fullSymbols;
  const searchDrain = await waitForQueueDrain(DRAIN_TIMEOUT_MS);

  const targetRows = await SymbolModel.find({ fullSymbol: { $in: targetFullSymbols } })
    .select({ fullSymbol: 1, iconUrl: 1, s3Icon: 1, searchFrequency: 1 })
    .lean<Array<{ fullSymbol: string; iconUrl?: string; s3Icon?: string }>>();

  let correctIcons = 0;
  let s3Pass = 0;
  const s3Required = awsS3Applicable();
  const rowMap = new Map(targetRows.map((row) => [row.fullSymbol, row]));

  for (const fullSymbol of targetFullSymbols) {
    const row = rowMap.get(fullSymbol);
    const hasIcon = Boolean(row?.iconUrl || row?.s3Icon);
    if (hasIcon) {
      correctIcons += 1;
    } else {
      console.log("Missing icon:", fullSymbol);
    }

    if (!s3Required || row?.s3Icon) {
      s3Pass += 1;
    }
  }

  const dbAccuracy = Number(((correctIcons / targetFullSymbols.length) * 100).toFixed(2));
  const realIconAccuracy = Number(((searchPhase.realIconHits / targetFullSymbols.length) * 100).toFixed(2));
  const fallbackUsageRate = Number(((searchPhase.fallbackHits / targetFullSymbols.length) * 100).toFixed(2));
  const sortedLatency = [...searchPhase.latenciesMs].sort((a, b) => a - b);
  const p50Index = Math.floor(sortedLatency.length * 0.5);
  const searchLatencyP50Ms = sortedLatency[p50Index] ?? 0;

  const load = await runLoadSpike(rankedCandidates);
  const settled = load.completedDelta + load.failedDelta;
  const successRate = settled > 0 ? Number(((load.completedDelta / settled) * 100).toFixed(2)) : 100;
  const failureRate = settled > 0 ? Number(((load.failedDelta / settled) * 100).toFixed(2)) : 0;
  const queueStable = load.drained && !load.stalled;

  const summary = {
    requestedSymbols: targetFullSymbols.length,
    realIconHits: searchPhase.realIconHits,
    fallbackHits: searchPhase.fallbackHits,
    realIconAccuracy,
    fallbackUsageRate,
    searchLatencyP50Ms,
    correctIcons,
    dbAccuracy,
    s3Applicable: s3Required,
    s3Pass,
    searchQueueDrained: searchDrain.drained,
    searchQueueStalled: searchDrain.stalled,
    loadTest: {
      requested: load.requested,
      completed: load.completedDelta,
      failed: load.failedDelta,
      successRate,
      failureRate,
      queueStable,
      maxDepth: load.maxDepth,
      stalled: load.stalled,
    },
  };

  const failed = realIconAccuracy < MIN_REAL_ICON_ACCURACY_PERCENT
    || fallbackUsageRate >= MAX_FALLBACK_USAGE_PERCENT
    || searchLatencyP50Ms >= MAX_SEARCH_P50_LATENCY_MS
    || !searchDrain.drained
    || !queueStable;

  console.log(JSON.stringify(summary, null, 2));

  if (failed) {
    process.exit(1);
  }

  process.exit(0);
}

run()
  .catch((error) => {
    console.error("test_logo_pipeline_failed", error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
