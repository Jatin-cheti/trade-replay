import { env } from "../config/env";
import {
  type MissingLogoWorkItem,
  getMissingLogosBatch,
  repopulateMissingLogos,
  reopenFalseResolvedItems,
  resetUnresolvedToPending,
} from "../services/missingLogo.service";
import { computeFallbackRatio } from "../services/logoValidation.service";
import { logger } from "../utils/logger";
import { getFailureStatsSnapshot, resetDiagnosticsWindow, FailureReason } from "../services/diagnostics.service";
import { processWithWorkerPool } from "../services/workerManager.service";
import { inferDomainWithConfidence } from "../services/domainConfidence.service";
import { classifySymbol } from "../services/symbolClassifier.service";
import { isRedisReady, redisClient } from "../config/redis";
import { clusterScopedKey } from "../services/redisKey.service";
import { eliminateTail } from "../services/tailElimination.service";
import { resolveCluster } from "../services/clusterCache.service";
import { getCostMetrics } from "../services/costGuardrails.service";
import { detectStagnation } from "../services/adaptiveRetry.service";

const BASE_PER_WORKER_BATCH_SIZE = 50;
const BASE_MAX_WORKERS = 2;
const BASE_PROCESS_CONCURRENCY = 10;
const ACTIVE_SLEEP_MS = 300;
const FINAL_PHASE_SLEEP_MS = 100;
const WATCHDOG_INTERVAL_MS = 10000;
const WATCHDOG_IDLE_THRESHOLD_MS = 10000;

let workerRunning = false;
let workerLoopStartRequested = false;
let workerPassInFlight = false;
let lastProcessedAt = Date.now();
let watchdogHandle: NodeJS.Timeout | null = null;
let strategyMode: "normal" | "aggressive" | "deep_enrichment" | "strict_domain_only" = "normal";
let focusHighConfidenceOnly = false;
let minConfidenceThreshold = 0.5;
const POPULARITY_FORCE_ATTEMPT_THRESHOLD = 10;
let lastFallbackRatio: number | null = null;
let lowProgressStreak = 0;
const PASS_LOCK_TTL_SECONDS = 120;
const PASS_LOCK_KEY = clusterScopedKey("app:lock:logo-pass", "global");

interface CycleTuning {
  perWorkerBatchSize: number;
  maxWorkers: number;
  concurrency: number;
  sleepMs: number;
}

function getCycleTuning(fallbackRatio: number, mode: "normal" | "aggressive" | "deep_enrichment" | "strict_domain_only"): CycleTuning {
  if (mode === "strict_domain_only") {
    return {
      perWorkerBatchSize: 50,
      maxWorkers: 2,
      concurrency: 20,
      sleepMs: FINAL_PHASE_SLEEP_MS,
    };
  }

  if (fallbackRatio < 0.2 || mode === "deep_enrichment") {
    return {
      perWorkerBatchSize: 50,
      maxWorkers: 2,
      concurrency: 20,
      sleepMs: FINAL_PHASE_SLEEP_MS,
    };
  }

  return {
    perWorkerBatchSize: BASE_PER_WORKER_BATCH_SIZE,
    maxWorkers: BASE_MAX_WORKERS,
    concurrency: BASE_PROCESS_CONCURRENCY,
    sleepMs: ACTIVE_SLEEP_MS,
  };
}

function nextConfidenceThreshold(successRate: number): number {
  if (successRate < 0.2) return 0.3;
  if (successRate > 0.4) return 0.6;
  return 0.5;
}

function nextStrategyFromDiagnostics(
  currentMode: "normal" | "aggressive" | "deep_enrichment" | "strict_domain_only",
  failureStats: Record<string, number>,
  successRate: number,
): "normal" | "aggressive" | "deep_enrichment" | "strict_domain_only" {
  if (successRate < 0.05) return "strict_domain_only";
  if (currentMode === "strict_domain_only") return "aggressive";
  if (currentMode === "deep_enrichment") return "deep_enrichment";
  if (successRate > 0.5) return "normal";
  if (successRate < 0.2) return "aggressive";

  const noDomainShare = failureStats[FailureReason.NO_DOMAIN] ?? 0;
  const lowConfidenceShare = failureStats[FailureReason.LOW_CONFIDENCE] ?? 0;
  const api404Share = failureStats[FailureReason.API_404] ?? 0;

  if (noDomainShare >= 0.4 || lowConfidenceShare >= 0.2 || api404Share >= 0.3) {
    return "aggressive";
  }

  return currentMode;
}

function qualityScore(item: MissingLogoWorkItem): number {
  const classification = classifySymbol({
    symbol: item.symbol,
    name: item.name,
    type: item.type,
    exchange: item.exchange,
  });
  const domainMeta = inferDomainWithConfidence({
    symbol: item.symbol,
    name: item.name,
    exchange: item.exchange,
  });

  const classScore = classification === "company"
    ? 40
    : classification === "fund" || classification === "forex"
      ? 30
      : 5;

  return classScore
    + domainMeta.confidence * 100
    + (item.searchFrequency ?? 0) * 0.5
    + item.searchFrequency * 1.2
    + item.userUsage * 0.4
    + item.count * 0.2;
}

function pickBatch(items: MissingLogoWorkItem[]): MissingLogoWorkItem[] {
  const tuning = getCycleTuning(lastFallbackRatio ?? 1, strategyMode);
  const maxItems = tuning.perWorkerBatchSize * tuning.maxWorkers;

  if (strategyMode === "deep_enrichment") {
    const unresolvedFirst = [...items].sort((left, right) => {
      const leftScore = left.status === "unresolved" || left.status === "unresolvable" ? 1 : 0;
      const rightScore = right.status === "unresolved" || right.status === "unresolvable" ? 1 : 0;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return qualityScore(right) - qualityScore(left);
    });

    return unresolvedFirst.slice(0, maxItems);
  }

  const ranked = [...items].sort((left, right) => qualityScore(right) - qualityScore(left));

  if (!focusHighConfidenceOnly) {
    return ranked.slice(0, maxItems);
  }

  const filtered = ranked.filter((item) => {
    const classification = classifySymbol({
      symbol: item.symbol,
      name: item.name,
      type: item.type,
      exchange: item.exchange,
    });
    if (classification === "fund" || classification === "forex") return true;

    const domainMeta = inferDomainWithConfidence({
      symbol: item.symbol,
      name: item.name,
      exchange: item.exchange,
    });

    return domainMeta.confidence >= 0.5;
  });

  return (filtered.length ? filtered : ranked).slice(0, maxItems);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runLogoEnrichmentPass(): Promise<{ processed: number; resolved: number; ratio: number }> {
  if (isRedisReady()) {
    const locked = await redisClient.set(PASS_LOCK_KEY, "1", "EX", PASS_LOCK_TTL_SECONDS, "NX");
    if (locked !== "OK") {
      logger.info("logo_worker_pass_skipped_distributed_lock");
      const ratioState = await computeFallbackRatio();
      return { processed: 0, resolved: 0, ratio: ratioState.ratio };
    }
  }

  workerPassInFlight = true;

  try {
    const staleReopened = await reopenFalseResolvedItems();
    const ratioState = await computeFallbackRatio();
    lastFallbackRatio = ratioState.ratio;

    if (ratioState.ratio < env.LOGO_FALLBACK_TARGET_RATIO) {
      logger.info("logo_worker_target_achieved", {
        fallbackRatio: ratioState.ratio,
        target: env.LOGO_FALLBACK_TARGET_RATIO,
        mode: strategyMode,
      });
    }

    if (ratioState.ratio < 0.15 && strategyMode !== "strict_domain_only") {
      strategyMode = "deep_enrichment";
    }

    if ((strategyMode === "deep_enrichment" || strategyMode === "strict_domain_only") && ratioState.ratio > env.LOGO_FALLBACK_TARGET_RATIO) {
      const resetCount = await resetUnresolvedToPending();
      if (resetCount > 0) {
        logger.info("logo_worker_deep_mode_reset_unresolved", { count: resetCount });
      }
    }

    const tuning = getCycleTuning(ratioState.ratio, strategyMode);

    let missing = pickBatch(await getMissingLogosBatch(
      tuning.perWorkerBatchSize * tuning.maxWorkers,
      { includeUnresolved: strategyMode === "deep_enrichment" || strategyMode === "strict_domain_only" },
    ));

    if (!missing.length) {
      const repopulated = await repopulateMissingLogos();
      lastProcessedAt = Date.now();
      logger.info("logo_worker_queue_repopulated", {
        ...repopulated,
        staleReopened,
        mode: strategyMode,
      });

      missing = pickBatch(await getMissingLogosBatch(
        tuning.perWorkerBatchSize * tuning.maxWorkers,
        { includeUnresolved: strategyMode === "deep_enrichment" || strategyMode === "strict_domain_only" },
      ));

      if (!missing.length) {
        return { processed: 0, resolved: 0, ratio: ratioState.ratio };
      }
    }

    resetDiagnosticsWindow();
    const workerResult = await processWithWorkerPool(missing, {
      workerCount: tuning.maxWorkers,
      maxWorkers: tuning.maxWorkers,
      perWorkerChunkSize: tuning.perWorkerBatchSize,
      perWorkerConcurrency: tuning.concurrency,
      strategy: strategyMode,
      minConfidence: minConfidenceThreshold,
      popularityForceThreshold: POPULARITY_FORCE_ATTEMPT_THRESHOLD,
    });
    let { processed, resolved } = workerResult;
    lastProcessedAt = Date.now();

    // ── Tail elimination phase ─────────────────────────────────────────
    // After normal processing, run cluster resolution + tail pipeline
    // on remaining unresolved items to push toward 100%.
    const tailBatch = await getMissingLogosBatch(100, { includeUnresolved: true });
    let tailResolved = 0;
    if (tailBatch.length > 0) {
      // Cheap cluster pass first (no network calls)
      const clusterResult = await resolveCluster(
        tailBatch.map((item) => ({ fullSymbol: item.fullSymbol, symbol: item.symbol })),
      );
      tailResolved += clusterResult.resolved;

      // Full 8-strategy tail elimination
      const tailResult = await eliminateTail(tailBatch, { batchSize: 100 });
      tailResolved += tailResult.resolved;
      processed += tailResult.processed;
      resolved += tailResolved;

      logger.info("tail_elimination_pass", {
        tailProcessed: tailResult.processed,
        tailResolved: tailResult.resolved,
        clusterResolved: clusterResult.resolved,
        strategyBreakdown: tailResult.strategyBreakdown,
        exhausted: tailResult.exhausted,
        skipped: tailResult.skipped,
        costMetrics: getCostMetrics(),
      });
    }

    // Anti-stagnation detection
    const stagnation = detectStagnation(resolved, tailBatch.length);
    if (stagnation.stagnant) {
      logger.warn("logo_worker_stagnation_detected", { ...stagnation });
      if (strategyMode !== "deep_enrichment" && strategyMode !== "strict_domain_only") {
        strategyMode = "deep_enrichment";
      }
    }

    const diagnostics = getFailureStatsSnapshot();
    const successRate = diagnostics.successRate;
    strategyMode = nextStrategyFromDiagnostics(strategyMode, diagnostics.failureStats, successRate);
    minConfidenceThreshold = strategyMode === "deep_enrichment" || strategyMode === "strict_domain_only" ? 0 : nextConfidenceThreshold(successRate);
    focusHighConfidenceOnly = strategyMode !== "deep_enrichment" && strategyMode !== "strict_domain_only"
      && (diagnostics.failureStats[FailureReason.LOW_CONFIDENCE] ?? 0) >= 0.8;

    const finalRatioState = await computeFallbackRatio();
    if (lastFallbackRatio !== null) {
      const delta = Math.abs(lastFallbackRatio - finalRatioState.ratio);
      if (delta < 0.002) {
        lowProgressStreak += 1;
        if (strategyMode !== "strict_domain_only") {
          strategyMode = "deep_enrichment";
        }
      } else {
        lowProgressStreak = 0;
      }
    }
    lastFallbackRatio = finalRatioState.ratio;

    logger.info("logo_worker_batch_completed", {
      fallbackRatio: finalRatioState.ratio,
      successRate,
      processed,
      resolved,
      remaining: finalRatioState.fallbackCount,
      mode: strategyMode,
      failureStats: diagnostics.failureStats,
      dominantFailureReason: diagnostics.dominantFailureReason,
      minConfidenceThreshold,
      focusHighConfidenceOnly,
      lowProgressStreak,
      batchSize: tuning.perWorkerBatchSize,
      workerCount: workerResult.workerCount,
      perWorkerChunkSize: workerResult.chunkSize,
      concurrency: tuning.concurrency,
      target: env.LOGO_FALLBACK_TARGET_RATIO,
      staleReopened,
    });

    return { processed, resolved, ratio: finalRatioState.ratio };
  } finally {
    workerPassInFlight = false;
    if (isRedisReady()) {
      await redisClient.del(PASS_LOCK_KEY);
    }
  }
}

async function watchdogTick(): Promise<void> {
  if (!workerRunning) return;
  if (workerPassInFlight) return;

  const idleMs = Date.now() - lastProcessedAt;
  if (idleMs <= WATCHDOG_IDLE_THRESHOLD_MS) return;

  const ratioState = await computeFallbackRatio();
  if (ratioState.ratio < env.LOGO_FALLBACK_TARGET_RATIO) return;

  logger.warn("logo_worker_watchdog_recovery", {
    idleMs,
    thresholdMs: WATCHDOG_IDLE_THRESHOLD_MS,
    fallbackRatio: ratioState.ratio,
  });

  await runLogoEnrichmentPass();
}

export async function runLogoEnrichmentWorkerForever(): Promise<never> {
  lastProcessedAt = Date.now();
  workerRunning = true;

  while (true) {
    try {
      workerPassInFlight = true;
      const cycleResult = await runLogoEnrichmentPass();
      const tuning = getCycleTuning(cycleResult.ratio, strategyMode);
      await sleep(tuning.sleepMs);
    } catch (error) {
      logger.error("logo_worker_loop_error", {
        message: error instanceof Error ? error.message : String(error),
      });
      await sleep(FINAL_PHASE_SLEEP_MS);
    } finally {
      workerPassInFlight = false;
    }
  }
}

export function startLogoEnrichmentScheduler(): void {
  if (!env.LOGO_ENRICHMENT_ENABLED) {
    logger.info("logo_worker_scheduler_disabled");
    return;
  }

  if (workerRunning) {
    logger.warn("logo_worker_scheduler_already_running");
    return;
  }

  if (workerLoopStartRequested) {
    logger.warn("logo_worker_scheduler_start_already_requested");
    return;
  }

  workerLoopStartRequested = true;

  void runLogoEnrichmentWorkerForever().catch((error) => {
    workerRunning = false;
    workerLoopStartRequested = false;
    logger.error("logo_worker_stopped_unexpectedly", {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  if (!watchdogHandle) {
    watchdogHandle = setInterval(() => {
      void watchdogTick().catch((error) => {
        logger.error("logo_worker_watchdog_error", {
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }, WATCHDOG_INTERVAL_MS);
  }

  logger.info("logo_worker_scheduler_started", {
    mode: "continuous",
    batchSize: BASE_PER_WORKER_BATCH_SIZE,
    workerCount: BASE_MAX_WORKERS,
    concurrency: BASE_PROCESS_CONCURRENCY,
    activeSleepMs: ACTIVE_SLEEP_MS,
    finalPhaseSleepMs: FINAL_PHASE_SLEEP_MS,
    watchdogIntervalMs: WATCHDOG_INTERVAL_MS,
    minConfidenceThreshold,
    popularityForceAttemptThreshold: POPULARITY_FORCE_ATTEMPT_THRESHOLD,
  });
}

