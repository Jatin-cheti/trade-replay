/**
 * cacheWarmup.service.ts — Non-blocking boot-time cache warmup.
 *
 * Prewarms L1+L2 caches for the most common screener queries
 * so the first user request is fast instead of cold.
 *
 * Called from server.ts after perf infra is initialized.
 * Runs in background — server starts listening immediately.
 */
import { CleanAssetModel } from "../models/CleanAsset";
import { buildScreenerCacheKey, getCachedRaw } from "./screenerCache.service";
import { enrichScreenerBatch } from "./symbolAggregation.service";
import { getFilterIndex } from "./filterCache.service";
import { logger } from "../utils/logger";

/* ── Warmup Queries ───────────────────────────────────────────────── */

interface WarmupQuery {
  label: string;
  params: Record<string, unknown>;
}

const WARMUP_QUERIES: WarmupQuery[] = [
  { label: "default",  params: { limit: 200, offset: 0, sort: "priorityScore", order: "desc" } },
  { label: "stock",    params: { limit: 200, offset: 0, sort: "priorityScore", order: "desc", type: "stock" } },
  { label: "crypto",   params: { limit: 200, offset: 0, sort: "priorityScore", order: "desc", type: "crypto" } },
  { label: "etf",      params: { limit: 200, offset: 0, sort: "priorityScore", order: "desc", type: "etf" } },
  { label: "forex",    params: { limit: 200, offset: 0, sort: "priorityScore", order: "desc", type: "forex" } },
  { label: "index",    params: { limit: 200, offset: 0, sort: "priorityScore", order: "desc", type: "index" } },
  { label: "page2",    params: { limit: 200, offset: 200, sort: "priorityScore", order: "desc" } },
];

/* ── Fetcher (mirrors screenerController.list logic) ─────────────── */

async function fetchScreenerPage(params: Record<string, unknown>): Promise<string> {
  const query: Record<string, unknown> = {};
  if (params.type) query.type = params.type;

  const limit = (params.limit as number) || 200;
  const offset = (params.offset as number) || 0;
  const sortField = (params.sort as string) || "priorityScore";
  const sortDir = params.order === "asc" ? 1 : -1;

  const [docs, total] = await Promise.all([
    CleanAssetModel.find(query)
      .sort({ [sortField]: sortDir })
      .skip(offset)
      .limit(limit)
      .lean(),
    CleanAssetModel.countDocuments(query),
  ]);

  const enriched = await enrichScreenerBatch(
    docs.map((d: any) => ({
      symbol: d.symbol,
      fullSymbol: d.fullSymbol,
      name: d.name,
      exchange: d.exchange,
      country: d.country,
      type: d.type,
      iconUrl: d.s3Icon || d.iconUrl || "",
      s3Icon: d.s3Icon || "",
      companyDomain: d.companyDomain || "",
      sector: d.sector || "",
      source: d.source || "",
      currency: d.currency || "USD",
      priorityScore: d.priorityScore || 0,
      isPrimaryListing: d.isPrimaryListing || false,
      marketCap: d.marketCap || 0,
    })),
  );

  return JSON.stringify({ items: enriched, total, limit, offset });
}

/* ── Main Warmup Function ─────────────────────────────────────────── */

export async function warmScreenerCache(): Promise<void> {
  const startMs = Date.now();
  let warmed = 0;
  let failed = 0;

  for (const wq of WARMUP_QUERIES) {
    try {
      const key = buildScreenerCacheKey(wq.params);
      await getCachedRaw(key, () => fetchScreenerPage(wq.params));
      warmed++;
    } catch (err) {
      failed++;
      logger.warn("cache_warmup_query_failed", {
        label: wq.label,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    // Yield to event loop between queries
    await new Promise<void>((r) => setImmediate(r));
  }

  // Also warm the filter index
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
