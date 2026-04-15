/**
 * Cost guardrails — hard limits on per-symbol retries / network calls
 * to prevent infinite loops and cost explosion on long-tail symbols.
 */

import { redisClient, isRedisReady } from "../config/redis";
import { clusterScopedKey } from "./redisKey.service";

// ── Hard limits ──────────────────────────────────────────────────────────
export const MAX_RETRIES_PER_SYMBOL = 5;
export const MAX_NETWORK_CALLS_PER_SYMBOL = 10;
export const MAX_SCRAPE_TIME_MS = 5000;
const COST_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// ── In-memory fallback (used when Redis is unavailable) ──────────────────
const memoryRetries = new Map<string, number>();
const memoryNetworkCalls = new Map<string, number>();
const exhaustedSymbols = new Set<string>();

// ── Aggregate cost tracking ──────────────────────────────────────────────
let totalNetworkCalls = 0;
let totalRetries = 0;
let totalExhausted = 0;
let totalSkipped = 0;
let lowPriorityThrottled = false;

// ── Global dedupe cache (prevent reprocessing) ───────────────────────────
const processedCache = new Map<string, number>(); // fullSymbol → timestamp
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEDUPE_EVICT_AT = 500_000; // evict when cache grows too large

// ── Domain cache (company name → domain) ─────────────────────────────────
const domainCache = new Map<string, string>(); // normalized company name → domain
const DOMAIN_CACHE_MAX = 200_000;

function redisKey(kind: "retry" | "net", fullSymbol: string): string {
  return clusterScopedKey(`app:cost:${kind}`, fullSymbol);
}

// ── Per-symbol attempt tracking ──────────────────────────────────────────

export async function recordRetry(fullSymbol: string): Promise<number> {
  totalRetries++;
  const key = redisKey("retry", fullSymbol);

  if (isRedisReady()) {
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, COST_TTL_SECONDS);
    return count;
  }

  const current = (memoryRetries.get(fullSymbol) ?? 0) + 1;
  memoryRetries.set(fullSymbol, current);
  return current;
}

export async function recordNetworkCall(fullSymbol: string, calls = 1): Promise<number> {
  totalNetworkCalls += calls;
  const key = redisKey("net", fullSymbol);

  if (isRedisReady()) {
    const count = await redisClient.incrby(key, calls);
    if (count === calls) await redisClient.expire(key, COST_TTL_SECONDS);
    return count;
  }

  const current = (memoryNetworkCalls.get(fullSymbol) ?? 0) + calls;
  memoryNetworkCalls.set(fullSymbol, current);
  return current;
}

export async function getRetriesUsed(fullSymbol: string): Promise<number> {
  if (isRedisReady()) {
    const val = await redisClient.get(redisKey("retry", fullSymbol));
    return val ? Number(val) : 0;
  }
  return memoryRetries.get(fullSymbol) ?? 0;
}

export async function getNetworkCallsUsed(fullSymbol: string): Promise<number> {
  if (isRedisReady()) {
    const val = await redisClient.get(redisKey("net", fullSymbol));
    return val ? Number(val) : 0;
  }
  return memoryNetworkCalls.get(fullSymbol) ?? 0;
}

// ── Exhaustion check ─────────────────────────────────────────────────────

export async function isExhausted(fullSymbol: string): Promise<boolean> {
  if (exhaustedSymbols.has(fullSymbol)) return true;

  const [retries, netCalls] = await Promise.all([
    getRetriesUsed(fullSymbol),
    getNetworkCallsUsed(fullSymbol),
  ]);

  if (retries >= MAX_RETRIES_PER_SYMBOL || netCalls >= MAX_NETWORK_CALLS_PER_SYMBOL) {
    exhaustedSymbols.add(fullSymbol);
    totalExhausted++;
    return true;
  }

  return false;
}

export function markExhausted(fullSymbol: string): void {
  exhaustedSymbols.add(fullSymbol);
  totalExhausted++;
}

// ── Priority-based skip ──────────────────────────────────────────────────

export type SymbolPriority = "high" | "medium" | "low";

export function classifyPriority(input: {
  popularity?: number;
  searchFrequency?: number;
  userUsage?: number;
  exchange?: string;
}): SymbolPriority {
  const score =
    (input.popularity ?? 0) +
    (input.searchFrequency ?? 0) * 2 +
    (input.userUsage ?? 0) * 3;

  const topExchanges = new Set(["NYSE", "NASDAQ", "NSE", "BSE", "LSE", "XETRA"]);
  const exchangeBoost = topExchanges.has((input.exchange ?? "").toUpperCase()) ? 50 : 0;

  const total = score + exchangeBoost;
  if (total >= 100) return "high";
  if (total >= 20) return "medium";
  return "low";
}

export function shouldSkipLowPriority(priority: SymbolPriority, retryCount: number): boolean {
  if (priority === "high") return false;
  if (priority === "medium") return retryCount > 3;
  // low priority: skip after 2 retries
  return retryCount > 2;
}

// ── Cost metrics snapshot ────────────────────────────────────────────────

export interface CostMetrics {
  totalNetworkCalls: number;
  totalRetries: number;
  totalExhausted: number;
  totalSkipped: number;
  avgNetworkCallsPerSymbol: number;
}

export function getCostMetrics(): CostMetrics {
  const symbolsTracked = Math.max(1, memoryRetries.size + exhaustedSymbols.size);
  return {
    totalNetworkCalls,
    totalRetries,
    totalExhausted,
    totalSkipped,
    avgNetworkCallsPerSymbol: totalNetworkCalls / symbolsTracked,
  };
}

export function incrementSkipped(): void {
  totalSkipped++;
}

export function resetCostMetrics(): void {
  totalNetworkCalls = 0;
  totalRetries = 0;
  totalExhausted = 0;
  totalSkipped = 0;
  lowPriorityThrottled = false;
  exhaustedSymbols.clear();
  memoryRetries.clear();
  memoryNetworkCalls.clear();
}

// ── Global dedupe cache ──────────────────────────────────────────────────

export function isRecentlyProcessed(fullSymbol: string): boolean {
  const ts = processedCache.get(fullSymbol);
  if (!ts) return false;
  if (Date.now() - ts > DEDUPE_TTL_MS) {
    processedCache.delete(fullSymbol);
    return false;
  }
  return true;
}

export function markProcessed(fullSymbol: string): void {
  // Evict oldest entries if cache is too large
  if (processedCache.size >= DEDUPE_EVICT_AT) {
    const now = Date.now();
    for (const [key, ts] of processedCache) {
      if (now - ts > DEDUPE_TTL_MS) {
        processedCache.delete(key);
      }
    }
    // If still too large, evict first quarter
    if (processedCache.size >= DEDUPE_EVICT_AT) {
      const iterator = processedCache.keys();
      const evictCount = Math.floor(processedCache.size / 4);
      for (let i = 0; i < evictCount; i++) {
        const next = iterator.next();
        if (next.done) break;
        processedCache.delete(next.value);
      }
    }
  }
  processedCache.set(fullSymbol, Date.now());
}

export function getDedupeStats(): { cached: number; maxSize: number } {
  return { cached: processedCache.size, maxSize: DEDUPE_EVICT_AT };
}

// ── Domain cache (company name → domain) ─────────────────────────────────

function normalizeCacheKey(name: string): string {
  return name.toLowerCase()
    .replace(/\b(limited|ltd|inc\.?|corp\.?|corporation|plc|company|co\.?|holdings|group)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function getCachedDomain(companyName: string): string | null {
  const key = normalizeCacheKey(companyName);
  if (!key) return null;
  return domainCache.get(key) ?? null;
}

export function cacheDomain(companyName: string, domain: string): void {
  const key = normalizeCacheKey(companyName);
  if (!key || !domain) return;
  if (domainCache.size >= DOMAIN_CACHE_MAX) {
    // Evict first quarter
    const iterator = domainCache.keys();
    const evictCount = Math.floor(domainCache.size / 4);
    for (let i = 0; i < evictCount; i++) {
      const next = iterator.next();
      if (next.done) break;
      domainCache.delete(next.value);
    }
  }
  domainCache.set(key, domain);
}

export function getDomainCacheStats(): { cached: number; maxSize: number } {
  return { cached: domainCache.size, maxSize: DOMAIN_CACHE_MAX };
}

// ── Cost kill switch ─────────────────────────────────────────────────────

const COST_THRESHOLD_PER_CYCLE = 5000;     // max network calls per cycle
const GROWTH_THRESHOLD_PERCENT = 0.05;     // minimum required growth rate

export function evaluateCostKillSwitch(costThisCycle: number, growthPercent: number): boolean {
  if (costThisCycle > COST_THRESHOLD_PER_CYCLE && growthPercent < GROWTH_THRESHOLD_PERCENT) {
    lowPriorityThrottled = true;
    return true; // kill switch activated
  }
  // Reset throttle if growth is good
  if (growthPercent >= GROWTH_THRESHOLD_PERCENT * 2) {
    lowPriorityThrottled = false;
  }
  return false;
}

export function isLowPriorityThrottled(): boolean {
  return lowPriorityThrottled;
}

export function setLowPriorityThrottled(throttled: boolean): void {
  lowPriorityThrottled = throttled;
}
