import { Request, Response } from "express";
import { z } from "zod";
import { CleanAssetModel } from "../models/CleanAsset";
import { logger } from "../utils/logger";
import { buildScreenerCacheKey, getCachedRaw } from "../services/screenerCache.service";
import { trieSearchSymbols, isTrieReady } from "../services/trieSearch.service";
import { DEFAULT_VISIBLE_COLUMNS, SCREENER_TABS, SCREENER_TYPES, type ScreenerTabKey } from "../services/screener/screener.constants";
import { getScreenerFilterOptions, getScreenerMeta, getScreenerStats } from "../services/screener/screenerMeta.service";
import { getSymbolBySymbolOrFullSymbol, getSymbols } from "../services/screener/symbolQuery.service";
import type { ScreenerFiltersInput } from "../services/screener/screener.types";

const listSchema = z.object({
  type: z.string().optional(),
  q: z.string().optional(),
  tab: z.string().optional(),
  columns: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().default("marketCap"),
  order: z.enum(["asc", "desc"]).default("desc"),

  marketCountries: z.string().optional(),
  exchanges: z.string().optional(),
  watchlists: z.string().optional(),
  indices: z.string().optional(),
  primaryListing: z.coerce.boolean().optional(),

  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  changePercentMin: z.coerce.number().optional(),
  changePercentMax: z.coerce.number().optional(),
  marketCapMin: z.coerce.number().optional(),
  marketCapMax: z.coerce.number().optional(),
  peMin: z.coerce.number().optional(),
  peMax: z.coerce.number().optional(),
  epsDilGrowthMin: z.coerce.number().optional(),
  epsDilGrowthMax: z.coerce.number().optional(),
  divYieldPercentMin: z.coerce.number().optional(),
  divYieldPercentMax: z.coerce.number().optional(),
  perfPercentMin: z.coerce.number().optional(),
  perfPercentMax: z.coerce.number().optional(),
  revenueGrowthMin: z.coerce.number().optional(),
  revenueGrowthMax: z.coerce.number().optional(),
  pegMin: z.coerce.number().optional(),
  pegMax: z.coerce.number().optional(),
  roeMin: z.coerce.number().optional(),
  roeMax: z.coerce.number().optional(),
  betaMin: z.coerce.number().optional(),
  betaMax: z.coerce.number().optional(),

  sectors: z.string().optional(),
  analystRatings: z.string().optional(),

  recentEarningsFrom: z.string().optional(),
  recentEarningsTo: z.string().optional(),
  upcomingEarningsFrom: z.string().optional(),
  upcomingEarningsTo: z.string().optional(),

  country: z.string().optional(),
  sector: z.string().optional(),
  exchange: z.string().optional(),
  primary: z.string().optional(),
});

function parseCsv(input?: string): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseRange(min?: number, max?: number): { min?: number; max?: number } | undefined {
  if (min === undefined && max === undefined) return undefined;
  return { min, max };
}

function parseDateRange(from?: string, to?: string): { from?: string; to?: string } | undefined {
  if (!from && !to) return undefined;
  return { from, to };
}

function normalizeType(inputType?: string): (typeof SCREENER_TYPES)[number]["routeType"] {
  if (!inputType) return "stocks";
  const normalized = inputType.trim().toLowerCase();

  if (SCREENER_TYPES.some((entry) => entry.routeType === normalized)) {
    return normalized as (typeof SCREENER_TYPES)[number]["routeType"];
  }

  if (normalized === "stock") return "stocks";
  if (normalized === "etf") return "etfs";
  if (normalized === "bond") return "bonds";
  if (normalized === "crypto") return "crypto-coins";
  if (normalized === "cex") return "cex-pairs";
  if (normalized === "dex") return "dex-pairs";
  if (normalized === "option" || normalized === "options") return "options";
  if (normalized === "future" || normalized === "futures") return "futures";
  if (normalized === "forex" || normalized === "fx") return "forex";
  if (normalized === "index" || normalized === "indices") return "indices";

  return "stocks";
}

function normalizeTab(inputTab?: string): ScreenerTabKey {
  if (!inputTab) return "overview";
  const normalized = inputTab.trim().toLowerCase();
  return SCREENER_TABS.some((tab) => tab.key === normalized) ? (normalized as ScreenerTabKey) : "overview";
}

function buildFilters(input: z.infer<typeof listSchema>): ScreenerFiltersInput {
  const legacyCountry = input.country ? [input.country] : [];
  const marketCountries = parseCsv(input.marketCountries);
  const countryValues = marketCountries.length > 0 ? marketCountries : legacyCountry;

  const legacySector = input.sector ? [input.sector] : [];
  const sectorValues = parseCsv(input.sectors);

  const analystRatings = parseCsv(input.analystRatings);
  const exchanges = parseCsv(input.exchanges || input.exchange);
  const watchlists = parseCsv(input.watchlists);
  const indices = parseCsv(input.indices);

  const primaryListingOnly =
    input.primaryListing
    || input.primary === "true"
    || input.primary === "1"
    || false;

  return {
    marketCountries: countryValues,
    exchanges,
    watchlists,
    indices,
    primaryListingOnly,

    price: parseRange(input.priceMin, input.priceMax),
    changePercent: parseRange(input.changePercentMin, input.changePercentMax),
    marketCap: parseRange(input.marketCapMin, input.marketCapMax),
    pe: parseRange(input.peMin, input.peMax),
    epsDilGrowth: parseRange(input.epsDilGrowthMin, input.epsDilGrowthMax),
    divYieldPercent: parseRange(input.divYieldPercentMin, input.divYieldPercentMax),
    perfPercent: parseRange(input.perfPercentMin, input.perfPercentMax),
    revenueGrowth: parseRange(input.revenueGrowthMin, input.revenueGrowthMax),
    peg: parseRange(input.pegMin, input.pegMax),
    roe: parseRange(input.roeMin, input.roeMax),
    beta: parseRange(input.betaMin, input.betaMax),

    sector: sectorValues.length > 0 ? sectorValues : legacySector,
    analystRating: analystRatings,

    recentEarningsDate: parseDateRange(input.recentEarningsFrom, input.recentEarningsTo),
    upcomingEarningsDate: parseDateRange(input.upcomingEarningsFrom, input.upcomingEarningsTo),
  };
}

export async function list(req: Request, res: Response) {
  try {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid parameters", details: parsed.error.issues });
    }

    const input = parsed.data;
    const screenerType = normalizeType(input.type);
    const tab = normalizeTab(input.tab);
    const selectedColumns = parseCsv(input.columns);
    const filters = buildFilters(input);

    const cacheParams: Record<string, unknown> = {
      type: screenerType,
      q: input.q || "",
      tab,
      columns: selectedColumns.join(","),
      limit: input.limit,
      offset: input.offset,
      sort: input.sort,
      order: input.order,

      marketCountries: filters.marketCountries.join(","),
      exchanges: filters.exchanges.join(","),
      watchlists: filters.watchlists.join(","),
      indices: filters.indices.join(","),
      primaryListingOnly: filters.primaryListingOnly ? "1" : "0",

      priceMin: filters.price?.min,
      priceMax: filters.price?.max,
      changePercentMin: filters.changePercent?.min,
      changePercentMax: filters.changePercent?.max,
      marketCapMin: filters.marketCap?.min,
      marketCapMax: filters.marketCap?.max,
      peMin: filters.pe?.min,
      peMax: filters.pe?.max,
      epsDilGrowthMin: filters.epsDilGrowth?.min,
      epsDilGrowthMax: filters.epsDilGrowth?.max,
      divYieldPercentMin: filters.divYieldPercent?.min,
      divYieldPercentMax: filters.divYieldPercent?.max,
      perfPercentMin: filters.perfPercent?.min,
      perfPercentMax: filters.perfPercent?.max,
      revenueGrowthMin: filters.revenueGrowth?.min,
      revenueGrowthMax: filters.revenueGrowth?.max,
      pegMin: filters.peg?.min,
      pegMax: filters.peg?.max,
      roeMin: filters.roe?.min,
      roeMax: filters.roe?.max,
      betaMin: filters.beta?.min,
      betaMax: filters.beta?.max,

      sectors: filters.sector.join(","),
      analystRatings: filters.analystRating.join(","),

      recentEarningsFrom: filters.recentEarningsDate?.from,
      recentEarningsTo: filters.recentEarningsDate?.to,
      upcomingEarningsFrom: filters.upcomingEarningsDate?.from,
      upcomingEarningsTo: filters.upcomingEarningsDate?.to,
    };

    const cacheKey = buildScreenerCacheKey(cacheParams);

    const json = await getCachedRaw(cacheKey, async () => {
      const result = await getSymbols({
        type: screenerType,
        query: input.q,
        filters,
        sortField: input.sort,
        sortOrder: input.order,
        offset: input.offset,
        limit: input.limit,
        tab,
        selectedColumns: selectedColumns.length > 0 ? selectedColumns : DEFAULT_VISIBLE_COLUMNS,
      });
      return JSON.stringify(result);
    });

    return res.type("json").send(json);
  } catch (err) {
    logger.error("screener_list_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function stats(_req: Request, res: Response) {
  try {
    const payload = await getScreenerStats();
    return res.json(payload);
  } catch (err) {
    logger.error("screener_stats_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function symbolDetail(req: Request, res: Response) {
  try {
    const { symbol } = req.params;
    if (!symbol) return res.status(400).json({ error: "symbol required" });

    const result = await getSymbolBySymbolOrFullSymbol(decodeURIComponent(String(symbol)));
    if (!result) return res.status(404).json({ error: "Symbol not found" });

    return res.json(result);
  } catch (err) {
    logger.error("screener_symbol_detail_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function filterOptions(_req: Request, res: Response) {
  try {
    const payload = await getScreenerFilterOptions();
    return res.json(payload);
  } catch (err) {
    logger.error("screener_filter_options_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function meta(_req: Request, res: Response) {
  try {
    const payload = await getScreenerMeta();
    return res.json(payload);
  } catch (err) {
    logger.error("screener_meta_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function fastSearch(req: Request, res: Response) {
  try {
    const q = (req.query.q as string || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);

    if (!q) {
      return res.json({ items: [], total: 0 });
    }

    if (!isTrieReady()) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const docs = await CleanAssetModel.find({
        $or: [
          { symbol: { $regex: `^${escaped}`, $options: "i" } },
          { name: { $regex: escaped, $options: "i" } },
        ],
      })
        .sort({ priorityScore: -1 })
        .limit(limit)
        .select("symbol fullSymbol name exchange country type iconUrl s3Icon priorityScore isPrimaryListing marketCap")
        .lean();

      return res.json({
        items: docs.map((doc) => ({
          symbol: doc.symbol,
          fullSymbol: doc.fullSymbol,
          name: doc.name,
          exchange: doc.exchange,
          country: doc.country || "",
          type: doc.type,
          iconUrl: doc.s3Icon || doc.iconUrl || "",
          priorityScore: doc.priorityScore || 0,
          isPrimaryListing: (doc as { isPrimaryListing?: boolean }).isPrimaryListing || false,
          marketCap: doc.marketCap || 0,
        })),
        total: docs.length,
        source: "mongodb_fallback",
      });
    }

    const results = trieSearchSymbols(q, limit);
    return res.json({
      items: results,
      total: results.length,
      source: "trie",
    });
  } catch (err) {
    logger.error("screener_fast_search_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}