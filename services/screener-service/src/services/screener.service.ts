import { CleanAssetModel } from "../models/CleanAsset.js";
import { getRedis } from "../config/redis.js";
import type { PipelineStage } from "mongoose";

const CACHE_TTL_S = 8;

/* ── Field mapping: frontend column key → DB field name ── */
const FIELD_TO_DB: Record<string, string> = {
  epsDilTtm: "eps",
  epsDilGrowth: "earningsGrowth",
  divYieldPercent: "dividendYield",
  // price: identity — both US stocks ("price") and India stocks ("price" via mapItem alias) use the same DB field
};
const DB_TO_FIELD: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_TO_DB).map(([k, v]) => [v, k]),
);
function toDbField(frontendKey: string): string { return FIELD_TO_DB[frontendKey] || frontendKey; }

/** Map a raw DB doc to screener-friendly shape */
function mapItem(doc: Record<string, unknown>): Record<string, unknown> {
  const out = { ...doc };
  // Computed fields
  if (typeof out.volume === "number" && typeof out.avgVolume === "number" && (out.avgVolume as number) > 0)
    out.relVolume = (out.volume as number) / (out.avgVolume as number);
  // Alias DB fields → frontend column names
  for (const [dbKey, feKey] of Object.entries(DB_TO_FIELD)) {
    if (out[dbKey] !== undefined && out[feKey] === undefined) out[feKey] = out[dbKey];
  }
  // Ensure price alias: India stocks store price as currentPrice
  if (out.currentPrice !== undefined && (out.price === undefined || out.price === 0))
    out.price = out.currentPrice;
  // Ensure epsDilGrowth alias: enrichment writes to epsGrowth (legacy US) or earningsGrowth (canonical)
  if (out.epsGrowth !== undefined && out.epsDilGrowth === undefined)
    out.epsDilGrowth = out.epsGrowth;
  if (out.earningsGrowth !== undefined && out.epsDilGrowth === undefined)
    out.epsDilGrowth = out.earningsGrowth;
  // Compute change/changePercent from price and previousClose
  const price = out.price as number | undefined;
  const prevClose = out.previousClose as number | undefined;
  if (typeof price === "number" && typeof prevClose === "number" && prevClose > 0) {
    if (out.change === undefined) out.change = price - prevClose;
    if (out.changePercent === undefined) out.changePercent = ((price - prevClose) / prevClose) * 100;
  }
  return out;
}

/* ── Dedup: prefer NSE over BSE for India stocks ── */
const EXCHANGE_PRIORITY: Record<string, number> = { NSE: 10, BSE: 5 };
function dedupItems(items: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    const sym = item.symbol as string;
    const country = item.country as string;
    // Only dedup Indian stocks that share a symbol
    if (country === "IN") {
      const existing = seen.get(sym);
      if (existing) {
        const existPrio = EXCHANGE_PRIORITY[existing.exchange as string] || 1;
        const newPrio = EXCHANGE_PRIORITY[item.exchange as string] || 1;
        if (newPrio > existPrio) seen.set(sym, item);
        continue;
      }
    }
    const key = country === "IN" ? sym : (item.fullSymbol as string);
    if (!seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
}

interface ListParams {
  type: string;
  query?: string;
  countries: string[];
  exchanges: string[];
  sectors: string[];
  analystRatings: string[];
  primaryOnly: boolean;
  ranges: Record<string, { min?: number; max?: number }>;
  sort: string;
  order: "asc" | "desc";
  limit: number;
  offset: number;
}

export async function listScreenerAssets(params: ListParams) {
  const cacheKey = `scr:list:${JSON.stringify(params)}`;
  const redis = getRedis();

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const typeMap: Record<string, string[]> = {
    // Plural/long-form (frontend canonical)
    stocks: ["stock"], etfs: ["etf"], "crypto-coins": ["crypto"],
    forex: ["forex"], indices: ["index"], futures: ["futures"],
    bonds: ["bond"], options: ["options"],
    // Singular aliases (accept REST-style ?type=crypto)
    stock: ["stock"], etf: ["etf"], crypto: ["crypto"],
    index: ["index"], bond: ["bond"], option: ["options"],
  };

  const filter: Record<string, unknown> = { isActive: true };
  const assetTypes = typeMap[params.type] || ["stock"];
  filter.type = assetTypes.length === 1 ? assetTypes[0] : { $in: assetTypes };

  if (params.countries.length) filter.country = { $in: params.countries.map((c) => c.toUpperCase()) };
  if (params.exchanges.length) filter.exchange = { $in: params.exchanges.map((e) => e.toUpperCase()) };
  if (params.sectors.length) {
    // Case-insensitive sector match — capitalize first letter of each word to match DB storage
    const normalizedSectors = params.sectors.map((s) =>
      s.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    );
    filter.sector = { $in: normalizedSectors };
  }
  if (params.analystRatings.length) filter.analystRating = { $in: params.analystRatings };
  if (params.primaryOnly) filter.isPrimaryListing = true;

  // Apply all range filters (marketCap, pe, price, beta, etc.)
  for (const [feKey, range] of Object.entries(params.ranges)) {
    const dbKey = toDbField(feKey);
    const cond: Record<string, number> = {};
    if (range.min !== undefined) cond.$gte = range.min;
    if (range.max !== undefined) cond.$lte = range.max;
    if (Object.keys(cond).length) filter[dbKey] = cond;
  }

  if (params.query) {
    const escaped = params.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { symbol: { $regex: `^${escaped}`, $options: "i" } },
      { name: { $regex: escaped, $options: "i" } },
    ];
  }

  const dbSortField = toDbField(params.sort);
  const sortObj: Record<string, 1 | -1> = { [dbSortField]: params.order === "asc" ? 1 : -1 };

  // For India dedup: fetch extra to account for duplicates we'll remove
  const needsDedup = params.countries.length > 0 && params.countries.includes("IN") && assetTypes.includes("stock");
  const fetchLimit = needsDedup ? params.limit * 2 : params.limit;
  const fetchOffset = needsDedup ? 0 : params.offset;

  let items: Record<string, unknown>[];
  let total: number;

  if (needsDedup) {
    // Use aggregation with dedup for India stocks
    const pipeline: PipelineStage[] = [
      { $match: filter },
      // Sort NSE first (exchange ascending: "NSE" < others alphabetically is not guaranteed, use addFields)
      { $addFields: {
        _exchangePrio: { $switch: {
          branches: [
            { case: { $eq: ["$exchange", "NSE"] }, then: 1 },
            { case: { $eq: ["$exchange", "BSE"] }, then: 2 },
          ],
          default: 3,
        }},
      }},
      { $sort: { _exchangePrio: 1 as const, ...sortObj } },
      // Strip .NS/.BO suffixes for dedup grouping, then pick the best exchange per symbol
      { $addFields: {
        _dedupKey: {
          $replaceAll: { input: { $replaceAll: { input: "$symbol", find: ".NS", replacement: "" } }, find: ".BO", replacement: "" }
        },
      }},
      { $group: {
        _id: { country: "$country", key: "$_dedupKey" },
        doc: { $first: "$$ROOT" },
        exchanges: { $push: "$exchange" },
        count: { $sum: 1 },
      }},
      { $replaceRoot: { newRoot: "$doc" } },
      // Push nulls to end: _hasSort=1 if field has a value, 0 otherwise
      { $addFields: { _hasSort: { $cond: [{ $ifNull: [`$${dbSortField}`, false] }, 1, 0] } } },
      { $sort: { _hasSort: -1, ...sortObj } },
    ];
    const countPipeline: PipelineStage[] = [...pipeline, { $count: "total" }];
    const dataPipeline: PipelineStage[] = [...pipeline, { $skip: params.offset }, { $limit: params.limit }];
    const [dataResult, countResult] = await Promise.all([
      CleanAssetModel.aggregate(dataPipeline),
      CleanAssetModel.aggregate(countPipeline),
    ]);
    items = dataResult;
    total = countResult[0]?.total || 0;
  } else {
    const [rawItems, rawTotal] = await Promise.all([
      CleanAssetModel.find(filter).sort(sortObj).skip(params.offset).limit(params.limit).lean(),
      CleanAssetModel.countDocuments(filter),
    ]);
    items = rawItems as Record<string, unknown>[];
    total = rawTotal;
  }

  // Map fields
  const mapped = items.map(mapItem);

  const result = { items: mapped, total, returned: mapped.length, limit: params.limit, offset: params.offset, hasMore: params.offset + params.limit < total };

  try { await redis.setex(cacheKey, CACHE_TTL_S, JSON.stringify(result)); } catch {}

  return result;
}

export async function getScreenerStats() {
  const [total, typeAgg, countryAgg, sectorAgg, exchangeAgg] = await Promise.all([
    CleanAssetModel.estimatedDocumentCount(),
    CleanAssetModel.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
    CleanAssetModel.aggregate([{ $group: { _id: "$country", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 50 }]),
    CleanAssetModel.aggregate([{ $match: { sector: { $ne: "" } } }, { $group: { _id: "$sector", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    CleanAssetModel.aggregate([{ $group: { _id: "$exchange", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 50 }]),
  ]);

  const toMap = (agg: { _id: string; count: number }[]) => agg.reduce((m, r) => ({ ...m, [r._id]: r.count }), {} as Record<string, number>);

  return {
    total,
    byType: toMap(typeAgg),
    countries: countryAgg.map((r) => r._id as string),
    exchanges: exchangeAgg.map((r) => r._id as string),
    sectors: sectorAgg.map((r) => r._id as string),
  };
}

export async function fastSearchAssets(query: string, limit: number) {
  if (!query) return { items: [], total: 0 };
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  return { items: docs, total: docs.length };
}

export async function getSymbolDetail(symbol: string) {
  const normalized = symbol.toUpperCase();

  const exact = await CleanAssetModel.findOne({ fullSymbol: normalized }).lean();
  if (exact) return mapItem(exact as Record<string, unknown>);

  const preferredIndia = await CleanAssetModel.findOne({ symbol: normalized, exchange: "NSE" })
    .sort({ isPrimaryListing: -1, priorityScore: -1 })
    .lean();
  if (preferredIndia) return mapItem(preferredIndia as Record<string, unknown>);

  const doc = await CleanAssetModel.findOne({ symbol: normalized })
    .sort({ isPrimaryListing: -1, priorityScore: -1 })
    .lean();
  return doc ? mapItem(doc as Record<string, unknown>) : null;
}

/* ── Screener Meta ── */
export async function getScreenerMeta() {
  const redis = getRedis();
  const cacheKey = "scr:meta";
  try { const c = await redis.get(cacheKey); if (c) return JSON.parse(c); } catch {}

  const [sectorAgg, exchangeAgg, countryAgg] = await Promise.all([
    CleanAssetModel.aggregate([{ $match: { sector: { $ne: "" } } }, { $group: { _id: "$sector", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    CleanAssetModel.aggregate([{ $group: { _id: "$exchange", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 50 }]),
    CleanAssetModel.aggregate([{ $group: { _id: "$country", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 50 }]),
  ]);

  const countries = countryAgg
    .filter((r) => typeof r._id === "string" && r._id)
    .map((r: any) => ({ value: r._id, label: r._id }));
  const sectors = sectorAgg
    .filter((r) => typeof r._id === "string" && r._id)
    .map((r: any) => ({ value: r._id, label: r._id }));
  const exchanges = exchangeAgg
    .filter((r) => typeof r._id === "string" && r._id)
    .map((r: any) => r._id);

  const result = {
    screenerTypes: [
      { routeType: "stocks", label: "Stock Screener" },
      { routeType: "etfs", label: "ETF Screener" },
      { routeType: "bonds", label: "Bond Screener" },
      { routeType: "crypto-coins", label: "Crypto Coins Screener" },
      { routeType: "options", label: "Options Screener" },
      { routeType: "futures", label: "Futures Screener" },
      { routeType: "forex", label: "Forex Screener" },
      { routeType: "indices", label: "Indices Screener" },
    ],
    heatmapTypes: [
      { label: "Stocks", routeType: "stocks" },
      { label: "ETFs", routeType: "etfs" },
      { label: "Crypto coins", routeType: "crypto-coins" },
    ],
    tabs: [
      { key: "overview", label: "Overview", defaultColumns: ["symbol","price","changePercent","volume","relVolume","marketCap","pe","epsDilTtm","epsDilGrowth","divYieldPercent","sector","analystRating"] },
      { key: "performance", label: "Performance", defaultColumns: ["symbol","price","changePercent","perfPercent","volume","relVolume","marketCap","beta"] },
      { key: "valuation", label: "Valuation", defaultColumns: ["symbol","price","marketCap","pe","peg","priceToBook","epsDilTtm","divYieldPercent","revenue","revenueGrowth"] },
      { key: "dividends", label: "Dividends", defaultColumns: ["symbol","price","divYieldPercent","marketCap","sector"] },
      { key: "profitability", label: "Profitability", defaultColumns: ["symbol","price","grossMargin","operatingMargin","profitMargin","roe","revenue"] },
      { key: "income-statement", label: "Income Statement", defaultColumns: ["symbol","price","revenue","netIncome","epsDilTtm","epsDilGrowth","sector"] },
      { key: "balance-sheet", label: "Balance Sheet", defaultColumns: ["symbol","price","marketCap","sharesFloat","beta"] },
    ],
    filterCategories: [
      { key: "security-info", label: "Security info" },
      { key: "market-data", label: "Market data" },
      { key: "technicals", label: "Technicals" },
      { key: "financials", label: "Financials" },
      { key: "valuation", label: "Valuation" },
      { key: "growth", label: "Growth" },
      { key: "margins", label: "Margins" },
      { key: "dividends", label: "Dividends" },
    ],
    columnFields: [
      { key: "symbol", label: "Symbol", category: "security-info" },
      { key: "price", label: "Price", category: "market-data" },
      { key: "changePercent", label: "Change %", category: "market-data" },
      { key: "volume", label: "Volume", category: "market-data" },
      { key: "relVolume", label: "Rel Volume", category: "market-data" },
      { key: "marketCap", label: "Market cap", category: "market-data" },
      { key: "pe", label: "P/E", category: "valuation" },
      { key: "epsDilTtm", label: "EPS dil TTM", category: "valuation" },
      { key: "epsDilGrowth", label: "EPS dil growth", category: "growth" },
      { key: "divYieldPercent", label: "Div yield %", category: "dividends" },
      { key: "sector", label: "Sector", category: "security-info" },
      { key: "analystRating", label: "Analyst Rating", category: "valuation" },
      { key: "perfPercent", label: "Perf %", category: "market-data" },
      { key: "revenueGrowth", label: "Revenue growth", category: "growth" },
      { key: "peg", label: "PEG", category: "valuation" },
      { key: "roe", label: "ROE", category: "profitability" },
      { key: "beta", label: "Beta", category: "market-data" },
      { key: "recentEarningsDate", label: "Recent earnings date", category: "financials" },
      { key: "upcomingEarningsDate", label: "Upcoming earnings date", category: "financials" },
      { key: "exchange", label: "Exchange", category: "security-info" },
      { key: "country", label: "Country", category: "security-info" },
      { key: "currency", label: "Currency", category: "security-info" },
      { key: "revenue", label: "Revenue", category: "financials" },
      { key: "grossMargin", label: "Gross margin", category: "profitability" },
      { key: "operatingMargin", label: "Operating margin", category: "profitability" },
      { key: "profitMargin", label: "Profit margin", category: "profitability" },
      { key: "priceToBook", label: "Price to book", category: "valuation" },
    ],
    filterFields: [
      { key: "marketCountries", label: "Market Countries", category: "market-data", inputType: "multiselect", supportsMultiSelect: true, options: countries },
      { key: "exchanges", label: "Exchanges", category: "market-data", inputType: "multiselect", supportsMultiSelect: true, options: exchanges.map((value) => ({ value, label: value })) },
      { key: "sector", label: "Sector", category: "security-info", inputType: "multiselect", supportsMultiSelect: true, options: sectors },
      { key: "analystRating", label: "Analyst Rating", category: "technicals", inputType: "multiselect", supportsMultiSelect: true, options: [
        { value: "strong-buy", label: "Strong buy" },
        { value: "buy", label: "Buy" },
        { value: "neutral", label: "Neutral" },
        { value: "sell", label: "Sell" },
        { value: "strong-sell", label: "Strong sell" },
      ] },
      { key: "primaryListingOnly", label: "Primary listing only", category: "security-info", inputType: "toggle" },
      { key: "price", label: "Price", category: "market-data", inputType: "range" },
      { key: "changePercent", label: "Change %", category: "market-data", inputType: "range" },
      { key: "volume", label: "Volume", category: "market-data", inputType: "range" },
      { key: "marketCap", label: "Market cap", category: "market-data", inputType: "range" },
      { key: "pe", label: "P/E", category: "valuation", inputType: "range" },
      { key: "epsDilTtm", label: "EPS dil TTM", category: "valuation", inputType: "range" },
      { key: "epsDilGrowth", label: "EPS dil growth", category: "growth", inputType: "range" },
      { key: "divYieldPercent", label: "Div yield %", category: "dividends", inputType: "range" },
      { key: "revenueGrowth", label: "Revenue growth", category: "growth", inputType: "range" },
      { key: "peg", label: "PEG", category: "valuation", inputType: "range" },
      { key: "roe", label: "ROE", category: "margins", inputType: "range" },
      { key: "beta", label: "Beta", category: "market-data", inputType: "range" },
    ],
    lastUpdated: new Date().toISOString(),
    screenMenuOptions: [
      { key: "save-screen", label: "Save screen" },
      { key: "share-screen", label: "Share screen" },
      { key: "copy-link", label: "Copy link" },
      { key: "make-copy", label: "Make a copy" },
      { key: "rename", label: "Rename" },
      { key: "download-csv", label: "Download CSV" },
    ],
    countries,
    indices: [],
    watchlists: [],
    sectors,
    exchanges,
  };

  try { await redis.setex(cacheKey, 300, JSON.stringify(result)); } catch {}
  return result;
}
