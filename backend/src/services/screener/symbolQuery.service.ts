import { enrichScreenerBatch, getFullSymbolData } from "../symbolAggregation.service";
import { logger } from "../../utils/logger";
import {
  ALLOWED_SORT_FIELDS,
  CEX_EXCHANGE_HINTS,
  COUNTRY_OPTIONS,
  DB_SORTABLE_FIELDS,
  DEX_EXCHANGE_HINTS,
  INDEX_OPTIONS,
  SCREENER_TYPES,
} from "./screener.constants";
import type {
  ScreenerFiltersInput,
  ScreenerGetSymbolsRequest,
  ScreenerGetSymbolsResponse,
  ScreenerRepositoryQuery,
  ScreenerRow,
} from "./screener.types";
import { countAssets, findAssetBySymbol, listAssets } from "./screener.repository";

const MAX_SCAN_ROWS = 25000;
const SCAN_CHUNK_SIZE = 300;

const RATING_ORDER: Record<string, number> = {
  "strong-sell": 1,
  sell: 2,
  neutral: 3,
  buy: 4,
  "strong-buy": 5,
};

const knownCountryCodes = new Set(
  COUNTRY_OPTIONS.filter((item) => item.value !== "WORLD" && item.value !== "OTHER").map((item) => item.value.toUpperCase()),
);

function toPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value * 100;
}

function inNumericRange(value: number | null | undefined, range?: { min?: number; max?: number }): boolean {
  if (!range) return true;
  if (value == null) return false; // null values don't match any numeric range
  if (range.min !== undefined && value < range.min) return false;
  if (range.max !== undefined && value > range.max) return false;
  return true;
}

function inDateRange(valueIsoDate: string, range?: { from?: string; to?: string }): boolean {
  if (!range) return true;
  const value = Date.parse(valueIsoDate);
  if (!Number.isFinite(value)) return false;

  if (range.from) {
    const fromValue = Date.parse(range.from);
    if (Number.isFinite(fromValue) && value < fromValue) return false;
  }

  if (range.to) {
    const toValue = Date.parse(range.to);
    if (Number.isFinite(toValue) && value > toValue) return false;
  }

  return true;
}

function normalizeRatingValue(rating: string): string {
  return rating.trim().toLowerCase().replace(/\s+/g, "-");
}

function isDexExchange(exchange: string): boolean {
  const upper = exchange.toUpperCase();
  return DEX_EXCHANGE_HINTS.some((hint) => upper.includes(hint));
}

function isCexExchange(exchange: string): boolean {
  const upper = exchange.toUpperCase();
  if (isDexExchange(upper)) return false;
  return CEX_EXCHANGE_HINTS.some((hint) => upper.includes(hint));
}

/**
 * Derive analyst rating from real data fields.
 * Returns empty string when insufficient data is available.
 */
function deriveAnalystRating(base: { analystRating?: string }): string {
  return base.analystRating || "";
}

/**
 * Map enriched symbol data to a ScreenerRow.
 * Uses only real data from the DB/price layer — no synthetic generation.
 * Returns null for fields with no real data (frontend renders "—").
 */
function mapRow(base: Awaited<ReturnType<typeof enrichScreenerBatch>>[number]): ScreenerRow {
  const perfPercent = Number((base.changePercent || 0).toFixed(2));
  const epsDilGrowth = base.revenueGrowth != null ? Number(toPercent(base.revenueGrowth).toFixed(2)) : null;
  const revenueGrowth = base.revenueGrowth != null ? Number(toPercent(base.revenueGrowth).toFixed(2)) : null;
  const divYieldPercent = base.dividendYield != null ? Number(base.dividendYield.toFixed(2)) : null;
  const pe = base.pe;
  const peg = pe != null && pe > 0 && epsDilGrowth != null && epsDilGrowth > 0
    ? Number((pe / Math.max(0.1, epsDilGrowth)).toFixed(2))
    : null;
  const roe = base.roe != null ? Number(toPercent(base.roe).toFixed(2)) : null;
  const relVolume: number | null = null; // Requires average volume data not yet available

  const marketClass = isDexExchange(base.exchange)
    ? "dex"
    : isCexExchange(base.exchange)
      ? "cex"
      : "cex";

  return {
    ...base,
    relVolume,
    epsDilTtm: base.eps != null ? Number(base.eps.toFixed(2)) : null,
    epsDilGrowth,
    revenueGrowth,
    divYieldPercent,
    perfPercent,
    peg,
    roe,
    analystRating: deriveAnalystRating(base as any),
    recentEarningsDate: (base as any).recentEarningsDate || "",
    upcomingEarningsDate: (base as any).upcomingEarningsDate || "",
    marketClass,
  };
}

function getScreenerType(type: string) {
  return SCREENER_TYPES.find((entry) => entry.routeType === type) ?? SCREENER_TYPES[0];
}

function buildIndexScope(selectedIndexCodes: string[]): { countries: string[]; exchanges: string[]; symbols: string[] } {
  if (selectedIndexCodes.length === 0) {
    return { countries: [], exchanges: [], symbols: [] };
  }

  const countries = new Set<string>();
  const exchanges = new Set<string>();
  const symbols = new Set<string>();

  for (const code of selectedIndexCodes) {
    const upper = code.toUpperCase();
    const indexDef = INDEX_OPTIONS.find(
      (entry) => entry.code.toUpperCase() === upper || entry.aliases?.some((alias) => alias.toUpperCase() === upper),
    );

    if (indexDef) {
      symbols.add(indexDef.code.toUpperCase());
      indexDef.aliases?.forEach((alias) => symbols.add(alias.toUpperCase()));
      indexDef.countries?.forEach((country) => countries.add(country.toUpperCase()));
      indexDef.exchanges?.forEach((exchange) => exchanges.add(exchange.toUpperCase()));
      continue;
    }

    symbols.add(upper);
  }

  return {
    countries: Array.from(countries),
    exchanges: Array.from(exchanges),
    symbols: Array.from(symbols),
  };
}

function normalizeMultiValues(input: string[]): string[] {
  return Array.from(
    new Set(
      input
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function buildRepositoryQuery(request: ScreenerGetSymbolsRequest): ScreenerRepositoryQuery {
  const typeDef = getScreenerType(request.type);
  const indexScope = buildIndexScope(request.filters.indices);

  const selectedCountries = normalizeMultiValues(request.filters.marketCountries)
    .map((value) => value.toUpperCase())
    .filter((value) => value !== "WORLD" && value !== "OTHER");

  const mergedCountries = Array.from(new Set([...selectedCountries, ...indexScope.countries]));
  const selectedExchanges = normalizeMultiValues(request.filters.exchanges).map((value) => value.toUpperCase());
  const mergedExchanges = Array.from(new Set([...selectedExchanges, ...indexScope.exchanges]));

  const selectedSectors = normalizeMultiValues(request.filters.sector);

  return {
    typeAssetValues: typeDef.assetTypes,
    query: request.query,
    countries: mergedCountries,
    exchanges: mergedExchanges,
    sectors: selectedSectors,
    primaryListingOnly: request.filters.primaryListingOnly,
    marketCap: request.filters.marketCap,
    volume: undefined,
  };
}

function hasDerivedFilters(filters: ScreenerFiltersInput): boolean {
  return Boolean(
    filters.watchlists.length > 0
    || filters.indices.length > 0
    || filters.price
    || filters.changePercent
    || filters.pe
    || filters.epsDilGrowth
    || filters.divYieldPercent
    || filters.analystRating.length > 0
    || filters.perfPercent
    || filters.revenueGrowth
    || filters.peg
    || filters.roe
    || filters.beta
    || filters.recentEarningsDate
    || filters.upcomingEarningsDate,
  );
}

function matchWatchlists(row: ScreenerRow, selectedWatchlists: string[]): boolean {
  if (selectedWatchlists.length === 0) return true;

  const normalized = selectedWatchlists.map((entry) => entry.toLowerCase());

  const matchesRedList = row.changePercent < 0;
  const matchesDaftarPantau = (row.marketCap ?? 0) >= 1_000_000_000 || row.volume >= 1_000_000;

  return normalized.some((entry) => {
    if (entry === "red-list") return matchesRedList;
    if (entry === "daftar-pantau") return matchesDaftarPantau;
    return false;
  });
}

function matchIndices(row: ScreenerRow, selectedIndices: string[]): boolean {
  if (selectedIndices.length === 0) return true;

  const indexScope = buildIndexScope(selectedIndices);

  if (indexScope.symbols.includes(row.symbol.toUpperCase())) return true;
  if (indexScope.exchanges.includes(row.exchange.toUpperCase())) return true;
  if (indexScope.countries.includes(row.country.toUpperCase())) return true;

  return false;
}

function matchMarketCountries(row: ScreenerRow, selectedCountries: string[]): boolean {
  if (selectedCountries.length === 0 || selectedCountries.includes("WORLD")) return true;

  const normalized = selectedCountries.map((entry) => entry.toUpperCase());
  const includeOther = normalized.includes("OTHER");

  if (normalized.includes(row.country.toUpperCase())) return true;

  if (includeOther && !knownCountryCodes.has(row.country.toUpperCase())) {
    return true;
  }

  return false;
}

function matchTypeMarketClass(row: ScreenerRow, requestType: string): boolean {
  const typeDef = getScreenerType(requestType);
  if (typeDef.marketClass === "all") return true;
  if (typeDef.marketClass === "cex") return row.marketClass === "cex";
  if (typeDef.marketClass === "dex") return row.marketClass === "dex";
  return true;
}

function applyFilters(row: ScreenerRow, filters: ScreenerFiltersInput, requestType: string): boolean {
  if (!matchTypeMarketClass(row, requestType)) return false;
  if (!matchMarketCountries(row, filters.marketCountries)) return false;
  if (filters.exchanges.length > 0 && !filters.exchanges.map((entry) => entry.toUpperCase()).includes(row.exchange.toUpperCase())) {
    return false;
  }
  if (!matchWatchlists(row, filters.watchlists)) return false;
  if (!matchIndices(row, filters.indices)) return false;

  if (filters.primaryListingOnly && !row.isPrimaryListing) return false;

  if (!inNumericRange(row.price, filters.price)) return false;
  if (!inNumericRange(row.changePercent, filters.changePercent)) return false;
  if (!inNumericRange(row.marketCap, filters.marketCap)) return false;
  if (!inNumericRange(row.pe, filters.pe)) return false;
  if (!inNumericRange(row.epsDilGrowth, filters.epsDilGrowth)) return false;
  if (!inNumericRange(row.divYieldPercent, filters.divYieldPercent)) return false;
  if (!inNumericRange(row.perfPercent, filters.perfPercent)) return false;
  if (!inNumericRange(row.revenueGrowth, filters.revenueGrowth)) return false;
  if (!inNumericRange(row.peg, filters.peg)) return false;
  if (!inNumericRange(row.roe, filters.roe)) return false;
  if (!inNumericRange(row.beta, filters.beta)) return false;

  if (!inDateRange(row.recentEarningsDate, filters.recentEarningsDate)) return false;
  if (!inDateRange(row.upcomingEarningsDate, filters.upcomingEarningsDate)) return false;

  if (filters.sector.length > 0) {
    const normalizedSectors = filters.sector.map((entry) => entry.toLowerCase());
    if (!normalizedSectors.includes((row.sector || "").toLowerCase())) return false;
  }

  if (filters.analystRating.length > 0) {
    const normalizedRatings = filters.analystRating.map((entry) => normalizeRatingValue(entry));
    if (!normalizedRatings.includes(normalizeRatingValue(row.analystRating))) return false;
  }

  return true;
}

function getSortValue(row: ScreenerRow, sortField: string): number | string {
  const toScore = (key: "priorityScore" | "liquidityScore" | "popularity") => {
    const raw = (row as unknown as Record<string, unknown>)[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  };

  switch (sortField) {
    case "symbol":
      return row.symbol;
    case "name":
      return row.name;
    case "price":
      return row.price;
    case "changePercent":
      return row.changePercent;
    case "volume":
      return row.volume;
    case "relVolume":
      return row.relVolume ?? 0;
    case "marketCap":
      return row.marketCap ?? 0;
    case "pe":
      return row.pe ?? 0;
    case "epsDilTtm":
      return row.epsDilTtm ?? 0;
    case "epsDilGrowth":
      return row.epsDilGrowth ?? 0;
    case "divYieldPercent":
      return row.divYieldPercent ?? 0;
    case "analystRating":
      return RATING_ORDER[normalizeRatingValue(row.analystRating)] || 0;
    case "perfPercent":
      return row.perfPercent;
    case "revenueGrowth":
      return row.revenueGrowth ?? 0;
    case "peg":
      return row.peg ?? 0;
    case "roe":
      return row.roe ?? 0;
    case "beta":
      return row.beta ?? 0;
    case "recentEarningsDate":
      return Date.parse(row.recentEarningsDate) || 0;
    case "upcomingEarningsDate":
      return Date.parse(row.upcomingEarningsDate) || 0;
    case "priorityScore":
      return toScore("priorityScore");
    case "liquidityScore":
      return toScore("liquidityScore");
    case "popularity":
      return toScore("popularity");
    default:
      return toScore("priorityScore");
  }
}

function sortRows(rows: ScreenerRow[], sortField: string, sortOrder: "asc" | "desc"): ScreenerRow[] {
  const order = sortOrder === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, sortField);
    const rightValue = getSortValue(right, sortField);

    if (typeof leftValue === "string" && typeof rightValue === "string") {
      return leftValue.localeCompare(rightValue) * order;
    }

    const leftNumber = Number(leftValue) || 0;
    const rightNumber = Number(rightValue) || 0;

    if (leftNumber === rightNumber) {
      return (left.symbol || "").localeCompare(right.symbol || "");
    }

    return (leftNumber - rightNumber) * order;
  });
}

function sanitizeSortField(sortField: string): string {
  return ALLOWED_SORT_FIELDS.has(sortField) ? sortField : "priorityScore";
}

export async function getSymbols(request: ScreenerGetSymbolsRequest): Promise<ScreenerGetSymbolsResponse> {
  const safeSortField = sanitizeSortField(request.sortField);
  const typeDef = getScreenerType(request.type);
  const needsDerived =
    typeDef.marketClass !== "all"
    || hasDerivedFilters(request.filters)
    || !DB_SORTABLE_FIELDS.has(safeSortField);
  const repositoryQuery = buildRepositoryQuery(request);

  if (!needsDerived) {
    const [total, docs] = await Promise.all([
      countAssets(repositoryQuery),
      listAssets(
        repositoryQuery,
        { field: safeSortField, order: request.sortOrder },
        request.offset,
        request.limit,
      ),
    ]);

    const enriched = await enrichScreenerBatch(docs);
    const mapped = enriched.map((entry) => mapRow(entry)).filter((row) => applyFilters(row, request.filters, request.type));

    return {
      items: mapped,
      total,
      limit: request.limit,
      offset: request.offset,
      hasMore: request.offset + mapped.length < total,
      scannedCount: docs.length,
    };
  }

  const filteredRows: ScreenerRow[] = [];
  let scanOffset = 0;
  let scannedCount = 0;
  let hasTruncatedScan = false;

  while (scannedCount < MAX_SCAN_ROWS) {
    const docs = await listAssets(
      repositoryQuery,
      { field: DB_SORTABLE_FIELDS.has(safeSortField) ? safeSortField : "priorityScore", order: request.sortOrder },
      scanOffset,
      SCAN_CHUNK_SIZE,
    );

    if (docs.length === 0) {
      break;
    }

    scanOffset += docs.length;
    scannedCount += docs.length;

    const enriched = await enrichScreenerBatch(docs);
    for (const entry of enriched) {
      const row = mapRow(entry);
      if (applyFilters(row, request.filters, request.type)) {
        filteredRows.push(row);
      }
    }

    if (docs.length < SCAN_CHUNK_SIZE) {
      break;
    }
  }

  if (scannedCount >= MAX_SCAN_ROWS) {
    hasTruncatedScan = true;
    logger.warn("screener_scan_truncated", {
      type: request.type,
      sortField: safeSortField,
      scannedCount,
      maxScanRows: MAX_SCAN_ROWS,
    });
  }

  const sorted = sortRows(filteredRows, safeSortField, request.sortOrder);
  const items = sorted.slice(request.offset, request.offset + request.limit);
  const total = sorted.length;

  const hasMore = request.offset + request.limit < total || (hasTruncatedScan && items.length >= request.limit);

  return {
    items,
    total,
    limit: request.limit,
    offset: request.offset,
    hasMore,
    scannedCount,
  };
}

export async function getSymbolBySymbolOrFullSymbol(symbolOrFullSymbol: string) {
  const base = await findAssetBySymbol(symbolOrFullSymbol);
  if (!base) return null;

  const detail = await getFullSymbolData(base.fullSymbol);
  if (detail) {
    return mapRow(detail);
  }

  return null;
}
