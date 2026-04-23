import { Request, Response } from "express";
import { z } from "zod";
import { CleanAssetModel } from "../models/CleanAsset";
import { logger } from "../utils/logger";
import { CONFIG } from "../config";
import { buildScreenerCacheKey, getCachedRaw } from "../services/screenerCache.service";
import { trieSearchSymbols, isTrieReady } from "../services/trieSearch.service";
import { DEFAULT_VISIBLE_COLUMNS, SCREENER_TABS, SCREENER_TYPES, type ScreenerTabKey } from "../services/screener/screener.constants";
import { getScreenerFilterOptions, getScreenerMeta, getScreenerStats } from "../services/screener/screenerMeta.service";
import { getSymbolBySymbolOrFullSymbol, getSymbols } from "../services/screener/symbolQuery.service";
import type { ScreenerFiltersInput } from "../services/screener/screener.types";

/* ── Chart-service integration for screener chart data ── */

interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Map screener period strings to chart-service timeframe + bar count */
const PERIOD_CHART_MAP: Record<string, { timeframe: string; limit: number }> = {
  "1D":  { timeframe: "5m",  limit: 78  },  // 6.5 h × 12 bars/h
  "5D":  { timeframe: "30m", limit: 65  },  // 5 days × 13 bars/day
  "1M":  { timeframe: "1D",  limit: 22  },
  "3M":  { timeframe: "1D",  limit: 66  },
  "6M":  { timeframe: "1D",  limit: 132 },
  "YTD": { timeframe: "1D",  limit: 120 },
  "1Y":  { timeframe: "1W",  limit: 52  },
  "5Y":  { timeframe: "1W",  limit: 260 },
  "All": { timeframe: "1M",  limit: 120 },
};

function periodToDays(period: string): number {
  if (period === "1D") return 1;
  if (period === "5D") return 5;
  if (period === "1M") return 22;
  if (period === "3M") return 66;
  if (period === "6M") return 132;
  if (period === "YTD") return 120;
  if (period === "1Y") return 252;
  if (period === "5Y") return 252 * 5;
  return 120;
}

function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function symbolSeed(sym: string): number {
  let h = 5381;
  for (let i = 0; i < sym.length; i += 1) {
    h = (Math.imul(h, 33) ^ sym.charCodeAt(i)) >>> 0;
  }
  return h;
}

function generateFallbackCandles(symbol: string, currentPrice: number, changePercent: number, period: string) {
  const days = periodToDays(period);
  const rng = seededRng(symbolSeed(`${symbol}:${period}`));
  const candles: Array<{ time: string; open: number; high: number; low: number; close: number; volume: number }> = [];

  const endPrice = currentPrice > 0 ? currentPrice : 10;
  const startPrice = endPrice / (1 + changePercent / 100 || 1);
  let price = Math.max(startPrice, 0.01);
  const now = new Date();
  const volatility = Math.min(0.03 + Math.abs(changePercent) / 100 * 0.01, 0.06);

  for (let i = 0; i < days; i += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - 1 - i));
    const day = date.getDay();
    if (day === 0 || day === 6) continue;

    const change = (rng() - 0.48) * volatility * price;
    const open = price;
    const close = Math.max(open + change, 0.01);
    const high = Math.max(open, close) * (1 + rng() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - rng() * volatility * 0.5);
    const volume = Math.round((rng() * 900000 + 100000) * (endPrice / 100 || 1));

    candles.push({
      time: date.toISOString().slice(0, 10),
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume,
    });

    price = close;
  }

  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = Number(endPrice.toFixed(4));
    last.high = Math.max(last.high, last.close);
    last.low = Math.min(last.low, last.close);
  }

  return candles;
}

const LIVE_SCREENER_CACHE_TTL = {
  l1TtlMs: 4_000,
  l2TtlS: 8,
};

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
    }, LIVE_SCREENER_CACHE_TTL);

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
    console.log("[FILTER-OPTIONS] Handler called");
    const payload = await getScreenerFilterOptions();
    console.log("[FILTER-OPTIONS] Success");
    return res.json(payload);
  } catch (err) {
    const errMsg = (err as Error).message;
    console.log("[FILTER-OPTIONS] Error:", errMsg);
    logger.error("screener_filter_options_error", { error: errMsg });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function meta(_req: Request, res: Response) {
  try {
    console.log("[META] Handler called");
    const payload = await getScreenerMeta();
    console.log("[META] Success, keys:", Object.keys(payload));
    return res.json(payload);
  } catch (err) {
    const errMsg = (err as Error).message;
    console.log("[META] Error:", errMsg);
    logger.error("screener_meta_error", { error: errMsg });
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

export async function chartData(req: Request, res: Response) {
  try {
    const rawSymbols = (req.query.symbols as string) || "";
    const period = (req.query.period as string) || "5D";
    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;
    const symbols = rawSymbols
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 50); // hard cap per batch

    if (!symbols.length) return res.json({});

    // Determine chart query params
    let chartQuery: { timeframe: string; limit: number };
    if (fromParam && toParam) {
      // Custom date range: compute number of trading days and pick appropriate timeframe
      const fromMs = new Date(fromParam).getTime();
      const toMs = new Date(toParam).getTime();
      const daysDiff = Math.ceil((toMs - fromMs) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 5) chartQuery = { timeframe: "5m", limit: daysDiff * 78 };
      else if (daysDiff <= 30) chartQuery = { timeframe: "30m", limit: daysDiff * 13 };
      else if (daysDiff <= 365) chartQuery = { timeframe: "1D", limit: daysDiff };
      else chartQuery = { timeframe: "1W", limit: Math.ceil(daysDiff / 7) };
      // Cap limit
      chartQuery.limit = Math.min(chartQuery.limit, 2000);
    } else {
      chartQuery = PERIOD_CHART_MAP[period] ?? PERIOD_CHART_MAP["5D"];
    }
    // Use the configured chart service URL (defaults to http://127.0.0.1:3001 locally)
    const chartServiceBase = (CONFIG.chartServiceUrl ?? "http://127.0.0.1:3001")
      .replace(/\/api\/chart.*$/, "")
      .replace(/\/$/, "");

    // Fetch real candle data from chart-service via POST /multi
    // chart-service multi schema: { symbols: string[], timeframe, limit } — max 25 per batch
    let candlesBySymbol: Record<string, OHLCVCandle[]> = {};
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);
      const CHART_BATCH = 25;
      const batches: string[][] = [];
      for (let i = 0; i < symbols.length; i += CHART_BATCH) {
        batches.push(symbols.slice(i, i + CHART_BATCH));
      }
      await Promise.all(
        batches.map(async (batch) => {
          const body = JSON.stringify({
            symbols: batch,
            timeframe: chartQuery.timeframe,
            limit: chartQuery.limit,
          });
          const chartResp = await fetch(`${chartServiceBase}/api/chart/multi`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: ctrl.signal,
          });
          if (chartResp.ok) {
            const json = await chartResp.json() as { ok?: boolean; data?: Record<string, OHLCVCandle[]> };
            if (json?.ok && json.data) {
              Object.assign(candlesBySymbol, json.data);
            }
          } else {
            logger.warn("screener_chart_service_non_ok", { status: chartResp.status });
          }
        }),
      );
      clearTimeout(timer);
    } catch (err) {
      logger.warn("screener_chart_service_error", { error: (err as Error).message });
    }

    // Fetch symbol metadata for price/changePercent from DB
    const docs = await CleanAssetModel.find({
      $or: [{ fullSymbol: { $in: symbols } }, { symbol: { $in: symbols } }],
    })
      .select("symbol fullSymbol price changePercent")
      .lean();

    const docMap = new Map<string, { price: number; changePercent: number }>();
    for (const doc of docs) {
      const d = doc as unknown as { symbol: string; fullSymbol?: string; price?: number; changePercent?: number };
      const key = symbols.find((s) => s === d.fullSymbol) ?? d.symbol;
      docMap.set(key, { price: d.price ?? 0, changePercent: d.changePercent ?? 0 });
    }

    const result: Record<string, unknown> = {};
    for (const sym of symbols) {
      const meta = docMap.get(sym) ?? { price: 0, changePercent: 0 };
      const ohlcvs = candlesBySymbol[sym] ?? [];
      let candles = ohlcvs
        .filter((c) => c.timestamp && Number.isFinite(c.close) && c.close > 0)
        .map((c) => ({
          // Keep as ISO string — dataTransforms.toTimestamp handles it correctly
          time: new Date(c.timestamp).toISOString(),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }));

      if (candles.length === 0) {
        candles = generateFallbackCandles(sym, meta.price, meta.changePercent, period);
      }

      result[sym] = {
        symbol: sym,
        currentPrice: meta.price,
        changePercent: meta.changePercent,
        candles,
      };
    }

    return res.json(result);
  } catch (err) {
    logger.error("screener_chart_data_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}