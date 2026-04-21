import type { ScreenerMetaResponse } from "./types";
import { FALLBACK_SCREENER_TYPES, DEFAULT_VISIBLE_COLUMNS } from "./constants";

/**
 * Complete fallback metadata when /screener/meta API fails or is slow.
 * This ensures filters and columns are always available on the client side.
 */
export const COMPLETE_SCREENER_META_FALLBACK: ScreenerMetaResponse = {
  screenerTypes: FALLBACK_SCREENER_TYPES,
  heatmapTypes: [
    { label: "Stocks", routeType: "stocks" },
    { label: "ETFs", routeType: "etfs" },
    { label: "Crypto coins", routeType: "crypto-coins" },
  ],
  tabs: [
    {
      key: "overview",
      label: "Overview",
      defaultColumns: [
        "symbol", "price", "changePercent", "volume", "relVolume",
        "marketCap", "pe", "epsDilTtm", "epsDilGrowth", "divYieldPercent",
        "sector", "analystRating",
      ],
    },
    {
      key: "performance",
      label: "Performance",
      defaultColumns: [
        "symbol", "price", "changePercent", "perfPercent", "volume",
        "relVolume", "beta", "sector", "analystRating",
      ],
    },
    {
      key: "valuation",
      label: "Valuation",
      defaultColumns: ["symbol", "price", "marketCap", "pe", "peg", "epsDilTtm", "epsDilGrowth", "analystRating"],
    },
    {
      key: "dividends",
      label: "Dividends",
      defaultColumns: ["symbol", "price", "divYieldPercent", "marketCap", "pe", "sector", "analystRating"],
    },
    {
      key: "profitability",
      label: "Profitability",
      defaultColumns: ["symbol", "price", "roe", "revenueGrowth", "epsDilGrowth", "marketCap", "sector"],
    },
    {
      key: "income-statement",
      label: "Income Statement",
      defaultColumns: ["symbol", "price", "revenue", "netIncome", "epsDilTtm", "epsDilGrowth", "sector"],
    },
    {
      key: "balance-sheet",
      label: "Balance Sheet",
      defaultColumns: ["symbol", "price", "marketCap", "sharesFloat", "beta"],
    },
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
  filterFields: [
    // Market filters
    { key: "marketCountries", label: "Market Countries", category: "market-data", inputType: "multiselect", supportsMultiSelect: true },
    { key: "exchanges", label: "Exchanges", category: "market-data", inputType: "multiselect", supportsMultiSelect: true },
    { key: "watchlists", label: "Watchlists", category: "security-info", inputType: "multiselect", supportsMultiSelect: true },
    { key: "indices", label: "Indices", category: "market-data", inputType: "multiselect", supportsMultiSelect: true },
    { key: "primaryListingOnly", label: "Primary listing only", category: "security-info", inputType: "toggle" },

    // Price & Volume
    { key: "price", label: "Price", category: "market-data", inputType: "range" },
    { key: "changePercent", label: "Change %", category: "market-data", inputType: "range" },
    { key: "volume", label: "Volume", category: "market-data", inputType: "range" },
    { key: "relVolume", label: "Rel Volume", category: "market-data", inputType: "range" },
    { key: "marketCap", label: "Market cap", category: "market-data", inputType: "range" },

    // Valuation
    { key: "pe", label: "P/E", category: "valuation", inputType: "range" },
    { key: "peg", label: "PEG", category: "valuation", inputType: "range" },
    { key: "epsDilTtm", label: "EPS dil TTM", category: "valuation", inputType: "range" },
    { key: "epsDilGrowth", label: "EPS dil growth", category: "growth", inputType: "range" },

    // Dividends
    { key: "divYieldPercent", label: "Div yield %", category: "dividends", inputType: "range" },

    // Fundamentals
    { key: "sector", label: "Sector", category: "security-info", inputType: "multiselect", supportsMultiSelect: true },
    { key: "analystRating", label: "Analyst Rating", category: "technicals", inputType: "multiselect", supportsMultiSelect: true },

    // Performance
    { key: "perfPercent", label: "Perf %", category: "technicals", inputType: "range" },
    { key: "revenueGrowth", label: "Revenue growth", category: "growth", inputType: "range" },
    { key: "roe", label: "ROE", category: "margins", inputType: "range" },
    { key: "beta", label: "Beta", category: "market-data", inputType: "range" },

    // Dates
    { key: "recentEarningsDate", label: "Recent earnings date", category: "financials", inputType: "date-range" },
    { key: "upcomingEarningsDate", label: "Upcoming earnings date", category: "financials", inputType: "date-range" },
  ],
  columnFields: [
    { key: "symbol", label: "Symbol", category: "security-info" },
    { key: "name", label: "Name", category: "security-info" },
    { key: "price", label: "Price", category: "market-data", numeric: true },
    { key: "changePercent", label: "Change %", category: "market-data", numeric: true },
    { key: "volume", label: "Volume", category: "market-data", numeric: true },
    { key: "relVolume", label: "Rel Volume", category: "market-data", numeric: true },
    { key: "marketCap", label: "Market cap", category: "market-data", numeric: true },
    { key: "pe", label: "P/E", category: "valuation", numeric: true },
    { key: "epsDilTtm", label: "EPS dil TTM", category: "valuation", numeric: true },
    { key: "epsDilGrowth", label: "EPS dil growth", category: "growth", numeric: true },
    { key: "divYieldPercent", label: "Div yield %", category: "dividends", numeric: true },
    { key: "sector", label: "Sector", category: "security-info" },
    { key: "analystRating", label: "Analyst Rating", category: "technicals" },
    { key: "perfPercent", label: "Perf %", category: "technicals", numeric: true },
    { key: "revenueGrowth", label: "Revenue growth", category: "growth", numeric: true },
    { key: "peg", label: "PEG", category: "valuation", numeric: true },
    { key: "roe", label: "ROE", category: "margins", numeric: true },
    { key: "beta", label: "Beta", category: "market-data", numeric: true },
    { key: "recentEarningsDate", label: "Recent earnings date", category: "financials" },
    { key: "upcomingEarningsDate", label: "Upcoming earnings date", category: "financials" },
    { key: "exchange", label: "Exchange", category: "security-info" },
    { key: "country", label: "Country", category: "security-info" },
    { key: "currency", label: "Currency", category: "security-info" },
    { key: "netIncome", label: "Net income", category: "financials", numeric: true },
    { key: "revenue", label: "Revenue", category: "financials", numeric: true },
    { key: "sharesFloat", label: "Shares float", category: "financials", numeric: true },
  ],
  screenMenuOptions: [
    { key: "save-screen", label: "Save screen" },
    { key: "share-screen", label: "Share screen" },
    { key: "copy-link", label: "Copy link" },
    { key: "make-copy", label: "Make a copy" },
    { key: "rename", label: "Rename" },
    { key: "download-csv", label: "Download CSV" },
  ],
  countries: [
    { value: "US", label: "United States" },
    { value: "IN", label: "India" },
    { value: "GB", label: "United Kingdom" },
    { value: "DE", label: "Germany" },
    { value: "JP", label: "Japan" },
    { value: "CN", label: "China" },
    { value: "CA", label: "Canada" },
    { value: "AU", label: "Australia" },
    { value: "FR", label: "France" },
    { value: "KR", label: "South Korea" },
    { value: "HK", label: "Hong Kong" },
    { value: "SG", label: "Singapore" },
  ],
  indices: [
    { code: "SPX", name: "S&P 500" },
    { code: "INDU", name: "Dow Jones Industrial Average" },
    { code: "CCMP", name: "NASDAQ Composite" },
    { code: "VIX", name: "Volatility Index" },
  ],
  watchlists: [
    { value: "red-list", label: "Red list" },
  ],
  sectors: [
    { value: "Technology", label: "Technology" },
    { value: "Healthcare", label: "Healthcare" },
    { value: "Financials", label: "Financials" },
    { value: "Consumer Discretionary", label: "Consumer Discretionary" },
    { value: "Industrials", label: "Industrials" },
    { value: "Energy", label: "Energy" },
    { value: "Materials", label: "Materials" },
    { value: "Utilities", label: "Utilities" },
    { value: "Real Estate", label: "Real Estate" },
    { value: "Communication Services", label: "Communication Services" },
    { value: "Consumer Staples", label: "Consumer Staples" },
  ],
  exchanges: [
    "NYSE", "NASDAQ", "AMEX", "NSE", "BSE", "LSE", "TSE", "FWB",
    "HKEX", "SSE", "SGX", "ASX", "TSX", "KRX", "MOEX",
  ],
};
