/**
 * Cluster cache — reuse resolved logo/domain across symbol variants.
 * E.g. RELIANCE, RELIANCE.NS, RELIANCE.BO all share a single logo.
 */

import { SymbolModel } from "../models/Symbol";
import { redisClient, isRedisReady } from "../config/redis";
import { clusterScopedKey } from "./redisKey.service";

// ── In-memory L1 cache ───────────────────────────────────────────────────
const clusterL1 = new Map<string, ClusterCacheEntry>();
const MEMORY_TTL_MS = 30 * 60 * 1000; // 30 min
const REDIS_TTL_S = 24 * 60 * 60;     // 24 h

export interface ClusterCacheEntry {
  iconUrl: string;
  domain: string;
  cachedAt: number;
}

function cacheKey(baseSymbol: string): string {
  return clusterScopedKey("app:cluster", baseSymbol.toUpperCase());
}

// ── Extract base symbol ──────────────────────────────────────────────────

export function extractBaseSymbol(rawSymbol: string): string {
  const upper = rawSymbol.trim().toUpperCase();
  // Split on common exchange suffixes: .NS .BO .L .AX etc.
  const [head] = upper.split(/[-.$/\\]/);
  return head || upper;
}

// ── Lookup ───────────────────────────────────────────────────────────────

export async function getClusterLogo(symbol: string): Promise<ClusterCacheEntry | null> {
  const base = extractBaseSymbol(symbol);
  if (!base) return null;

  // L1
  const l1 = clusterL1.get(base);
  if (l1 && Date.now() - l1.cachedAt < MEMORY_TTL_MS) return l1;

  // L2 (Redis)
  if (isRedisReady()) {
    const raw = await redisClient.get(cacheKey(base));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ClusterCacheEntry;
        clusterL1.set(base, parsed);
        return parsed;
      } catch { /* corrupt data, fall through */ }
    }
  }

  // L3 (DB) — find any resolved variant with this base symbol
  const resolved = await SymbolModel.findOne({
    baseSymbol: base,
    iconUrl: { $exists: true, $ne: "" },
  })
    .sort({ priorityScore: -1 })
    .select({ iconUrl: 1, companyDomain: 1 })
    .lean<{ iconUrl?: string; companyDomain?: string } | null>();

  if (!resolved?.iconUrl) return null;

  const entry: ClusterCacheEntry = {
    iconUrl: resolved.iconUrl,
    domain: resolved.companyDomain ?? "",
    cachedAt: Date.now(),
  };

  await setClusterLogo(base, entry);
  return entry;
}

// ── Store ────────────────────────────────────────────────────────────────

export async function setClusterLogo(baseSymbol: string, entry: ClusterCacheEntry): Promise<void> {
  const base = baseSymbol.toUpperCase();
  clusterL1.set(base, entry);

  if (isRedisReady()) {
    await redisClient.set(cacheKey(base), JSON.stringify(entry), "EX", REDIS_TTL_S);
  }
}

// ── Batch cluster resolution ─────────────────────────────────────────────
// Group unresolved symbols by base, check if any variant has a logo, apply to all.

export interface ClusterResolutionResult {
  resolved: number;
  checked: number;
}

export async function resolveCluster(symbols: Array<{ fullSymbol: string; symbol: string }>): Promise<ClusterResolutionResult> {
  // Group by base symbol
  const groups = new Map<string, Array<{ fullSymbol: string; symbol: string }>>();
  for (const sym of symbols) {
    const base = extractBaseSymbol(sym.symbol);
    const group = groups.get(base) ?? [];
    group.push(sym);
    groups.set(base, group);
  }

  let resolved = 0;
  let checked = 0;

  for (const [base, members] of groups) {
    checked += members.length;

    // eslint-disable-next-line no-await-in-loop
    const cachedEntry = await getClusterLogo(base);
    if (!cachedEntry) continue;

    // Apply to all unresolved members
    const fullSymbols = members.map((m) => m.fullSymbol.toUpperCase());
    // eslint-disable-next-line no-await-in-loop
    const result = await SymbolModel.updateMany(
      {
        fullSymbol: { $in: fullSymbols },
        $or: [{ iconUrl: { $exists: false } }, { iconUrl: "" }],
      },
      {
        $set: {
          iconUrl: cachedEntry.iconUrl,
          companyDomain: cachedEntry.domain,
          logoValidatedAt: new Date(),
        },
      },
    );
    resolved += result.modifiedCount;
  }

  return { resolved, checked };
}

// ── Invalidate ───────────────────────────────────────────────────────────

export async function invalidateCluster(baseSymbol: string): Promise<void> {
  const base = baseSymbol.toUpperCase();
  clusterL1.delete(base);
  if (isRedisReady()) {
    await redisClient.del(cacheKey(base));
  }
}
