/**
 * Tail Orchestrator — the main execution loop that drives the logo pipeline
 * to 100% coverage via normal processing + tail elimination + cost control.
 *
 * Runs as a long-lived background process:
 *   1. Normal pipeline (worker pool on pending items)
 *   2. Tail elimination (8-strategy pipeline on remaining items)
 *   3. Cost enforcement (quarantine exhausted symbols)
 *   4. Anti-stagnation (escalate strategy when progress stalls)
 *   5. Coverage logging
 */

import { getMissingLogosBatch, repopulateMissingLogos, reopenFalseResolvedItems } from "./missingLogo.service";
import { processWithWorkerPool } from "./workerManager.service";
import { eliminateTail, getTailCoverageStats, type TailEliminationResult } from "./tailElimination.service";
import { resolveCluster } from "./clusterCache.service";
import { getCostMetrics, resetCostMetrics } from "./costGuardrails.service";
import { decideRetry, detectStagnation, resetStagnationTracking, quarantineSymbol, unquarantineIfNewSource } from "./adaptiveRetry.service";
import { logger } from "../utils/logger";

// ── Config ───────────────────────────────────────────────────────────────

const NORMAL_BATCH_SIZE = 500;
const TAIL_BATCH_SIZE = 100;
const CYCLE_INTERVAL_MS = 60_000;        // 1 min between cycles
const MAX_CYCLES_PER_RUN = 1000;         // safety valve
const REPOPULATE_EVERY_N_CYCLES = 10;    // recheck for missed symbols
const REOPEN_FALSE_EVERY_N_CYCLES = 5;   // reopen false-resolved
const UNQUARANTINE_EVERY_N_CYCLES = 50;  // check quarantined symbols

// ── State ────────────────────────────────────────────────────────────────

let running = false;
let currentCycle = 0;
let totalResolvedAllCycles = 0;

export interface CycleResult {
  cycle: number;
  normalProcessed: number;
  normalResolved: number;
  tailProcessed: number;
  tailResolved: number;
  clusterResolved: number;
  coverage: string;
  remaining: number;
  totalResolved: number;
}

// ── Main loop ────────────────────────────────────────────────────────────

export async function startTailOrchestrator(): Promise<void> {
  if (running) {
    logger.warn("tail_orchestrator_already_running");
    return;
  }

  running = true;
  currentCycle = 0;
  resetStagnationTracking();
  resetCostMetrics();

  logger.info("tail_orchestrator_started");

  try {
    while (running && currentCycle < MAX_CYCLES_PER_RUN) {
      currentCycle++;

      // eslint-disable-next-line no-await-in-loop
      const cycleResult = await runSingleCycle();

      logger.info("tail_orchestrator_cycle_complete", {
        ...cycleResult,
        costMetrics: getCostMetrics(),
      });

      // When coverage reaches 100%, don't stop — continue monitoring for new symbols
      if (cycleResult.remaining === 0) {
        logger.info("tail_orchestrator_100_coverage", {
          totalCycles: currentCycle,
          totalResolved: totalResolvedAllCycles,
        });

        // Verify + continue with longer interval (monitoring mode)
        // eslint-disable-next-line no-await-in-loop
        const verify = await getTailCoverageStats();
        if (verify.missing === 0) {
          logger.info("tail_orchestrator_verified_100_monitoring");
          // eslint-disable-next-line no-await-in-loop
          await sleep(CYCLE_INTERVAL_MS * 3); // 3x slower when at 100%
          continue;
        }
        logger.info("tail_orchestrator_verify_found_more", { newMissing: verify.missing });
      }

      // Anti-stagnation
      const stagnation = detectStagnation(
        cycleResult.normalResolved + cycleResult.tailResolved + cycleResult.clusterResolved,
        cycleResult.remaining,
      );

      if (stagnation.stagnant) {
        logger.warn("tail_orchestrator_stagnation_detected", {
          ...stagnation,
          cycle: currentCycle,
        });
      }

      // Wait between cycles
      // eslint-disable-next-line no-await-in-loop
      await sleep(CYCLE_INTERVAL_MS);
    }
  } finally {
    running = false;
    logger.info("tail_orchestrator_stopped", {
      totalCycles: currentCycle,
      totalResolved: totalResolvedAllCycles,
    });
  }
}

export function stopTailOrchestrator(): void {
  running = false;
}

export function isOrchestratorRunning(): boolean {
  return running;
}

// ── Single cycle ─────────────────────────────────────────────────────────

async function runSingleCycle(): Promise<CycleResult> {
  // Periodic maintenance tasks
  if (currentCycle % REPOPULATE_EVERY_N_CYCLES === 0) {
    await repopulateMissingLogos();
  }
  if (currentCycle % REOPEN_FALSE_EVERY_N_CYCLES === 0) {
    await reopenFalseResolvedItems();
  }
  if (currentCycle % UNQUARANTINE_EVERY_N_CYCLES === 0) {
    await unquarantineIfNewSource(["cycle-recheck"]);
  }

  // ── Phase 1: Normal pipeline ───────────────────────────────────────
  const normalBatch = await getMissingLogosBatch(NORMAL_BATCH_SIZE);
  let normalProcessed = 0;
  let normalResolved = 0;

  if (normalBatch.length > 0) {
    // First try cluster resolution (cheap, no network)
    const clusterResult = await resolveCluster(
      normalBatch.map((item) => ({ fullSymbol: item.fullSymbol, symbol: item.symbol })),
    );

    // Process remaining through normal worker pool
    const workerResult = await processWithWorkerPool(normalBatch, {
      strategy: "normal",
      perWorkerConcurrency: 20,
    });
    normalProcessed = workerResult.processed;
    normalResolved = workerResult.resolved + clusterResult.resolved;
  }

  // ── Phase 2: Tail elimination ──────────────────────────────────────
  const tailBatch = await getMissingLogosBatch(TAIL_BATCH_SIZE, { includeUnresolved: true });
  let tailProcessed = 0;
  let tailResolved = 0;
  let clusterResolved = 0;

  if (tailBatch.length > 0) {
    // Apply adaptive retry decisions to select strategy
    const adaptedItems = [];
    for (const item of tailBatch) {
      const decision = await decideRetry({
        fullSymbol: item.fullSymbol,
        retryCount: item.retryCount,
        lastError: "", // Would need lastError field — use retryCount as proxy
        hasDomain: false,
      });

      if (decision.shouldRetry) {
        adaptedItems.push(item);
      } else {
        await quarantineSymbol(item.fullSymbol, decision.reason);
      }
    }

    if (adaptedItems.length > 0) {
      const tailResult = await eliminateTail(adaptedItems, { batchSize: TAIL_BATCH_SIZE });
      tailProcessed = tailResult.processed;
      tailResolved = tailResult.resolved;
      clusterResolved = tailResult.strategyBreakdown["cluster"] ?? 0;
    }
  }

  // ── Phase 3: Update stats ──────────────────────────────────────────
  const cycleResolved = normalResolved + tailResolved;
  totalResolvedAllCycles += cycleResolved;

  const stats = await getTailCoverageStats();

  return {
    cycle: currentCycle,
    normalProcessed,
    normalResolved,
    tailProcessed,
    tailResolved,
    clusterResolved,
    coverage: stats.coverage,
    remaining: stats.missing,
    totalResolved: totalResolvedAllCycles,
  };
}

// ── One-shot mode (for testing / manual trigger) ─────────────────────────

export async function runTailEliminationOnce(options?: {
  normalBatchSize?: number;
  tailBatchSize?: number;
}): Promise<CycleResult> {
  currentCycle = 1;
  const savedBatchNormal = NORMAL_BATCH_SIZE;
  const savedBatchTail = TAIL_BATCH_SIZE;

  try {
    return await runSingleCycle();
  } finally {
    currentCycle = 0;
  }
}

// ── Coverage report ──────────────────────────────────────────────────────

export interface FullCoverageReport {
  coverage: TailCoverageReportStats;
  costMetrics: ReturnType<typeof getCostMetrics>;
  orchestrator: {
    running: boolean;
    currentCycle: number;
    totalResolved: number;
  };
}

interface TailCoverageReportStats {
  totalSymbols: number;
  mapped: number;
  missing: number;
  coverage: string;
  quarantined: number;
}

export async function getFullCoverageReport(): Promise<FullCoverageReport> {
  const coverage = await getTailCoverageStats();
  return {
    coverage,
    costMetrics: getCostMetrics(),
    orchestrator: {
      running,
      currentCycle,
      totalResolved: totalResolvedAllCycles,
    },
  };
}

// ── Utility ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
