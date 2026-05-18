import { Request, Response } from "express";
import { CleanAssetModel } from "../models/CleanAsset";
import { logger } from "../utils/logger";
import { CONFIG } from "../config";
import { buildScreenerCacheKey, getCachedRaw } from "../services/screenerCache.service";
import { trieSearchSymbols, isTrieReady } from "../services/trieSearch.service";
import { DEFAULT_VISIBLE_COLUMNS } from "../services/screener/screener.constants";
import { getScreenerFilterOptions, getScreenerMeta, getScreenerStats } from "../services/screener/screenerMeta.service";
import { getSymbolBySymbolOrFullSymbol, getSymbols } from "../services/screener/symbolQuery.service";
import {
  type OHLCVCandle,
  PERIOD_CHART_MAP,
  LIVE_SCREENER_CACHE_TTL,
  listSchema,
  parseCsv,
  normalizeType,
  normalizeTab,
  buildFilters,
  generateFallbackCandles,
} from "./screener.helpers";

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
      type: screenerType, q: input.q || "", tab,
      columns: selectedColumns.join(","),
      limit: input.limit, offset: input.offset, sort: input.sort, order: input.order,
      marketCountries: filters.marketCountries.join(","),
      exchanges: filters.exchanges.join(","),
      watchlists: filters.watchlists.join(","),
      indices: filters.indices.join(","),
      primaryListingOnly: filters.primaryListingOnly ? "1" : "0",
      priceMin: filters.price?.min, priceMax: filters.price?.max,
      changePercentMin: filters.changePercent?.min, changePercentMax: filters.changePercent?.max,
      marketCapMin: filters.marketCap?.min, marketCapMax: filters.marketCap?.max,
      peMin: filters.pe?.min, peMax: filters.pe?.max,
      epsDilGrowthMin: filters.epsDilGrowth?.min, epsDilGrowthMax: filters.epsDilGrowth?.max,
      divYieldPercentMin: filters.divYieldPercent?.min, divYieldPercentMax: filters.divYieldPercent?.max,
      perfPercentMin: filters.perfPercent?.min, perfPercentMax: filters.perfPercent?.max,
      revenueGrowthMin: filters.revenueGrowth?.min, revenueGrowthMax: filters.revenueGrowth?.max,
      pegMin: filters.peg?.min, pegMax: filters.peg?.max,
      roeMin: filters.roe?.min, roeMax: filters.roe?.max,
      betaMin: filters.beta?.min, betaMax: filters.beta?.max,
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
    return res.json(await getScreenerStats());
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
    return res.json(await getScreenerFilterOptions());
  } catch (err) {
    logger.error("screener_filter_options_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function meta(_req: Request, res: Response) {
  try {
    return res.json(await getScreenerMeta());
  } catch (err) {
    logger.error("screener_meta_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function fastSearch(req: Request, res: Response) {
  try {
    const q = (req.query.q as string || "").trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);

    if (!q) return res.json({ items: [], total: 0 });

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
    return res.json({ items: results, total: results.length, source: "trie" });
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
    const symbols = rawSymbols.split(",").map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 50);

    if (!symbols.length) return res.json({});

    let chartQuery: { timeframe: string; limit: number };
    if (fromParam && toParam) {
      const daysDiff = Math.ceil((new Date(toParam).getTime() - new Date(fromParam).getTime()) / 86400000);
      if (daysDiff <= 5) chartQuery = { timeframe: "5m", limit: daysDiff * 78 };
      else if (daysDiff <= 30) chartQuery = { timeframe: "30m", limit: daysDiff * 13 };
      else if (daysDiff <= 365) chartQuery = { timeframe: "1D", limit: daysDiff };
      else chartQuery = { timeframe: "1W", limit: Math.ceil(daysDiff / 7) };
      chartQuery.limit = Math.min(chartQuery.limit, 2000);
    } else {
      chartQuery = PERIOD_CHART_MAP[period] ?? PERIOD_CHART_MAP["5D"];
    }

    const chartServiceBase = (CONFIG.chartServiceUrl ?? "http://127.0.0.1:3001")
      .replace(/\/api\/chart.*$/, "").replace(/\/$/, "");

    let candlesBySymbol: Record<string, OHLCVCandle[]> = {};
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000);
      const CHART_BATCH = 25;
      const batches: string[][] = [];
      for (let i = 0; i < symbols.length; i += CHART_BATCH) batches.push(symbols.slice(i, i + CHART_BATCH));

      await Promise.all(batches.map(async (batch) => {
        const chartResp = await fetch(`${chartServiceBase}/api/chart/multi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: batch, timeframe: chartQuery.timeframe, limit: chartQuery.limit }),
          signal: ctrl.signal,
        });
        if (chartResp.ok) {
          const json = await chartResp.json() as { ok?: boolean; data?: Record<string, OHLCVCandle[]> };
          if (json?.ok && json.data) Object.assign(candlesBySymbol, json.data);
        } else {
          logger.warn("screener_chart_service_non_ok", { status: chartResp.status });
        }
      }));
      clearTimeout(timer);
    } catch (err) {
      logger.warn("screener_chart_service_error", { error: (err as Error).message });
    }

    const docs = await CleanAssetModel.find({
      $or: [{ fullSymbol: { $in: symbols } }, { symbol: { $in: symbols } }],
    }).select("symbol fullSymbol price changePercent").lean();

    const docMap = new Map<string, { price: number; changePercent: number }>();
    for (const doc of docs) {
      const d = doc as unknown as { symbol: string; fullSymbol?: string; price?: number; changePercent?: number };
      const key = symbols.find((s) => s === d.fullSymbol) ?? d.symbol;
      docMap.set(key, { price: d.price ?? 0, changePercent: d.changePercent ?? 0 });
    }

    const result: Record<string, unknown> = {};
    for (const sym of symbols) {
      const symMeta = docMap.get(sym) ?? { price: 0, changePercent: 0 };
      const ohlcvs = candlesBySymbol[sym] ?? [];
      let candles = ohlcvs
        .filter((c) => c.timestamp && Number.isFinite(c.close) && c.close > 0)
        .map((c) => ({
          time: new Date(c.timestamp).toISOString(),
          open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
        }));

      if (candles.length === 0) {
        candles = generateFallbackCandles(sym, symMeta.price, symMeta.changePercent, period);
      }

      result[sym] = { symbol: sym, currentPrice: symMeta.price, changePercent: symMeta.changePercent, candles };
    }

    return res.json(result);
  } catch (err) {
    logger.error("screener_chart_data_error", { error: (err as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
}
