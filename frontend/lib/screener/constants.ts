import type { ScreenerTypeDefinition } from "./types";

export const FALLBACK_SCREENER_TYPES: ScreenerTypeDefinition[] = [
  { routeType: "stocks", label: "Stock Screener" },
  { routeType: "etfs", label: "ETF Screener" },
  { routeType: "bonds", label: "Bond Screener" },
  { routeType: "crypto-coins", label: "Crypto Coins Screener" },
  { routeType: "cex-pairs", label: "CEX Screener" },
  { routeType: "dex-pairs", label: "DEX Screener" },
];

export const DEFAULT_VISIBLE_COLUMNS = [
  "symbol",
  "price",
  "changePercent",
  "volume",
  "relVolume",
  "marketCap",
  "pe",
  "epsDilTtm",
  "epsDilGrowth",
  "divYieldPercent",
  "sector",
  "analystRating",
];

export const DEFAULT_FILTER_KEYS = [
  "marketCountries", "watchlists", "indices",
  "price", "changePercent", "marketCap", "pe", "epsDilGrowth",
  "divYieldPercent", "sector", "analystRating", "perfPercent", "revenueGrowth",
  "peg", "roe", "beta", "recentEarningsDate", "upcomingEarningsDate",
];

export const BATCH_SIZE = 50;

export const MULTI_FILTER_KEYS = ["marketCountries", "exchanges", "watchlists", "indices", "sector", "analystRating"];
export const RANGE_FILTER_KEYS = [
  "price", "changePercent", "marketCap", "pe", "epsDilGrowth",
  "divYieldPercent", "perfPercent", "revenueGrowth", "peg", "roe", "beta",
];
export const DATE_FILTER_KEYS = ["recentEarningsDate", "upcomingEarningsDate"];
export const TOGGLE_FILTER_KEYS = ["primaryListingOnly"];

export const COLUMN_WIDTHS: Record<string, string> = {
  symbol: "minmax(260px, 2.2fr)",
  name: "minmax(240px, 2fr)",
  price: "minmax(110px, 1fr)",
  changePercent: "minmax(100px, 1fr)",
  volume: "minmax(120px, 1fr)",
  relVolume: "minmax(110px, 1fr)",
  marketCap: "minmax(130px, 1fr)",
  pe: "minmax(90px, 0.8fr)",
  epsDilTtm: "minmax(110px, 0.9fr)",
  epsDilGrowth: "minmax(130px, 1fr)",
  divYieldPercent: "minmax(120px, 1fr)",
  sector: "minmax(140px, 1fr)",
  analystRating: "minmax(130px, 1fr)",
  perfPercent: "minmax(100px, 0.9fr)",
  revenueGrowth: "minmax(130px, 1fr)",
  peg: "minmax(90px, 0.8fr)",
  roe: "minmax(100px, 0.9fr)",
  beta: "minmax(90px, 0.8fr)",
  recentEarningsDate: "minmax(130px, 1fr)",
  upcomingEarningsDate: "minmax(140px, 1fr)",
  exchange: "minmax(110px, 0.9fr)",
  country: "minmax(100px, 0.9fr)",
  currency: "minmax(90px, 0.8fr)",
  netIncome: "minmax(120px, 1fr)",
  revenue: "minmax(120px, 1fr)",
  sharesFloat: "minmax(120px, 1fr)",
};

export const NUMERIC_COLUMNS = new Set([
  "price", "changePercent", "volume", "relVolume", "marketCap",
  "pe", "epsDilTtm", "epsDilGrowth", "divYieldPercent", "perfPercent",
  "revenueGrowth", "peg", "roe", "beta", "netIncome", "revenue", "sharesFloat",
]);

export const FALLBACK_FILTER_CATEGORY_LABELS: Record<string, string> = {
  "security-info": "Security info",
  "market-data": "Market data",
  technicals: "Technicals",
  financials: "Financials",
  valuation: "Valuation",
  growth: "Growth",
  margins: "Margins",
  dividends: "Dividends",
};
