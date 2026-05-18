import { z } from "zod";
import { SCREENER_TABS, SCREENER_TYPES, type ScreenerTabKey } from "../services/screener/screener.constants";
import type { ScreenerFiltersInput } from "../services/screener/screener.types";

export interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const PERIOD_CHART_MAP: Record<string, { timeframe: string; limit: number }> = {
  "1D":  { timeframe: "5m",  limit: 78  },
  "5D":  { timeframe: "30m", limit: 65  },
  "1M":  { timeframe: "1D",  limit: 22  },
  "3M":  { timeframe: "1D",  limit: 66  },
  "6M":  { timeframe: "1D",  limit: 132 },
  "YTD": { timeframe: "1D",  limit: 120 },
  "1Y":  { timeframe: "1W",  limit: 52  },
  "5Y":  { timeframe: "1W",  limit: 260 },
  "All": { timeframe: "1M",  limit: 120 },
};

export const LIVE_SCREENER_CACHE_TTL = {
  l1TtlMs: 4_000,
  l2TtlS: 8,
};

export function periodToDays(period: string): number {
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

export function generateFallbackCandles(symbol: string, currentPrice: number, changePercent: number, period: string) {
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

export const listSchema = z.object({
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

export function parseCsv(input?: string): string[] {
  if (!input) return [];
  return input.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
}

export function parseRange(min?: number, max?: number): { min?: number; max?: number } | undefined {
  if (min === undefined && max === undefined) return undefined;
  return { min, max };
}

export function parseDateRange(from?: string, to?: string): { from?: string; to?: string } | undefined {
  if (!from && !to) return undefined;
  return { from, to };
}

export function normalizeType(inputType?: string): (typeof SCREENER_TYPES)[number]["routeType"] {
  if (!inputType) return "stocks";
  const n = inputType.trim().toLowerCase();
  if (SCREENER_TYPES.some((e) => e.routeType === n)) return n as (typeof SCREENER_TYPES)[number]["routeType"];
  if (n === "stock") return "stocks";
  if (n === "etf") return "etfs";
  if (n === "bond") return "bonds";
  if (n === "crypto") return "crypto-coins";
  if (n === "cex") return "cex-pairs";
  if (n === "dex") return "dex-pairs";
  if (n === "option" || n === "options") return "options";
  if (n === "future" || n === "futures") return "futures";
  if (n === "forex" || n === "fx") return "forex";
  if (n === "index" || n === "indices") return "indices";
  return "stocks";
}

export function normalizeTab(inputTab?: string): ScreenerTabKey {
  if (!inputTab) return "overview";
  const n = inputTab.trim().toLowerCase();
  return SCREENER_TABS.some((t) => t.key === n) ? (n as ScreenerTabKey) : "overview";
}

export function buildFilters(input: z.infer<typeof listSchema>): ScreenerFiltersInput {
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
    input.primaryListing || input.primary === "true" || input.primary === "1" || false;

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
