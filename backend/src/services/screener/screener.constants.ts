export type ScreenerRouteType =
  | "stocks"
  | "etfs"
  | "bonds"
  | "crypto-coins"
  | "cex-pairs"
  | "dex-pairs"
  | "options"
  | "futures"
  | "forex"
  | "indices";

export type ScreenerTabKey =
  | "overview"
  | "performance"
  | "valuation"
  | "dividends"
  | "profitability"
  | "income-statement"
  | "balance-sheet"
  | "cash-flow"
  | "per-share"
  | "technicals";

export type FilterCategoryKey =
  | "security-info"
  | "market-data"
  | "technicals"
  | "financials"
  | "valuation"
  | "growth"
  | "margins"
  | "dividends";

export type ScreenerFilterInputType = "multiselect" | "range" | "date-range" | "toggle";

export interface ScreenerTypeDefinition {
  routeType: ScreenerRouteType;
  label: string;
  assetTypes: string[];
  marketClass: "all" | "cex" | "dex";
}

export interface ScreenerOption {
  value: string;
  label: string;
}

export interface ScreenerIndexDefinition {
  code: string;
  aliases?: string[];
  name: string;
  countries?: string[];
  exchanges?: string[];
}

export interface ScreenerFieldDefinition {
  key: string;
  label: string;
  category: FilterCategoryKey;
  inputType: ScreenerFilterInputType;
  supportsMultiSelect?: boolean;
  options?: ScreenerOption[];
}

export interface ScreenerColumnDefinition {
  key: string;
  label: string;
  category: FilterCategoryKey;
  numeric?: boolean;
}

export const DEFAULT_BATCH_SIZE = 50;
export const PREFETCH_BATCH_SIZE = 50;

export const SCREENER_TYPES: ScreenerTypeDefinition[] = [
  { routeType: "stocks", label: "Stock Screener", assetTypes: ["stock"], marketClass: "all" },
  { routeType: "etfs", label: "ETF Screener", assetTypes: ["etf"], marketClass: "all" },
  { routeType: "bonds", label: "Bond Screener", assetTypes: ["bond"], marketClass: "all" },
  { routeType: "crypto-coins", label: "Crypto Coins Screener", assetTypes: ["crypto"], marketClass: "all" },
  { routeType: "cex-pairs", label: "CEX Screener", assetTypes: ["crypto"], marketClass: "cex" },
  { routeType: "dex-pairs", label: "DEX Screener", assetTypes: ["crypto"], marketClass: "dex" },
  { routeType: "options", label: "Options Screener", assetTypes: ["options"], marketClass: "all" },
  { routeType: "futures", label: "Futures Screener", assetTypes: ["futures"], marketClass: "all" },
  { routeType: "forex", label: "Forex Screener", assetTypes: ["forex"], marketClass: "all" },
  { routeType: "indices", label: "Indices Screener", assetTypes: ["index"], marketClass: "all" },
];

export const SCREENER_HEATMAP_TYPES: Array<{ label: string; routeType: "stocks" | "etfs" | "crypto-coins" }> = [
  { label: "Stocks", routeType: "stocks" },
  { label: "ETFs", routeType: "etfs" },
  { label: "Crypto coins", routeType: "crypto-coins" },
];

export const SCREEN_MENU_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "save-screen", label: "Save screen" },
  { key: "share-screen", label: "Share screen" },
  { key: "copy-link", label: "Copy link" },
  { key: "make-copy", label: "Make a copy" },
  { key: "rename", label: "Rename" },
  { key: "download-csv", label: "Download CSV" },
  { key: "create-new", label: "Create new screen" },
  { key: "recently-used", label: "Recently used" },
  { key: "open-screen", label: "Open screen" },
];

export const WATCHLIST_OPTIONS: ScreenerOption[] = [
  { value: "red-list", label: "Red list" },
  { value: "daftar-pantau", label: "Daftar Pantau" },
];

export const ANALYST_RATING_OPTIONS: ScreenerOption[] = [
  { value: "strong-buy", label: "Strong buy" },
  { value: "buy", label: "Buy" },
  { value: "neutral", label: "Neutral" },
  { value: "sell", label: "Sell" },
  { value: "strong-sell", label: "Strong sell" },
];

export const FILTER_CATEGORIES: Array<{ key: FilterCategoryKey; label: string }> = [
  { key: "security-info", label: "Security info" },
  { key: "market-data", label: "Market data" },
  { key: "technicals", label: "Technicals" },
  { key: "financials", label: "Financials" },
  { key: "valuation", label: "Valuation" },
  { key: "growth", label: "Growth" },
  { key: "margins", label: "Margins" },
  { key: "dividends", label: "Dividends" },
];

export const SCREENER_TABS: Array<{ key: ScreenerTabKey; label: string; defaultColumns: string[] }> = [
  {
    key: "overview",
    label: "Overview",
    defaultColumns: [
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
    ],
  },
  {
    key: "performance",
    label: "Performance",
    defaultColumns: [
      "symbol",
      "price",
      "changePercent",
      "perfPercent",
      "volume",
      "relVolume",
      "beta",
      "sector",
      "analystRating",
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
    defaultColumns: ["symbol", "price", "marketCap", "sharesFloat", "beta", "sector"],
  },
  {
    key: "cash-flow",
    label: "Cash Flow",
    defaultColumns: ["symbol", "price", "marketCap", "revenue", "netIncome", "sector"],
  },
  {
    key: "per-share",
    label: "Per Share",
    defaultColumns: ["symbol", "price", "epsDilTtm", "epsDilGrowth", "pe", "divYieldPercent", "sector"],
  },
  {
    key: "technicals",
    label: "Technicals",
    defaultColumns: ["symbol", "price", "changePercent", "perfPercent", "beta", "relVolume", "sector"],
  },
];

export const COUNTRY_OPTIONS: ScreenerOption[] = [
  { value: "IN", label: "\u{1F1EE}\u{1F1F3} India" },
  { value: "WORLD", label: "\u{1F30D} Entire world" },
  { value: "US", label: "\u{1F1FA}\u{1F1F8} USA" },
  { value: "DE", label: "\u{1F1E9}\u{1F1EA} Germany" },
  { value: "JP", label: "\u{1F1EF}\u{1F1F5} Japan" },
  { value: "CA", label: "\u{1F1E8}\u{1F1E6} Canada" },
  { value: "HK", label: "\u{1F1ED}\u{1F1F0} Hong Kong, China" },
  { value: "GB", label: "\u{1F1EC}\u{1F1E7} United Kingdom" },
  { value: "AR", label: "\u{1F1E6}\u{1F1F7} Argentina" },
  { value: "AU", label: "\u{1F1E6}\u{1F1FA} Australia" },
  { value: "AT", label: "\u{1F1E6}\u{1F1F9} Austria" },
  { value: "BH", label: "\u{1F1E7}\u{1F1ED} Bahrain" },
  { value: "BD", label: "\u{1F1E7}\u{1F1E9} Bangladesh" },
  { value: "BE", label: "\u{1F1E7}\u{1F1EA} Belgium" },
  { value: "BR", label: "\u{1F1E7}\u{1F1F7} Brazil" },
  { value: "BG", label: "\u{1F1E7}\u{1F1EC} Bulgaria" },
  { value: "CL", label: "\u{1F1E8}\u{1F1F1} Chile" },
  { value: "CO", label: "\u{1F1E8}\u{1F1F4} Colombia" },
  { value: "HR", label: "\u{1F1ED}\u{1F1F7} Croatia" },
  { value: "CY", label: "\u{1F1E8}\u{1F1FE} Cyprus" },
  { value: "CZ", label: "\u{1F1E8}\u{1F1FF} Czech Republic" },
  { value: "DK", label: "\u{1F1E9}\u{1F1F0} Denmark" },
  { value: "EG", label: "\u{1F1EA}\u{1F1EC} Egypt" },
  { value: "EE", label: "\u{1F1EA}\u{1F1EA} Estonia" },
  { value: "FI", label: "\u{1F1EB}\u{1F1EE} Finland" },
  { value: "FR", label: "\u{1F1EB}\u{1F1F7} France" },
  { value: "GR", label: "\u{1F1EC}\u{1F1F7} Greece" },
  { value: "HU", label: "\u{1F1ED}\u{1F1FA} Hungary" },
  { value: "IS", label: "\u{1F1EE}\u{1F1F8} Iceland" },
  { value: "ID", label: "\u{1F1EE}\u{1F1E9} Indonesia" },
  { value: "IE", label: "\u{1F1EE}\u{1F1EA} Ireland" },
  { value: "IL", label: "\u{1F1EE}\u{1F1F1} Israel" },
  { value: "IT", label: "\u{1F1EE}\u{1F1F9} Italy" },
  { value: "KE", label: "\u{1F1F0}\u{1F1EA} Kenya" },
  { value: "KW", label: "\u{1F1F0}\u{1F1FC} Kuwait" },
  { value: "LV", label: "\u{1F1F1}\u{1F1FB} Latvia" },
  { value: "LT", label: "\u{1F1F1}\u{1F1F9} Lithuania" },
  { value: "LU", label: "\u{1F1F1}\u{1F1FA} Luxembourg" },
  { value: "CN", label: "\u{1F1E8}\u{1F1F3} Mainland China" },
  { value: "MY", label: "\u{1F1F2}\u{1F1FE} Malaysia" },
  { value: "MX", label: "\u{1F1F2}\u{1F1FD} Mexico" },
  { value: "MA", label: "\u{1F1F2}\u{1F1E6} Morocco" },
  { value: "NL", label: "\u{1F1F3}\u{1F1F1} Netherlands" },
  { value: "NZ", label: "\u{1F1F3}\u{1F1FF} New Zealand" },
  { value: "NG", label: "\u{1F1F3}\u{1F1EC} Nigeria" },
  { value: "NO", label: "\u{1F1F3}\u{1F1F4} Norway" },
  { value: "PK", label: "\u{1F1F5}\u{1F1F0} Pakistan" },
  { value: "PE", label: "\u{1F1F5}\u{1F1EA} Peru" },
  { value: "PH", label: "\u{1F1F5}\u{1F1ED} Philippines" },
  { value: "PL", label: "\u{1F1F5}\u{1F1F1} Poland" },
  { value: "PT", label: "\u{1F1F5}\u{1F1F9} Portugal" },
  { value: "QA", label: "\u{1F1F6}\u{1F1E6} Qatar" },
  { value: "RO", label: "\u{1F1F7}\u{1F1F4} Romania" },
  { value: "RU", label: "\u{1F1F7}\u{1F1FA} Russia" },
  { value: "SA", label: "\u{1F1F8}\u{1F1E6} Saudi Arabia" },
  { value: "RS", label: "\u{1F1F7}\u{1F1F8} Serbia" },
  { value: "SG", label: "\u{1F1F8}\u{1F1EC} Singapore" },
  { value: "SK", label: "\u{1F1F8}\u{1F1F0} Slovakia" },
  { value: "SI", label: "\u{1F1F8}\u{1F1EE} Slovenia" },
  { value: "ZA", label: "\u{1F1FF}\u{1F1E6} South Africa" },
  { value: "KR", label: "\u{1F1F0}\u{1F1F7} South Korea" },
  { value: "ES", label: "\u{1F1EA}\u{1F1F8} Spain" },
  { value: "LK", label: "\u{1F1F1}\u{1F1F0} Sri Lanka" },
  { value: "SE", label: "\u{1F1F8}\u{1F1EA} Sweden" },
  { value: "CH", label: "\u{1F1E8}\u{1F1ED} Switzerland" },
  { value: "TW", label: "\u{1F1F9}\u{1F1FC} Taiwan, China" },
  { value: "TH", label: "\u{1F1F9}\u{1F1ED} Thailand" },
  { value: "TN", label: "\u{1F1F9}\u{1F1F3} Tunisia" },
  { value: "TR", label: "\u{1F1F9}\u{1F1F7} Turkey" },
  { value: "AE", label: "\u{1F1E6}\u{1F1EA} UAE" },
  { value: "VE", label: "\u{1F1FB}\u{1F1EA} Venezuela" },
  { value: "VN", label: "\u{1F1FB}\u{1F1F3} Vietnam" },
  { value: "OTHER", label: "\u{1F310} Other" },
];

export const INDEX_OPTIONS: ScreenerIndexDefinition[] = [
  { code: "SPX", name: "S&P 500", countries: ["US"] },
  { code: "IXIC", name: "US Composite Index", countries: ["US"] },
  { code: "DJI", name: "Dow Jones Industrial Average Index", countries: ["US"] },
  { code: "VIX", name: "CBOE Volatility Index", countries: ["US"] },
  { code: "RUT", name: "US Small Cap 2000 Index", countries: ["US"] },
  { code: "RUA", name: "US Small Cap 3000 Index", countries: ["US"] },
  { code: "RUI", name: "US Small Cap 1000 Index", countries: ["US"] },
  { code: "NYA", name: "NYSE Composite Index", countries: ["US"] },
  { code: "XAX", name: "NYSE American Composite Index", countries: ["US"] },
  { code: "TSX", name: "S&P/TSX Composite index", countries: ["CA"] },
  { code: "UKX", name: "UK 100 INDEX", countries: ["GB"] },
  { code: "DAX", aliases: ["DEU40", "DE30EUR"], name: "German Index", countries: ["DE"] },
  { code: "PX1", aliases: ["CAC40"], name: "CAC 40", countries: ["FR"] },
  { code: "SX5E", name: "STOXX 50", countries: ["EU"] },
  { code: "SXXP", name: "STOXX 600", countries: ["EU"] },
  { code: "AEX", name: "AEX Index", countries: ["NL"] },
  { code: "BEL20", name: "BEL 20 Index", countries: ["BE"] },
  { code: "IBEX35", aliases: ["IBC"], name: "IBEX 35", countries: ["ES"] },
  { code: "SMI", aliases: ["SSMI"], name: "Swiss Market Index", countries: ["CH"] },
  { code: "OMXH25", name: "OMX Helsinki 25", countries: ["FI"] },
  { code: "OMXS30", name: "OMX Stockholm 30", countries: ["SE"] },
  { code: "OMXC25", name: "OMX Copenhagen 25", countries: ["DK"] },
  { code: "FTMIB", name: "Milano Italia Borsa", countries: ["IT"] },
  { code: "WIG20", name: "Poland Index", countries: ["PL"] },
  { code: "BET", name: "Bucharest Index", countries: ["RO"] },
  { code: "GD", name: "ATHEX Composite Index", countries: ["GR"] },
  { code: "BUX", name: "Budapest Index", countries: ["HU"] },
  { code: "BELEX15", name: "Serbia Index", countries: ["RS"] },
  { code: "NI225", name: "Japan 225", countries: ["JP"] },
  { code: "KOSPI", name: "Korea Composite", countries: ["KR"] },
  { code: "000001", name: "SSE Composite", countries: ["CN"] },
  { code: "399001", name: "Shenzhen Index", countries: ["CN"] },
  { code: "HSI", name: "Hang Seng", countries: ["HK"] },
  { code: "HK33HKD", name: "Hong Kong 33", countries: ["HK"] },
  { code: "STI", name: "Straits Times Index", countries: ["SG"] },
  { code: "COMPOSITE", name: "IDX Composite", countries: ["ID"] },
  { code: "IDX30", name: "IDX 30", countries: ["ID"] },
  { code: "FBMKLCI", name: "Malaysia Index", countries: ["MY"] },
  { code: "SET", name: "Thailand Index", countries: ["TH"] },
  { code: "NIFTY", name: "Nifty 50", countries: ["IN"] },
  { code: "SENSEX", name: "BSE Sensex", countries: ["IN"] },
  { code: "XJO", aliases: ["AU200AUD"], name: "Australia 200", countries: ["AU"] },
  { code: "NZ50G", name: "NZX 50", countries: ["NZ"] },
  { code: "TASI", name: "Saudi Index", countries: ["SA"] },
  { code: "DFMGI", name: "Dubai Index", countries: ["AE"] },
  { code: "GNRI", name: "Qatar Index", countries: ["QA"] },
  { code: "TA35", name: "Israel Index", countries: ["IL"] },
  { code: "EGX30", name: "Egypt Index", countries: ["EG"] },
  { code: "SA40", name: "South Africa Top 40", countries: ["ZA"] },
  { code: "IBOV", name: "Bovespa", countries: ["BR"] },
  { code: "IMV", name: "MERVAL", countries: ["AR"] },
  { code: "ICAP", name: "COLCAP", countries: ["CO"] },
  { code: "SP_IPSA", name: "IPSA Chile", countries: ["CL"] },
  { code: "MXNUAMPEGEN", name: "Peru Index", countries: ["PE"] },
  { code: "SOX", name: "PHLX Semiconductor", countries: ["US"] },
  { code: "HGX", name: "PHLX Housing", countries: ["US"] },
  { code: "OSX", name: "PHLX Oil Service", countries: ["US"] },
  { code: "XAU", name: "Gold/Silver Sector", countries: ["US"] },
  { code: "TRJEFFCRB", name: "Commodity Index", countries: ["US"] },
  { code: "MOVE", name: "Bond Volatility Index", countries: ["US"] },
];

export const SCREENER_FILTER_FIELDS: ScreenerFieldDefinition[] = [
  {
    key: "marketCountries",
    label: "Market",
    category: "security-info",
    inputType: "multiselect",
    supportsMultiSelect: true,
    options: COUNTRY_OPTIONS,
  },
  {
    key: "exchanges",
    label: "Exchange",
    category: "security-info",
    inputType: "multiselect",
    supportsMultiSelect: true,
  },
  {
    key: "watchlists",
    label: "Watchlist",
    category: "security-info",
    inputType: "multiselect",
    supportsMultiSelect: true,
    options: WATCHLIST_OPTIONS,
  },
  {
    key: "indices",
    label: "Index",
    category: "security-info",
    inputType: "multiselect",
    supportsMultiSelect: true,
    options: INDEX_OPTIONS.map((entry) => ({ value: entry.code, label: `${entry.code} - ${entry.name}` })),
  },
  { key: "primaryListingOnly", label: "Primary listing", category: "security-info", inputType: "toggle" },
  { key: "price", label: "Price", category: "market-data", inputType: "range" },
  { key: "changePercent", label: "Change %", category: "market-data", inputType: "range" },
  { key: "marketCap", label: "Market cap", category: "valuation", inputType: "range" },
  { key: "pe", label: "P/E", category: "valuation", inputType: "range" },
  { key: "epsDilGrowth", label: "EPS dil growth", category: "growth", inputType: "range" },
  { key: "divYieldPercent", label: "Div yield %", category: "dividends", inputType: "range" },
  { key: "sector", label: "Sector", category: "security-info", inputType: "multiselect", supportsMultiSelect: true },
  {
    key: "analystRating",
    label: "Analyst Rating",
    category: "technicals",
    inputType: "multiselect",
    supportsMultiSelect: true,
    options: ANALYST_RATING_OPTIONS,
  },
  { key: "perfPercent", label: "Perf %", category: "technicals", inputType: "range" },
  { key: "revenueGrowth", label: "Revenue growth", category: "growth", inputType: "range" },
  { key: "peg", label: "PEG", category: "valuation", inputType: "range" },
  { key: "roe", label: "ROE", category: "margins", inputType: "range" },
  { key: "beta", label: "Beta", category: "market-data", inputType: "range" },
  { key: "recentEarningsDate", label: "Recent earnings date", category: "financials", inputType: "date-range" },
  { key: "upcomingEarningsDate", label: "Upcoming earnings date", category: "financials", inputType: "date-range" },
];

export const SCREENER_COLUMN_FIELDS: ScreenerColumnDefinition[] = [
  { key: "symbol", label: "Symbol", category: "security-info" },
  { key: "name", label: "Name", category: "security-info" },
  { key: "price", label: "Price", category: "market-data", numeric: true },
  { key: "changePercent", label: "Change %", category: "market-data", numeric: true },
  { key: "volume", label: "Volume", category: "market-data", numeric: true },
  { key: "relVolume", label: "Rel Volume", category: "market-data", numeric: true },
  { key: "marketCap", label: "Market Cap", category: "valuation", numeric: true },
  { key: "pe", label: "P/E", category: "valuation", numeric: true },
  { key: "epsDilTtm", label: "EPS dil (TTM)", category: "financials", numeric: true },
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
];

export const DEFAULT_VISIBLE_COLUMNS = SCREENER_TABS.find((tab) => tab.key === "overview")?.defaultColumns ?? [
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

export const DB_SORTABLE_FIELDS = new Set([
  "symbol",
  "name",
  "marketCap",
  "volume",
  "priorityScore",
  "liquidityScore",
  "popularity",
]);

export const ALLOWED_SORT_FIELDS = new Set([
  ...DB_SORTABLE_FIELDS,
  "price",
  "changePercent",
  "relVolume",
  "pe",
  "epsDilTtm",
  "epsDilGrowth",
  "divYieldPercent",
  "analystRating",
  "perfPercent",
  "revenueGrowth",
  "peg",
  "roe",
  "beta",
  "recentEarningsDate",
  "upcomingEarningsDate",
]);

export const DEX_EXCHANGE_HINTS = ["DEX", "UNISWAP", "SUSHISWAP", "PANCAKESWAP", "RAYDIUM", "CURVE", "BALANCER"];

export const CEX_EXCHANGE_HINTS = ["BINANCE", "KRAKEN", "BITSTAMP", "COINBASE", "OKX", "BYBIT", "BITGET", "MEXC", "GATE"];
