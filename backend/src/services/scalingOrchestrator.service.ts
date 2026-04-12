/**
 * Scaling Orchestrator — continuous, autonomous loop that:
 *
 *   1. EXPANDS the dataset (ingest new symbols from all global sources)
 *   2. SYNCS GlobalMaster → Symbol table
 *   3. POPULATES MissingLogo for new symbols
 *   4. RUNS the normal logo pipeline (worker pool)
 *   5. RUNS tail elimination for remaining symbols
 *   6. ENFORCES cost limits + quality control
 *   7. LOGS live metrics
 *   8. REPEATS — never stops until target is met
 *
 * Stop condition:
 *   totalSymbols >= 3,500,000 AND coverage === 100% AND remaining === 0
 *   Even then, continues monitoring (does not exit).
 */

import { SymbolModel } from "../models/Symbol";
import { GlobalSymbolMaster } from "../models/GlobalSymbolMaster";
import { MissingLogoModel } from "../models/MissingLogo";
import { ingestGlobalSymbolsIncremental, syncGlobalMasterToSymbols, getExpansionStats, type FullExpansionReport } from "./symbolExpansion.service";
import { repopulateMissingLogos, getMissingLogosBatch, reopenFalseResolvedItems } from "./missingLogo.service";
import { processWithWorkerPool } from "./workerManager.service";
import { eliminateTail, getTailCoverageStats } from "./tailElimination.service";
import { resolveCluster } from "./clusterCache.service";
import { getCostMetrics, resetCostMetrics, evaluateCostKillSwitch, isLowPriorityThrottled, isRecentlyProcessed, markProcessed, getDedupeStats, getDomainCacheStats } from "./costGuardrails.service";
import { detectStagnation, resetStagnationTracking } from "./adaptiveRetry.service";
import { produceLogoCompleted } from "../kafka/eventProducers";
import { logger } from "../utils/logger";

// ── Config ───────────────────────────────────────────────────────────────

const TARGET_SYMBOL_COUNT = 3_500_000;
const EXPANSION_BATCH_SIZE = 5000;        // symbols to sync from GlobalMaster per cycle
const NORMAL_BATCH_SIZE = 500;
const TAIL_BATCH_SIZE = 200;
const CYCLE_INTERVAL_MS = 30_000;         // 30s between cycles
const EXPANSION_EVERY_N_CYCLES = 5;       // re-expand sources every 5 cycles
const SYNC_BATCH_PER_CYCLE = 10_000;      // max symbols to sync per cycle
const REPOPULATE_EVERY_N_CYCLES = 3;      // populate missing logos frequently
const REOPEN_EVERY_N_CYCLES = 10;

// ── State ────────────────────────────────────────────────────────────────

let running = false;
let currentCycle = 0;
let totalResolvedThisRun = 0;
let lastExpansionReport: FullExpansionReport | null = null;

export interface ScalingCycleResult {
  cycle: number;
  phase: string;
  globalMasterCount: number;
  symbolTableCount: number;
  mapped: number;
  remaining: number;
  coverage: string;
  netGainThisCycle: number;
  totalResolvedThisRun: number;
  costPerCycle: number;
  targetReached: boolean;
}

export interface ScalingStatus {
  running: boolean;
  currentCycle: number;
  totalResolvedThisRun: number;
  lastExpansionReport: FullExpansionReport | null;
  currentStats: {
    globalMasterCount: number;
    symbolTableCount: number;
    gap: number;
  } | null;
}

// ── Main continuous loop ─────────────────────────────────────────────────

export async function startScalingOrchestrator(): Promise<void> {
  if (running) {
    logger.warn("scaling_orchestrator_already_running");
    return;
  }

  running = true;
  currentCycle = 0;
  totalResolvedThisRun = 0;
  resetStagnationTracking();
  resetCostMetrics();

  logger.info("scaling_orchestrator_started", { target: TARGET_SYMBOL_COUNT });

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (!running) break;
      currentCycle++;

      // eslint-disable-next-line no-await-in-loop
      const result = await runScalingCycle();

      logger.info("scaling_cycle_complete", {
        cycle: result.cycle,
        globalMaster: result.globalMasterCount,
        symbols: result.symbolTableCount,
        mapped: result.mapped,
        remaining: result.remaining,
        coverage: result.coverage,
        netGain: result.netGainThisCycle,
        totalResolved: result.totalResolvedThisRun,
      });

      // Check if ultimate target is met
      if (result.targetReached) {
        logger.info("scaling_orchestrator_target_reached", {
          totalSymbols: result.symbolTableCount,
          coverage: result.coverage,
          remaining: result.remaining,
        });

        // Even after target is met, continue monitoring for new symbols
        // but at a slower pace
        // eslint-disable-next-line no-await-in-loop
        await sleep(120_000); // 2 min monitoring interval
        continue;
      }

      // Anti-stagnation detection
      const stagnation = detectStagnation(
        result.netGainThisCycle,
        result.remaining,
      );

      if (stagnation.stagnant && currentCycle % 20 === 0) {
        logger.warn("scaling_orchestrator_stagnation", {
          cycle: currentCycle,
          recommendation: stagnation.recommendation,
        });
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(CYCLE_INTERVAL_MS);
    }
  } finally {
    running = false;
    logger.info("scaling_orchestrator_stopped", {
      totalCycles: currentCycle,
      totalResolved: totalResolvedThisRun,
    });
  }
}

export function stopScalingOrchestrator(): void {
  running = false;
}

export function isScalingOrchestratorRunning(): boolean {
  return running;
}

// ── Single scaling cycle ─────────────────────────────────────────────────

async function runScalingCycle(): Promise<ScalingCycleResult> {
  const costBefore = getCostMetrics().totalNetworkCalls;
  let netGain = 0;

  // ── STEP 1: Expand dataset (periodic) ──────────────────────────────
  if (currentCycle === 1 || currentCycle % EXPANSION_EVERY_N_CYCLES === 0) {
    try {
      lastExpansionReport = await ingestGlobalSymbolsIncremental();
      logger.info("scaling_expansion_done", {
        netGain: lastExpansionReport.netGain,
        totalAfter: lastExpansionReport.totalAfter,
      });
    } catch (error) {
      logger.error("scaling_expansion_error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ── STEP 2: Sync GlobalMaster → Symbol table ──────────────────────
  let syncedThisCycle = 0;
  try {
    let batchSynced: number;
    let totalSyncedInStep = 0;

    do {
      const result = await syncGlobalMasterToSymbols(EXPANSION_BATCH_SIZE);
      batchSynced = result.synced;
      totalSyncedInStep += batchSynced;

      if (totalSyncedInStep >= SYNC_BATCH_PER_CYCLE) break;

      // Yield to event loop
      if (batchSynced > 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    } while (batchSynced > 0);

    syncedThisCycle = totalSyncedInStep;

    if (syncedThisCycle > 0) {
      logger.info("scaling_sync_done", { synced: syncedThisCycle });
    }
  } catch (error) {
    logger.error("scaling_sync_error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ── STEP 3: Populate MissingLogo for new symbols ───────────────────
  if (currentCycle % REPOPULATE_EVERY_N_CYCLES === 0 || syncedThisCycle > 0) {
    try {
      const repopResult = await repopulateMissingLogos();
      if (repopResult.queued > 0) {
        logger.info("scaling_repopulate_done", repopResult);
      }
    } catch (error) {
      logger.error("scaling_repopulate_error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ── STEP 4: Reopen false-resolved periodically ────────────────────
  if (currentCycle % REOPEN_EVERY_N_CYCLES === 0) {
    try {
      await reopenFalseResolvedItems();
    } catch {
      // Non-critical
    }
  }

  // ── STEP 5: Run normal pipeline (worker pool) ─────────────────────
  let normalResolved = 0;
  try {
    const normalBatch = await getMissingLogosBatch(NORMAL_BATCH_SIZE);
    if (normalBatch.length > 0) {
      // Cluster resolution first (free, no network)
      const clusterResult = await resolveCluster(
        normalBatch.map((item) => ({ fullSymbol: item.fullSymbol, symbol: item.symbol })),
      );
      normalResolved += clusterResult.resolved;

      // Worker pool for the rest
      const workerResult = await processWithWorkerPool(normalBatch, {
        strategy: "normal",
        perWorkerConcurrency: 20,
      });
      normalResolved += workerResult.resolved;
    }
  } catch (error) {
    logger.error("scaling_normal_pipeline_error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ── STEP 6: Run tail elimination ───────────────────────────────────
  let tailResolved = 0;
  try {
    const tailBatch = await getMissingLogosBatch(TAIL_BATCH_SIZE, { includeUnresolved: true });
    if (tailBatch.length > 0) {
      const tailResult = await eliminateTail(tailBatch, { batchSize: TAIL_BATCH_SIZE });
      tailResolved = tailResult.resolved;
    }
  } catch (error) {
    logger.error("scaling_tail_error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ── STEP 7: Collect metrics + cost control ──────────────────────────
  const costAfter = getCostMetrics().totalNetworkCalls;
  const costThisCycle = costAfter - costBefore;
  netGain = normalResolved + tailResolved;
  totalResolvedThisRun += netGain;

  const [globalMasterCount, stats] = await Promise.all([
    GlobalSymbolMaster.estimatedDocumentCount(),
    getTailCoverageStats(),
  ]);

  const symbolTableCount = stats.totalSymbols;
  const growthPercent = symbolTableCount > 0 ? (netGain / symbolTableCount) * 100 : 0;

  // Cost kill switch: throttle low-priority if cost spikes without growth
  const killSwitchActivated = evaluateCostKillSwitch(costThisCycle, growthPercent);
  if (killSwitchActivated) {
    logger.warn("scaling_cost_kill_switch_activated", {
      costThisCycle,
      growthPercent,
      cycle: currentCycle,
    });
  }

  const targetReached =
    symbolTableCount >= TARGET_SYMBOL_COUNT &&
    stats.missing === 0;

  return {
    cycle: currentCycle,
    phase: currentCycle % EXPANSION_EVERY_N_CYCLES === 0 ? "expand+resolve" : "resolve",
    globalMasterCount,
    symbolTableCount,
    mapped: stats.mapped,
    remaining: stats.missing,
    coverage: stats.coverage,
    netGainThisCycle: netGain,
    totalResolvedThisRun,
    costPerCycle: costThisCycle,
    targetReached,
  };
}

// ── Manual triggers ──────────────────────────────────────────────────────

export async function runExpansionOnce(): Promise<FullExpansionReport> {
  const report = await ingestGlobalSymbolsIncremental();
  lastExpansionReport = report;
  return report;
}

export async function runSyncOnce(batchSize = 10000): Promise<{ synced: number }> {
  let total = 0;
  let batch: number;

  do {
    const result = await syncGlobalMasterToSymbols(Math.min(batchSize, 5000));
    batch = result.synced;
    total += batch;
    if (total >= batchSize) break;
  } while (batch > 0);

  return { synced: total };
}

// ── Live reporting ───────────────────────────────────────────────────────

export interface LiveScalingReport {
  totalSymbols: number;
  mapped: number;
  remaining: number;
  coverage: string;
  globalMasterCount: number;
  gap: number;
  netGain: number;
  costPerCycle: number;
  orchestrator: {
    running: boolean;
    currentCycle: number;
    totalResolved: number;
  };
  lastExpansion: FullExpansionReport | null;
  dedupeCache: { cached: number; maxSize: number };
  domainCache: { cached: number; maxSize: number };
  lowPriorityThrottled: boolean;
}

export async function getLiveScalingReport(): Promise<LiveScalingReport> {
  const [globalMasterCount, stats, costMetrics] = await Promise.all([
    GlobalSymbolMaster.estimatedDocumentCount(),
    getTailCoverageStats(),
    Promise.resolve(getCostMetrics()),
  ]);

  return {
    totalSymbols: stats.totalSymbols,
    mapped: stats.mapped,
    remaining: stats.missing,
    coverage: stats.coverage,
    globalMasterCount,
    gap: globalMasterCount - stats.totalSymbols,
    netGain: totalResolvedThisRun,
    costPerCycle: costMetrics.totalNetworkCalls,
    orchestrator: {
      running,
      currentCycle,
      totalResolved: totalResolvedThisRun,
    },
    lastExpansion: lastExpansionReport,
    dedupeCache: getDedupeStats(),
    domainCache: getDomainCacheStats(),
    lowPriorityThrottled: isLowPriorityThrottled(),
  };
}

export async function getScalingStatus(): Promise<ScalingStatus> {
  const [masterCount, symbolCount] = await Promise.all([
    GlobalSymbolMaster.estimatedDocumentCount(),
    SymbolModel.estimatedDocumentCount(),
  ]);

  return {
    running,
    currentCycle,
    totalResolvedThisRun,
    lastExpansionReport,
    currentStats: {
      globalMasterCount: masterCount,
      symbolTableCount: symbolCount,
      gap: masterCount - symbolCount,
    },
  };
}

// ── Utility ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
