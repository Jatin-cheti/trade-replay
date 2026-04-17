/**
 * cacheWarmup.service.ts — Non-blocking cache prewarm on server boot.
 *
 * Eliminates the cold-start penalty (~2 min on prod) by pre-filling
 * L1 + L2 (Redis) caches for the most common screener queries BEFORE
 * any user request arrives.
 *
 * Strategy:
 *  1. Warm the default screener page (first 200 items, priorityScore desc)
 *  2. Warm each asset-type tab (stock, crypto, etf, forex, index, bond, economy)
 *  3. Warm stats + filter endpoints
 *  4. Warm top search prefixes (AAPL, BTC, etc.)
 *
 * All work is I/O-bound (MongoDB + Redis). Uses setImmediate between
 * batches to avoid blocking the event loop.
 */

import { CleanAssetModel } from "../models/CleanAsset";
import { enrichScreenerBatch } from "./symbolAggregation.service";
import { buildScreenerCacheKey, getCachedRaw } from "./screenerCache.service";
import { getFilterIndex } from "./filterCache.service";
import { logger } from "../utils/logger";

const SELECT_FIELDS = "-searchPrefixes -logoAttempts -lastLogoAttemptAt -logoValidationNotes -logoQualityScore -__v";

/* ── Single-query warmer ──────────────────────────────────────────── */

async function warmQuery(params: Record<string, unknown>): Promise<void> {
  const key = buildScreenerCacheKey(params);
  const limit = (params.limit as number) || 200;
  const offset = (params.offset as number) || 0;
  const sortField = (params.sort as string) || "priorityScore";
  const sortDir = (params.order as string) === "asc" ? 1 : -1;

  await getCachedRaw(key, async () => {
    const query: Record<string, unknown> = {};
    if (params.type) query.type = params.type;
    if (params.country) query.country = params.country;

    const sortObj: Record<string, 1 | -1> = { [sortField]: sortDir };
    if (sortField !== "priorityScore") sortObj.priorityScore = -1;

    const [docs, total] = await Promise.all([
      CleanAssetModel.find(query).sort(sortObj).skip(offset).limit(limit)
        .select(SELECT_FIELDS).lean(),
      CleanAssetModel.countDocuments(query),
    ]);

    const enriched = await enrichScreenerBatch(docs);

    return JSON.stringify({
      items: enriched,
      total,
      limit,
      offset,
      hasMore: offset + docs.length < total,
    });
  });
}

/* ── Public API ───────────────────────────────────────────────────── */

export async function warmScreenerCache(): Promise<void> {
  const startMs = Date.now();
  let warmed = 0;
  let failed = 0;

  const queries: Record<string, unknown>[] = [
    // Default screener page (what every user sees first)
    { limit: 200, offset: 0, sort: "priorityScore", order: "desc" },
    // Category tabs
    { limit: 200, offset: 0, sort: "priorityScore", order: "desc", type: "stock" },
    { limit: 200, offset: 0, sort: "priorityScore", order: "desc", type: "crypto" },
    { limit: 200, offset: 0, sort: "priorityScore", order: "desc", type: "etf" },
    { limit: 200, offset: 0, sort: "priorityScore", order: "desc", type: "forex" },
    { limit: 200, offset: 0, sort: "priorityScore", order: "desc", type: "index" },
    // Page 2 of default (for fast scroll)
    { limit: 200, offset: 200, sort: "priorityScore", order: "desc" },
  ];

  for (const q of queries) {
    try {
      await warmQuery(q);
      warmed++;
    } catch {
      failed++;
    }
    // Yield to event loop between queries
    await new Promise<void>((r) => setImmediate(r));
  }

  // Also ensure filter index is warm
  try {
    await getFilterIndex();
    warmed++;
  } catch {
    failed++;
  }

  logger.info("cache_warmup_complete", {
    warmed,
    failed,
    durationMs: Date.now() - startMs,
  });
}
