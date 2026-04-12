/**
 * Adaptive Retry Engine
 *
 * Failure-type-aware retry logic that avoids blind retries.
 * Each failure type maps to a specific recovery strategy.
 *
 * NO_DOMAIN       → try fuzzy match / cluster lookup / domain heuristic
 * LOW_CONFIDENCE   → lower threshold, try deep enrichment
 * API_404         → try alternate sources (DDG, FMP, exchange fallback)
 * RATE_LIMIT      → exponential backoff, defer to next cycle
 * INVALID_LOGO    → try alternate sources
 * TIMEOUT         → limited retry with shorter timeout
 */

import { MissingLogoModel } from "../models/MissingLogo";
import {
  MAX_RETRIES_PER_SYMBOL,
  getRetriesUsed,
  markExhausted,
} from "./costGuardrails.service";
import { logger } from "../utils/logger";

// ── Failure classification ───────────────────────────────────────────────

export type AdaptiveFailureType =
  | "NO_DOMAIN"
  | "LOW_CONFIDENCE"
  | "API_404"
  | "RATE_LIMIT"
  | "INVALID_LOGO"
  | "TIMEOUT"
  | "UNKNOWN";

export interface AdaptiveRetryDecision {
  shouldRetry: boolean;
  strategy: "normal" | "aggressive" | "deep_enrichment" | "strict_domain_only";
  minConfidence: number;
  delayMs: number;
  reason: string;
}

export function classifyFailure(lastError: string): AdaptiveFailureType {
  const e = lastError.toLowerCase();
  if (e.includes("no_domain") || e.includes("no domain")) return "NO_DOMAIN";
  if (e.includes("low_confidence") || e.includes("low confidence")) return "LOW_CONFIDENCE";
  if (e.includes("404") || e.includes("api_404") || e.includes("not found")) return "API_404";
  if (e.includes("429") || e.includes("rate") || e.includes("throttle")) return "RATE_LIMIT";
  if (e.includes("invalid_logo") || e.includes("invalid logo")) return "INVALID_LOGO";
  if (e.includes("timeout") || e.includes("abort") || e.includes("econnreset")) return "TIMEOUT";
  return "UNKNOWN";
}

// ── Decide whether/how to retry ──────────────────────────────────────────

export async function decideRetry(input: {
  fullSymbol: string;
  retryCount: number;
  lastError: string;
  hasDomain: boolean;
}): Promise<AdaptiveRetryDecision> {
  const failureType = classifyFailure(input.lastError);
  const used = await getRetriesUsed(input.fullSymbol);

  if (used >= MAX_RETRIES_PER_SYMBOL) {
    markExhausted(input.fullSymbol);
    return {
      shouldRetry: false,
      strategy: "normal",
      minConfidence: 0.7,
      delayMs: 0,
      reason: `exhausted after ${used} retries`,
    };
  }

  switch (failureType) {
    case "NO_DOMAIN":
      return {
        shouldRetry: true,
        strategy: "deep_enrichment",
        minConfidence: 0.4,
        delayMs: 0,
        reason: "no_domain → deep enrichment with low threshold",
      };

    case "LOW_CONFIDENCE":
      return {
        shouldRetry: true,
        strategy: "aggressive",
        minConfidence: 0.35,
        delayMs: 0,
        reason: "low_confidence → aggressive with very low threshold",
      };

    case "API_404":
      return {
        shouldRetry: input.retryCount < 3,
        strategy: "deep_enrichment",
        minConfidence: 0.5,
        delayMs: 5000,
        reason: "404 → try alternate sources",
      };

    case "RATE_LIMIT": {
      const backoffMs = Math.min(60000, 5000 * Math.pow(2, input.retryCount));
      return {
        shouldRetry: true,
        strategy: "normal",
        minConfidence: 0.7,
        delayMs: backoffMs,
        reason: `rate_limited → backoff ${backoffMs}ms`,
      };
    }

    case "INVALID_LOGO":
      return {
        shouldRetry: true,
        strategy: "aggressive",
        minConfidence: 0.5,
        delayMs: 2000,
        reason: "invalid_logo → try alternate sources aggressively",
      };

    case "TIMEOUT":
      return {
        shouldRetry: input.retryCount < 2,
        strategy: "normal",
        minConfidence: 0.7,
        delayMs: 3000,
        reason: "timeout → limited retry",
      };

    default:
      return {
        shouldRetry: input.retryCount < 3,
        strategy: "aggressive",
        minConfidence: 0.5,
        delayMs: 1000,
        reason: "unknown failure → moderate retry",
      };
  }
}

// ── Quarantine management ────────────────────────────────────────────────

export async function quarantineSymbol(fullSymbol: string, reason: string): Promise<void> {
  await MissingLogoModel.updateOne(
    { fullSymbol: fullSymbol.toUpperCase() },
    {
      $set: {
        status: "unresolvable",
        lastError: `quarantined: ${reason}`.slice(0, 300),
        nextRetryAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day cooldown
      },
    },
  );
  logger.info("symbol_quarantined", { fullSymbol, reason });
}

export async function unquarantineIfNewSource(sources: string[]): Promise<number> {
  // Reopen quarantined symbols if we have new data sources
  const result = await MissingLogoModel.updateMany(
    {
      status: "unresolvable",
      nextRetryAt: { $lte: new Date() },
    },
    {
      $set: {
        status: "pending",
        retryCount: 0,
        nextRetryAt: null,
        lastError: `reopened: new sources [${sources.join(",")}]`,
      },
    },
  );
  if (result.modifiedCount > 0) {
    logger.info("symbols_unquarantined", { count: result.modifiedCount, sources });
  }
  return result.modifiedCount;
}

// ── Anti-stagnation detection ────────────────────────────────────────────

let previousCycleResolved = 0;
let stagnationCycles = 0;

export interface StagnationState {
  stagnant: boolean;
  cyclesSinceProgress: number;
  recommendation: "none" | "increase_aggression" | "expand_sources" | "increase_parallelism";
}

export function detectStagnation(resolvedThisCycle: number, totalRemaining: number): StagnationState {
  const progressRate = totalRemaining > 0 ? resolvedThisCycle / totalRemaining : 1;

  if (progressRate < 0.001 && resolvedThisCycle <= previousCycleResolved) {
    stagnationCycles++;
  } else {
    stagnationCycles = 0;
  }

  previousCycleResolved = resolvedThisCycle;

  if (stagnationCycles >= 2) {
    const recommendation =
      stagnationCycles >= 4
        ? "increase_parallelism"
        : stagnationCycles >= 3
          ? "expand_sources"
          : "increase_aggression";

    return { stagnant: true, cyclesSinceProgress: stagnationCycles, recommendation };
  }

  return { stagnant: false, cyclesSinceProgress: 0, recommendation: "none" };
}

export function resetStagnationTracking(): void {
  previousCycleResolved = 0;
  stagnationCycles = 0;
}
