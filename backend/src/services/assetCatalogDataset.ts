export type AssetCategory = "stocks" | "funds" | "futures" | "forex" | "crypto" | "indices" | "bonds" | "economy" | "options";
export type AssetMarketType = "Stocks" | "Funds" | "Futures" | "Forex" | "Crypto" | "Indices" | "Bonds" | "Economy" | "Options";

export interface AssetCatalogItem {
  ticker: string;
  symbol: string;
  name: string;
  exchange: string;
  region: string;
  instrumentType: string;
  type: string;
  category: AssetCategory;
  assetType: AssetCategory;
  market: AssetMarketType;
  country: string;
  sector: string;
  exchangeType: string;
  icon: string;
  exchangeIcon: string;
  exchangeLogoUrl: string;
  iconUrl: string;
  logoUrl: string;
  source: string;
  futureCategory?: string;
  economyCategory?: string;
  expiry?: string;
  strike?: string;
  underlyingAsset?: string;
  contracts?: AssetCatalogItem[];
}

export interface AssetSearchFilterOption {
  value: string;
  label: string;
  icon?: string;
  subtitle?: string;
}

export interface AssetSearchFiltersResponse {
  activeFilters: string[];
  countries: AssetSearchFilterOption[];
  types: AssetSearchFilterOption[];
  sectors: AssetSearchFilterOption[];
  sources: AssetSearchFilterOption[];
  exchangeTypes: AssetSearchFilterOption[];
  futureCategories: AssetSearchFilterOption[];
  economyCategories: AssetSearchFilterOption[];
  expiries: AssetSearchFilterOption[];
  strikes: AssetSearchFilterOption[];
  underlyingAssets: AssetSearchFilterOption[];
  sourceUiType?: "modal" | "dropdown";
}

export interface AssetSearchResponse {
  assets: AssetCatalogItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const CATEGORY_LABEL: Record<AssetCategory, AssetMarketType> = {
  stocks: "Stocks",
  funds: "Funds",
  futures: "Futures",
  forex: "Forex",
  crypto: "Crypto",
  indices: "Indices",
  bonds: "Bonds",
  economy: "Economy",
  options: "Options",
};

const EXCHANGE_ICON_BY_NAME: Record<string, string> = {
  NASDAQ: "https://logo.clearbit.com/nasdaq.com",
  NYSE: "https://logo.clearbit.com/nyse.com",
  NSE: "https://logo.clearbit.com/nseindia.com",
  BSE: "https://logo.clearbit.com/bseindia.com",
  ARCA: "https://logo.clearbit.com/nyse.com",
  LSE: "https://logo.clearbit.com/londonstockexchange.com",
  EURONEXT: "https://logo.clearbit.com/euronext.com",
  CME: "https://logo.clearbit.com/cmegroup.com",
  NYMEX: "https://logo.clearbit.com/cmegroup.com",
  COMEX: "https://logo.clearbit.com/cmegroup.com",
  CBOT: "https://logo.clearbit.com/cmegroup.com",
  OANDA: "https://logo.clearbit.com/oanda.com",
  FXCM: "https://logo.clearbit.com/fxcm.com",
  "FOREX.COM": "https://logo.clearbit.com/forex.com",
  SAXO: "https://logo.clearbit.com/home.saxo",
  BINANCE: "https://logo.clearbit.com/binance.com",
  COINBASE: "https://logo.clearbit.com/coinbase.com",
  KRAKEN: "https://logo.clearbit.com/kraken.com",
  BYBIT: "https://logo.clearbit.com/bybit.com",
  UNISWAP: "https://logo.clearbit.com/uniswap.org",
  "S&P": "https://logo.clearbit.com/spglobal.com",
  "DOW JONES": "https://logo.clearbit.com/dowjones.com",
  FTSE: "https://logo.clearbit.com/ftserussell.com",
  DAX: "https://logo.clearbit.com/deutsche-boerse.com",
  UST: "https://logo.clearbit.com/treasury.gov",
  FINRA: "https://logo.clearbit.com/finra.org",
  FRED: "https://logo.clearbit.com/stlouisfed.org",
  IMF: "https://logo.clearbit.com/imf.org",
  OECD: "https://logo.clearbit.com/oecd.org",
  "WORLD BANK": "https://logo.clearbit.com/worldbank.org",
  OPRA: "https://logo.clearbit.com/theocc.com",
};

function option(value: string, label: string, icon?: string, subtitle?: string): AssetSearchFilterOption {
  return { value, label, icon, subtitle };
}

export const STOCK_TYPE_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All Types"),
  option("common_stock", "Common Stock"),
  option("preferred_stock", "Preferred Stock"),
  option("etf", "ETF"),
  option("adr", "ADR"),
  option("reit", "REIT"),
  option("closed_end_fund", "Closed-End Fund"),
];

export const STOCK_SECTOR_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All Sectors"),
  option("technology", "Technology"),
  option("finance", "Finance"),
  option("healthcare", "Healthcare"),
  option("energy", "Energy"),
  option("consumer_cyclical", "Consumer Cyclical"),
  option("consumer_defensive", "Consumer Defensive"),
  option("industrials", "Industrials"),
  option("utilities", "Utilities"),
  option("real_estate", "Real Estate"),
  option("communication_services", "Communication Services"),
];

export const FUND_TYPE_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All Types"),
  option("etf", "ETF"),
  option("mutual_fund", "Mutual Fund"),
  option("index_fund", "Index Fund"),
];

export const FUTURE_CATEGORY_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All Categories"),
  option("equity_index", "Equity Index"),
  option("commodity", "Commodity"),
  option("currency", "Currency"),
  option("interest_rate", "Interest Rate"),
];

export const FOREX_SOURCE_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All Sources"),
  option("oanda", "OANDA", EXCHANGE_ICON_BY_NAME.OANDA),
  option("fxcm", "FXCM", EXCHANGE_ICON_BY_NAME.FXCM),
  option("forex_com", "FOREX.com", EXCHANGE_ICON_BY_NAME["FOREX.COM"]),
  option("saxo", "SAXO", EXCHANGE_ICON_BY_NAME.SAXO),
];

export const CRYPTO_SOURCE_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All Sources"),
  option("binance", "Binance", EXCHANGE_ICON_BY_NAME.BINANCE),
  option("coinbase", "Coinbase", EXCHANGE_ICON_BY_NAME.COINBASE),
  option("kraken", "Kraken", EXCHANGE_ICON_BY_NAME.KRAKEN),
  option("bybit", "Bybit", EXCHANGE_ICON_BY_NAME.BYBIT),
  option("uniswap", "Uniswap", EXCHANGE_ICON_BY_NAME.UNISWAP),
];

export const CRYPTO_TYPE_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All Types"),
  option("spot", "Spot"),
  option("perpetual", "Perpetual"),
  option("token", "Token"),
];

export const CRYPTO_EXCHANGE_TYPE_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All"),
  option("cex", "CEX"),
  option("dex", "DEX"),
];

export const INDEX_SOURCE_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All Sources"),
  option("nse", "NSE", EXCHANGE_ICON_BY_NAME.NSE),
  option("nasdaq", "NASDAQ", EXCHANGE_ICON_BY_NAME.NASDAQ),
  option("snp", "S&P", EXCHANGE_ICON_BY_NAME["S&P"]),
  option("dow_jones", "Dow Jones", EXCHANGE_ICON_BY_NAME["DOW JONES"]),
  option("ftse", "FTSE", EXCHANGE_ICON_BY_NAME.FTSE),
  option("dax", "DAX", EXCHANGE_ICON_BY_NAME.DAX),
];

export const BOND_TYPE_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All Types"),
  option("government", "Government"),
  option("corporate", "Corporate"),
];

export const ECONOMY_SOURCE_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All Sources"),
  option("fred", "FRED", EXCHANGE_ICON_BY_NAME.FRED),
  option("world_bank", "World Bank", EXCHANGE_ICON_BY_NAME["WORLD BANK"]),
  option("imf", "IMF", EXCHANGE_ICON_BY_NAME.IMF),
  option("oecd", "OECD", EXCHANGE_ICON_BY_NAME.OECD),
];

export const ECONOMY_CATEGORY_OPTIONS: AssetSearchFilterOption[] = [
  option("all", "All Categories"),
  option("inflation", "Inflation"),
  option("gdp", "GDP"),
  option("employment", "Employment"),
  option("interest_rates", "Interest Rates"),
  option("manufacturing", "Manufacturing"),
  option("consumer", "Consumer"),
];

const FALLBACK_COUNTRY_CODES = [
  "US", "IN", "GB", "DE", "FR", "JP", "CN", "CA", "AU", "SG", "CH", "AE", "BR", "MX", "ZA", "KR", "HK", "ES", "IT", "NL", "SE", "NO", "DK", "FI", "BE", "AT", "IE", "PT", "PL", "CZ", "HU", "RO", "GR", "TR", "IL", "SA", "QA", "KW", "EG", "NG", "KE", "MA", "AR", "CL", "CO", "PE", "NZ", "TH", "MY", "ID", "PH", "VN", "PK", "BD", "LK", "TW", "RU", "UA", "KZ", "LU", "IS", "EE", "LV", "LT",
];

function countryFlagUrl(code: string): string {
  return `https://flagcdn.com/${code.toLowerCase()}.svg`;
}

function buildGlobalCountryOptions(): AssetSearchFilterOption[] {
  const intlApi = Intl as unknown as {
    supportedValuesOf?: (key: string) => string[];
    DisplayNames?: new (locales?: string | string[], options?: { type: "region" }) => { of: (code: string) => string | undefined };
  };

  let dynamicCodes: string[] = [];
  if (typeof intlApi.supportedValuesOf === "function") {
    try {
      dynamicCodes = intlApi.supportedValuesOf("region");
    } catch {
      dynamicCodes = [];
    }
  }

  const mergedCodes = Array.from(new Set([...dynamicCodes, ...FALLBACK_COUNTRY_CODES]))
    .filter((code) => /^[A-Z]{2}$/.test(code) && code !== "ZZ");

  const display = typeof intlApi.DisplayNames === "function"
    ? new intlApi.DisplayNames(["en"], { type: "region" })
    : null;

  const countryOptions = mergedCodes
    .map((code) => option(code.toLowerCase(), display?.of(code) ?? code, countryFlagUrl(code)))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [option("all", "All Countries"), ...countryOptions];
}

export const GLOBAL_COUNTRY_OPTIONS = buildGlobalCountryOptions();

function exchangeLogo(exchange: string): string {
  return EXCHANGE_ICON_BY_NAME[exchange.toUpperCase()] ?? "https://logo.clearbit.com/cboe.com";
}

interface AssetSeedInput {
  ticker: string;
  name: string;
  category: AssetCategory;
  exchange: string;
  country: string;
  source: string;
  type: string;
  instrumentType: string;
  sector?: string;
  exchangeType?: string;
  iconUrl: string;
  futureCategory?: string;
  economyCategory?: string;
  expiry?: string;
  strike?: string;
  underlyingAsset?: string;
  contracts?: AssetCatalogItem[];
}

function createAsset(seed: AssetSeedInput): AssetCatalogItem {
  const normalizedCountry = (seed.country || "GLOBAL").toUpperCase();
  const exchangeLogoUrl = exchangeLogo(seed.exchange);

  return {
    ticker: seed.ticker,
    symbol: seed.ticker,
    name: seed.name,
    exchange: seed.exchange,
    region: normalizedCountry,
    instrumentType: seed.instrumentType,
    type: seed.type,
    category: seed.category,
    assetType: seed.category,
    market: CATEGORY_LABEL[seed.category],
    country: normalizedCountry,
    sector: seed.sector ?? "",
    exchangeType: seed.exchangeType ?? "cex",
    icon: seed.iconUrl,
    exchangeIcon: exchangeLogoUrl,
    exchangeLogoUrl,
    iconUrl: seed.iconUrl,
    logoUrl: seed.iconUrl,
    source: seed.source,
    futureCategory: seed.futureCategory,
    economyCategory: seed.economyCategory,
    expiry: seed.expiry,
    strike: seed.strike,
    underlyingAsset: seed.underlyingAsset,
    contracts: seed.contracts,
  };
}

const STOCKS: AssetCatalogItem[] = [
  createAsset({ ticker: "AAPL", name: "Apple Inc.", category: "stocks", exchange: "NASDAQ", country: "US", source: "nasdaq", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/apple.com" }),
  createAsset({ ticker: "RELIANCE.NS", name: "Reliance Industries", category: "stocks", exchange: "NSE", country: "IN", source: "nse", type: "common_stock", instrumentType: "Common Stock", sector: "energy_minerals", iconUrl: "https://logo.clearbit.com/ril.com" }),
  createAsset({ ticker: "TCS.NS", name: "Tata Consultancy Services", category: "stocks", exchange: "NSE", country: "IN", source: "nse", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/tcs.com" }),
  createAsset({ ticker: "JPM", name: "JPMorgan Chase & Co.", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "finance", iconUrl: "https://logo.clearbit.com/jpmorganchase.com" }),
  createAsset({ ticker: "PFE", name: "Pfizer Inc.", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "health_technology", iconUrl: "https://logo.clearbit.com/pfizer.com" }),
  createAsset({ ticker: "XOM", name: "Exxon Mobil Corporation", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "energy_minerals", iconUrl: "https://logo.clearbit.com/exxonmobil.com" }),
  createAsset({ ticker: "TSLA", name: "Tesla, Inc.", category: "stocks", exchange: "NASDAQ", country: "US", source: "nasdaq", type: "common_stock", instrumentType: "Common Stock", sector: "consumer_durables", iconUrl: "https://logo.clearbit.com/tesla.com" }),
  createAsset({ ticker: "PG", name: "The Procter & Gamble Company", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "consumer_non_durables", iconUrl: "https://logo.clearbit.com/pg.com" }),
  createAsset({ ticker: "CAT", name: "Caterpillar Inc.", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "producer_manufacturing", iconUrl: "https://logo.clearbit.com/caterpillar.com" }),
  createAsset({ ticker: "NEE", name: "NextEra Energy, Inc.", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "utilities", iconUrl: "https://logo.clearbit.com/nexteraenergy.com" }),
  createAsset({ ticker: "O", name: "Realty Income Corporation", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "reit", instrumentType: "REIT", sector: "finance", iconUrl: "https://logo.clearbit.com/realtyincome.com" }),
  createAsset({ ticker: "VZ", name: "Verizon Communications Inc.", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "communications", iconUrl: "https://logo.clearbit.com/verizon.com" }),
  createAsset({ ticker: "SPY", name: "SPDR S&P 500 ETF Trust", category: "stocks", exchange: "ARCA", country: "US", source: "nyse", type: "etf", instrumentType: "ETF", sector: "finance", iconUrl: "https://logo.clearbit.com/ssga.com" }),
  createAsset({ ticker: "BAC.PB", name: "Bank of America Series B Preferred", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "preferred_stock", instrumentType: "Preferred Stock", sector: "finance", iconUrl: "https://logo.clearbit.com/bankofamerica.com" }),
  createAsset({ ticker: "TSM", name: "Taiwan Semiconductor ADR", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "adr", instrumentType: "ADR", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/tsmc.com" }),
  createAsset({ ticker: "PDI", name: "PIMCO Dynamic Income Fund", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "closed_end_fund", instrumentType: "Closed-End Fund", sector: "finance", iconUrl: "https://logo.clearbit.com/pimco.com" }),

  // Additional US stocks
  createAsset({ ticker: "MSFT", name: "Microsoft Corporation", category: "stocks", exchange: "NASDAQ", country: "US", source: "nasdaq", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/microsoft.com" }),
  createAsset({ ticker: "AMZN", name: "Amazon.com, Inc.", category: "stocks", exchange: "NASDAQ", country: "US", source: "nasdaq", type: "common_stock", instrumentType: "Common Stock", sector: "consumer_durables", iconUrl: "https://logo.clearbit.com/amazon.com" }),
  createAsset({ ticker: "GOOGL", name: "Alphabet Inc.", category: "stocks", exchange: "NASDAQ", country: "US", source: "nasdaq", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/google.com" }),
  createAsset({ ticker: "META", name: "Meta Platforms, Inc.", category: "stocks", exchange: "NASDAQ", country: "US", source: "nasdaq", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/meta.com" }),
  createAsset({ ticker: "NVDA", name: "NVIDIA Corporation", category: "stocks", exchange: "NASDAQ", country: "US", source: "nasdaq", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/nvidia.com" }),
  createAsset({ ticker: "BRK.B", name: "Berkshire Hathaway Inc.", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "finance", iconUrl: "https://logo.clearbit.com/berkshirehathaway.com" }),
  createAsset({ ticker: "UNH", name: "UnitedHealth Group Inc.", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "health_technology", iconUrl: "https://logo.clearbit.com/unitedhealthgroup.com" }),
  createAsset({ ticker: "V", name: "Visa Inc.", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "finance", iconUrl: "https://logo.clearbit.com/visa.com" }),
  createAsset({ ticker: "MA", name: "Mastercard Incorporated", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "finance", iconUrl: "https://logo.clearbit.com/mastercard.com" }),
  createAsset({ ticker: "HD", name: "The Home Depot, Inc.", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "consumer_durables", iconUrl: "https://logo.clearbit.com/homedepot.com" }),
  createAsset({ ticker: "DIS", name: "The Walt Disney Company", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "communications", iconUrl: "https://logo.clearbit.com/disney.com" }),
  createAsset({ ticker: "NFLX", name: "Netflix, Inc.", category: "stocks", exchange: "NASDAQ", country: "US", source: "nasdaq", type: "common_stock", instrumentType: "Common Stock", sector: "communications", iconUrl: "https://logo.clearbit.com/netflix.com" }),
  createAsset({ ticker: "CRM", name: "Salesforce, Inc.", category: "stocks", exchange: "NYSE", country: "US", source: "nyse", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/salesforce.com" }),
  createAsset({ ticker: "AMD", name: "Advanced Micro Devices, Inc.", category: "stocks", exchange: "NASDAQ", country: "US", source: "nasdaq", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/amd.com" }),
  createAsset({ ticker: "INTC", name: "Intel Corporation", category: "stocks", exchange: "NASDAQ", country: "US", source: "nasdaq", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/intel.com" }),

  // India stocks
  createAsset({ ticker: "INFY.NS", name: "Infosys Limited", category: "stocks", exchange: "NSE", country: "IN", source: "nse", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/infosys.com" }),
  createAsset({ ticker: "HDFCBANK.NS", name: "HDFC Bank Limited", category: "stocks", exchange: "NSE", country: "IN", source: "nse", type: "common_stock", instrumentType: "Common Stock", sector: "finance", iconUrl: "https://logo.clearbit.com/hdfcbank.com" }),
  createAsset({ ticker: "ICICIBANK.NS", name: "ICICI Bank Limited", category: "stocks", exchange: "NSE", country: "IN", source: "nse", type: "common_stock", instrumentType: "Common Stock", sector: "finance", iconUrl: "https://logo.clearbit.com/icicibank.com" }),
  createAsset({ ticker: "WIPRO.NS", name: "Wipro Limited", category: "stocks", exchange: "NSE", country: "IN", source: "nse", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/wipro.com" }),
  createAsset({ ticker: "SBIN.NS", name: "State Bank of India", category: "stocks", exchange: "NSE", country: "IN", source: "nse", type: "common_stock", instrumentType: "Common Stock", sector: "finance", iconUrl: "https://logo.clearbit.com/onlinesbi.com" }),
  createAsset({ ticker: "ITC.NS", name: "ITC Limited", category: "stocks", exchange: "NSE", country: "IN", source: "nse", type: "common_stock", instrumentType: "Common Stock", sector: "consumer_non_durables", iconUrl: "https://logo.clearbit.com/itcportal.com" }),

  // UK stocks
  createAsset({ ticker: "SHEL.L", name: "Shell plc", category: "stocks", exchange: "LSE", country: "GB", source: "lse", type: "common_stock", instrumentType: "Common Stock", sector: "energy_minerals", iconUrl: "https://logo.clearbit.com/shell.com" }),
  createAsset({ ticker: "HSBA.L", name: "HSBC Holdings plc", category: "stocks", exchange: "LSE", country: "GB", source: "lse", type: "common_stock", instrumentType: "Common Stock", sector: "finance", iconUrl: "https://logo.clearbit.com/hsbc.com" }),
  createAsset({ ticker: "AZN.L", name: "AstraZeneca PLC", category: "stocks", exchange: "LSE", country: "GB", source: "lse", type: "common_stock", instrumentType: "Common Stock", sector: "health_technology", iconUrl: "https://logo.clearbit.com/astrazeneca.com" }),

  // Germany stocks
  createAsset({ ticker: "SAP.DE", name: "SAP SE", category: "stocks", exchange: "XETRA", country: "DE", source: "xetra", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/sap.com" }),
  createAsset({ ticker: "SIE.DE", name: "Siemens AG", category: "stocks", exchange: "XETRA", country: "DE", source: "xetra", type: "common_stock", instrumentType: "Common Stock", sector: "producer_manufacturing", iconUrl: "https://logo.clearbit.com/siemens.com" }),

  // Japan stocks
  createAsset({ ticker: "7203.T", name: "Toyota Motor Corporation", category: "stocks", exchange: "TSE", country: "JP", source: "tse", type: "common_stock", instrumentType: "Common Stock", sector: "consumer_durables", iconUrl: "https://logo.clearbit.com/toyota.com" }),
  createAsset({ ticker: "6758.T", name: "Sony Group Corporation", category: "stocks", exchange: "TSE", country: "JP", source: "tse", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/sony.com" }),

  // Canada stocks  
  createAsset({ ticker: "SHOP.TO", name: "Shopify Inc.", category: "stocks", exchange: "TSX", country: "CA", source: "tsx", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/shopify.com" }),
  createAsset({ ticker: "RY.TO", name: "Royal Bank of Canada", category: "stocks", exchange: "TSX", country: "CA", source: "tsx", type: "common_stock", instrumentType: "Common Stock", sector: "finance", iconUrl: "https://logo.clearbit.com/rbc.com" }),

  // Australia stocks
  createAsset({ ticker: "BHP.AX", name: "BHP Group Limited", category: "stocks", exchange: "ASX", country: "AU", source: "asx", type: "common_stock", instrumentType: "Common Stock", sector: "energy_minerals", iconUrl: "https://logo.clearbit.com/bhp.com" }),

  // South Korea
  createAsset({ ticker: "005930.KS", name: "Samsung Electronics", category: "stocks", exchange: "KRX", country: "KR", source: "krx", type: "common_stock", instrumentType: "Common Stock", sector: "electronic_technology", iconUrl: "https://logo.clearbit.com/samsung.com" }),
];

const FUNDS: AssetCatalogItem[] = [
  createAsset({ ticker: "VTI", name: "Vanguard Total Stock Market ETF", category: "funds", exchange: "ARCA", country: "US", source: "vanguard", type: "etf", instrumentType: "ETF", iconUrl: "https://logo.clearbit.com/vanguard.com" }),
  createAsset({ ticker: "QQQ", name: "Invesco QQQ Trust", category: "funds", exchange: "NASDAQ", country: "US", source: "invesco", type: "etf", instrumentType: "ETF", iconUrl: "https://logo.clearbit.com/invesco.com" }),
  createAsset({ ticker: "IVV", name: "iShares Core S&P 500 ETF", category: "funds", exchange: "ARCA", country: "US", source: "blackrock", type: "etf", instrumentType: "ETF", iconUrl: "https://logo.clearbit.com/ishares.com" }),
  createAsset({ ticker: "VFIAX", name: "Vanguard 500 Index Admiral", category: "funds", exchange: "NASDAQ", country: "US", source: "vanguard", type: "mutual_fund", instrumentType: "Mutual Fund", iconUrl: "https://logo.clearbit.com/vanguard.com" }),
  createAsset({ ticker: "SWPPX", name: "Schwab S&P 500 Index Fund", category: "funds", exchange: "NASDAQ", country: "US", source: "schwab", type: "mutual_fund", instrumentType: "Mutual Fund", iconUrl: "https://logo.clearbit.com/schwab.com" }),
  createAsset({ ticker: "HDFC500", name: "HDFC Nifty 500 Index Fund", category: "funds", exchange: "NSE", country: "IN", source: "hdfc", type: "mutual_fund", instrumentType: "Mutual Fund", iconUrl: "https://logo.clearbit.com/hdfcfund.com" }),
  createAsset({ ticker: "MFSX", name: "MFS Growth Fund", category: "funds", exchange: "NYSE", country: "US", source: "mfs", type: "mutual_fund", instrumentType: "Mutual Fund", iconUrl: "https://logo.clearbit.com/mfs.com" }),
  createAsset({ ticker: "ISF", name: "iShares Core FTSE 100 UCITS ETF", category: "funds", exchange: "LSE", country: "GB", source: "blackrock", type: "etf", instrumentType: "ETF", iconUrl: "https://logo.clearbit.com/ishares.com" }),
  createAsset({ ticker: "BRKR", name: "Brookfield Real Estate Trust", category: "funds", exchange: "NYSE", country: "US", source: "brookfield", type: "trust", instrumentType: "Trust", iconUrl: "https://logo.clearbit.com/brookfield.com" }),
  createAsset({ ticker: "EQNR.TO", name: "EQ Bank Income Trust", category: "funds", exchange: "TSX", country: "CA", source: "tsx", type: "trust", instrumentType: "Trust", iconUrl: "https://logo.clearbit.com/eqbank.ca" }),
  createAsset({ ticker: "AMT", name: "American Tower Corporation REIT", category: "funds", exchange: "NYSE", country: "US", source: "nyse", type: "reit", instrumentType: "REIT", iconUrl: "https://logo.clearbit.com/americantower.com" }),
  createAsset({ ticker: "PLD", name: "Prologis Inc. REIT", category: "funds", exchange: "NYSE", country: "US", source: "nyse", type: "reit", instrumentType: "REIT", iconUrl: "https://logo.clearbit.com/prologis.com" }),
  createAsset({ ticker: "DLR", name: "Digital Realty Trust REIT", category: "funds", exchange: "NYSE", country: "US", source: "nyse", type: "reit", instrumentType: "REIT", iconUrl: "https://logo.clearbit.com/digitalrealty.com" }),
  createAsset({ ticker: "ARKK", name: "ARK Innovation ETF", category: "funds", exchange: "ARCA", country: "US", source: "ark", type: "etf", instrumentType: "ETF", iconUrl: "https://logo.clearbit.com/ark-invest.com" }),
  createAsset({ ticker: "GLD", name: "SPDR Gold Shares ETF", category: "funds", exchange: "ARCA", country: "US", source: "spdr", type: "etf", instrumentType: "ETF", iconUrl: "https://logo.clearbit.com/spdrgoldshares.com" }),
  createAsset({ ticker: "FXAIX", name: "Fidelity 500 Index Fund", category: "funds", exchange: "NASDAQ", country: "US", source: "fidelity", type: "mutual_fund", instrumentType: "Mutual Fund", iconUrl: "https://logo.clearbit.com/fidelity.com" }),
];

function buildFutureContracts(baseTicker: string, namePrefix: string, exchange: string, country: string, source: string, futureCategory: string, iconUrl: string): AssetCatalogItem[] {
  return [
    createAsset({ ticker: `${baseTicker}-JUN26`, name: `${namePrefix} JUN 2026`, category: "futures", exchange, country, source, type: "future_contract", instrumentType: "Future Contract", sector: futureCategory, futureCategory, iconUrl }),
    createAsset({ ticker: `${baseTicker}-JUL26`, name: `${namePrefix} JUL 2026`, category: "futures", exchange, country, source, type: "future_contract", instrumentType: "Future Contract", sector: futureCategory, futureCategory, iconUrl }),
    createAsset({ ticker: `${baseTicker}-AUG26`, name: `${namePrefix} AUG 2026`, category: "futures", exchange, country, source, type: "future_contract", instrumentType: "Future Contract", sector: futureCategory, futureCategory, iconUrl }),
  ];
}

const FUTURES: AssetCatalogItem[] = [
  createAsset({
    ticker: "ES",
    name: "E-Mini S&P 500 Futures",
    category: "futures",
    exchange: "CME",
    country: "US",
    source: "cme",
    type: "future",
    instrumentType: "Future",
    sector: "world_indices",
    futureCategory: "world_indices",
    iconUrl: "https://logo.clearbit.com/cmegroup.com",
    contracts: buildFutureContracts("ES", "E-Mini S&P 500", "CME", "US", "cme", "equity_index", "https://logo.clearbit.com/cmegroup.com"),
  }),
  createAsset({
    ticker: "NIFTY",
    name: "NIFTY 50 Futures",
    category: "futures",
    exchange: "NSE",
    country: "IN",
    source: "nse",
    type: "future",
    instrumentType: "Future",
    sector: "world_indices",
    futureCategory: "world_indices",
    iconUrl: "https://logo.clearbit.com/nseindia.com",
    contracts: buildFutureContracts("NIFTY", "NIFTY 50", "NSE", "IN", "nse", "equity_index", "https://logo.clearbit.com/nseindia.com"),
  }),
  createAsset({
    ticker: "CL",
    name: "Crude Oil Futures",
    category: "futures",
    exchange: "NYMEX",
    country: "US",
    source: "cme",
    type: "future",
    instrumentType: "Future",
    sector: "commodity",
    futureCategory: "energy",
    iconUrl: "https://logo.clearbit.com/cmegroup.com",
    contracts: buildFutureContracts("CL", "Crude Oil", "NYMEX", "US", "cme", "commodity", "https://logo.clearbit.com/cmegroup.com"),
  }),
  createAsset({
    ticker: "GC",
    name: "Gold Futures",
    category: "futures",
    exchange: "COMEX",
    country: "US",
    source: "cme",
    type: "future",
    instrumentType: "Future",
    sector: "commodity",
    futureCategory: "energy",
    iconUrl: "https://logo.clearbit.com/cmegroup.com",
    contracts: buildFutureContracts("GC", "Gold", "CME", "US", "cme", "commodity", "https://logo.clearbit.com/cmegroup.com"),
  }),
  createAsset({
    ticker: "6E",
    name: "Euro FX Futures",
    category: "futures",
    exchange: "CME",
    country: "US",
    source: "cme",
    type: "future",
    instrumentType: "Future",
    sector: "currency",
    futureCategory: "currencies",
    iconUrl: "https://logo.clearbit.com/cmegroup.com",
    contracts: buildFutureContracts("6E", "Euro FX", "CME", "US", "cme", "currency", "https://logo.clearbit.com/cmegroup.com"),
  }),
  createAsset({
    ticker: "ZN",
    name: "10-Year T-Note Futures",
    category: "futures",
    exchange: "CBOT",
    country: "US",
    source: "cme",
    type: "future",
    instrumentType: "Future",
    sector: "interest_rate",
    futureCategory: "interest_rates",
    iconUrl: "https://logo.clearbit.com/cmegroup.com",
    contracts: buildFutureContracts("ZN", "10-Year T-Note", "CBOT", "US", "cme", "interest_rate", "https://logo.clearbit.com/cmegroup.com"),
  }),
];

const FOREX: AssetCatalogItem[] = [
  createAsset({ ticker: "EURUSD", name: "Euro / US Dollar", category: "forex", exchange: "OANDA", country: "GLOBAL", source: "oanda", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/eu.svg" }),
  createAsset({ ticker: "GBPUSD", name: "British Pound / US Dollar", category: "forex", exchange: "FXCM", country: "GLOBAL", source: "fxcm", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/gb.svg" }),
  createAsset({ ticker: "USDJPY", name: "US Dollar / Japanese Yen", category: "forex", exchange: "FOREX.COM", country: "GLOBAL", source: "forex_com", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/jp.svg" }),
  createAsset({ ticker: "AUDUSD", name: "Australian Dollar / US Dollar", category: "forex", exchange: "SAXO", country: "GLOBAL", source: "saxo", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/au.svg" }),
  createAsset({ ticker: "USDINR", name: "US Dollar / Indian Rupee", category: "forex", exchange: "OANDA", country: "GLOBAL", source: "oanda", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/in.svg" }),
  createAsset({ ticker: "USDCAD", name: "US Dollar / Canadian Dollar", category: "forex", exchange: "FXCM", country: "GLOBAL", source: "fxcm", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/ca.svg" }),
  createAsset({ ticker: "USDCHF", name: "US Dollar / Swiss Franc", category: "forex", exchange: "FOREX.COM", country: "GLOBAL", source: "forex_com", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/ch.svg" }),
  createAsset({ ticker: "NZDUSD", name: "New Zealand Dollar / US Dollar", category: "forex", exchange: "SAXO", country: "GLOBAL", source: "saxo", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/nz.svg" }),

  // Additional forex pairs from other sources
  createAsset({ ticker: "EURGBP", name: "Euro / British Pound", category: "forex", exchange: "FXOPEN", country: "GLOBAL", source: "fxopen", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/eu.svg" }),
  createAsset({ ticker: "EURJPY", name: "Euro / Japanese Yen", category: "forex", exchange: "PEPPERSTONE", country: "GLOBAL", source: "pepperstone", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/eu.svg" }),
  createAsset({ ticker: "GBPJPY", name: "British Pound / Japanese Yen", category: "forex", exchange: "IG", country: "GLOBAL", source: "ig", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/gb.svg" }),
  createAsset({ ticker: "AUDCAD", name: "Australian Dollar / Canadian Dollar", category: "forex", exchange: "EIGHTCAP", country: "GLOBAL", source: "eightcap", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/au.svg" }),
  createAsset({ ticker: "USDSGD", name: "US Dollar / Singapore Dollar", category: "forex", exchange: "OANDA", country: "GLOBAL", source: "oanda", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/sg.svg" }),
  createAsset({ ticker: "USDZAR", name: "US Dollar / South African Rand", category: "forex", exchange: "FXCM", country: "GLOBAL", source: "fxcm", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/za.svg" }),
  createAsset({ ticker: "USDMXN", name: "US Dollar / Mexican Peso", category: "forex", exchange: "IG", country: "GLOBAL", source: "ig", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/mx.svg" }),
  createAsset({ ticker: "EURCHF", name: "Euro / Swiss Franc", category: "forex", exchange: "PEPPERSTONE", country: "GLOBAL", source: "pepperstone", type: "spot", instrumentType: "Forex Spot", iconUrl: "https://flagcdn.com/eu.svg" }),
];

const CRYPTO: AssetCatalogItem[] = [
  createAsset({ ticker: "BTCUSDT", name: "Bitcoin / Tether", category: "crypto", exchange: "BINANCE", country: "GLOBAL", source: "binance", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png" }),
  createAsset({ ticker: "ETHUSDT", name: "Ethereum / Tether", category: "crypto", exchange: "COINBASE", country: "GLOBAL", source: "coinbase", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" }),
  createAsset({ ticker: "SOLUSDT", name: "Solana / Tether", category: "crypto", exchange: "BINANCE", country: "GLOBAL", source: "binance", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/4128/large/solana.png" }),
  createAsset({ ticker: "BNBUSDT", name: "BNB / Tether", category: "crypto", exchange: "BINANCE", country: "GLOBAL", source: "binance", type: "token", instrumentType: "Token", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png" }),
  createAsset({ ticker: "BTC-PERP", name: "Bitcoin Perpetual", category: "crypto", exchange: "BYBIT", country: "GLOBAL", source: "bybit", type: "swap", instrumentType: "Swap", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png" }),
  createAsset({ ticker: "ETH-PERP", name: "Ethereum Perpetual", category: "crypto", exchange: "KRAKEN", country: "GLOBAL", source: "kraken", type: "swap", instrumentType: "Swap", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" }),
  createAsset({ ticker: "UNIUSD", name: "Uniswap Token", category: "crypto", exchange: "UNISWAP", country: "GLOBAL", source: "uniswap", type: "token", instrumentType: "Token", exchangeType: "dex", iconUrl: "https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png" }),
  createAsset({ ticker: "AAVEUSD", name: "Aave Token", category: "crypto", exchange: "UNISWAP", country: "GLOBAL", source: "uniswap", type: "token", instrumentType: "Token", exchangeType: "dex", iconUrl: "https://assets.coingecko.com/coins/images/12645/large/AAVE.png" }),

  // More CEX spot pairs
  createAsset({ ticker: "XRPUSDT", name: "XRP / Tether", category: "crypto", exchange: "BINANCE", country: "GLOBAL", source: "binance", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png" }),
  createAsset({ ticker: "ADAUSDT", name: "Cardano / Tether", category: "crypto", exchange: "COINBASE", country: "GLOBAL", source: "coinbase", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/975/large/cardano.png" }),
  createAsset({ ticker: "DOGEUSDT", name: "Dogecoin / Tether", category: "crypto", exchange: "BINANCE", country: "GLOBAL", source: "binance", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png" }),
  createAsset({ ticker: "AVAXUSDT", name: "Avalanche / Tether", category: "crypto", exchange: "OKX", country: "GLOBAL", source: "okx", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png" }),
  createAsset({ ticker: "DOTUSDT", name: "Polkadot / Tether", category: "crypto", exchange: "KRAKEN", country: "GLOBAL", source: "kraken", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/12171/large/polkadot.png" }),
  createAsset({ ticker: "LINKUSDT", name: "Chainlink / Tether", category: "crypto", exchange: "GATE.IO", country: "GLOBAL", source: "gate_io", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png" }),
  createAsset({ ticker: "MATICUSDT", name: "Polygon / Tether", category: "crypto", exchange: "KUCOIN", country: "GLOBAL", source: "kucoin", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png" }),
  createAsset({ ticker: "SHIBUSDT", name: "Shiba Inu / Tether", category: "crypto", exchange: "MEXC", country: "GLOBAL", source: "mexc", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/11939/large/shiba.png" }),
  createAsset({ ticker: "LTCBTC", name: "Litecoin / Bitcoin", category: "crypto", exchange: "BITFINEX", country: "GLOBAL", source: "bitfinex", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/2/large/litecoin.png" }),
  createAsset({ ticker: "BTCEUR", name: "Bitcoin / Euro", category: "crypto", exchange: "BITSTAMP", country: "GLOBAL", source: "bitstamp", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png" }),
  createAsset({ ticker: "ETHBTC", name: "Ethereum / Bitcoin", category: "crypto", exchange: "CRYPTO.COM", country: "GLOBAL", source: "crypto_com", type: "spot", instrumentType: "Spot", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" }),

  // More perpetuals
  createAsset({ ticker: "SOL-PERP", name: "Solana Perpetual", category: "crypto", exchange: "BYBIT", country: "GLOBAL", source: "bybit", type: "swap", instrumentType: "Swap", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/4128/large/solana.png" }),
  createAsset({ ticker: "XRP-PERP", name: "XRP Perpetual", category: "crypto", exchange: "OKX", country: "GLOBAL", source: "okx", type: "swap", instrumentType: "Swap", exchangeType: "cex", iconUrl: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png" }),

  // DeFi tokens
  createAsset({ ticker: "CAKEUSD", name: "PancakeSwap Token", category: "crypto", exchange: "PANCAKESWAP", country: "GLOBAL", source: "pancakeswap", type: "fundamental", instrumentType: "Fundamental", exchangeType: "dex", iconUrl: "https://assets.coingecko.com/coins/images/12632/large/pancakeswap-cake-logo.png" }),
  createAsset({ ticker: "SUSHIUSD", name: "SushiSwap Token", category: "crypto", exchange: "UNISWAP", country: "GLOBAL", source: "uniswap", type: "fundamental", instrumentType: "Fundamental", exchangeType: "dex", iconUrl: "https://assets.coingecko.com/coins/images/12271/large/512x512_Logo_no_chop.png" }),
];

const INDICES: AssetCatalogItem[] = [
  createAsset({ ticker: "NIFTY50", name: "NIFTY 50", category: "indices", exchange: "NSE", country: "IN", source: "nse", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/nseindia.com" }),
  createAsset({ ticker: "IXIC", name: "NASDAQ Composite", category: "indices", exchange: "NASDAQ", country: "US", source: "nasdaq", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/nasdaq.com" }),
  createAsset({ ticker: "SPX", name: "S&P 500", category: "indices", exchange: "S&P", country: "US", source: "snp", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/spglobal.com" }),
  createAsset({ ticker: "DJI", name: "Dow Jones Industrial Average", category: "indices", exchange: "DOW JONES", country: "US", source: "dow_jones", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/dowjones.com" }),
  createAsset({ ticker: "FTSE100", name: "FTSE 100", category: "indices", exchange: "FTSE", country: "GB", source: "ftse", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/ftserussell.com" }),
  createAsset({ ticker: "DAX40", name: "DAX 40", category: "indices", exchange: "DAX", country: "DE", source: "dax", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/deutsche-boerse.com" }),

  // Additional indices
  createAsset({ ticker: "N225", name: "Nikkei 225", category: "indices", exchange: "NIKKEI", country: "JP", source: "nikkei", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/nikkei.com" }),
  createAsset({ ticker: "HSI", name: "Hang Seng Index", category: "indices", exchange: "HANG SENG", country: "HK", source: "hang_seng", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/hsi.com.hk" }),
  createAsset({ ticker: "SSEC", name: "Shanghai Composite", category: "indices", exchange: "SSE", country: "CN", source: "shanghai", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/sse.com.cn" }),
  createAsset({ ticker: "KOSPI", name: "KOSPI Composite Index", category: "indices", exchange: "KRX", country: "KR", source: "kospi", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/krx.co.kr" }),
  createAsset({ ticker: "MSCIW", name: "MSCI World Index", category: "indices", exchange: "MSCI", country: "GLOBAL", source: "msci", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/msci.com" }),
  createAsset({ ticker: "RUT", name: "Russell 2000", category: "indices", exchange: "RUSSELL", country: "US", source: "russell", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/ftserussell.com" }),
  createAsset({ ticker: "SENSEX", name: "BSE SENSEX", category: "indices", exchange: "BSE", country: "IN", source: "bse", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/bseindia.com" }),
  createAsset({ ticker: "NIFTYBANK", name: "NIFTY Bank", category: "indices", exchange: "NSE", country: "IN", source: "nse", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/nseindia.com" }),
  createAsset({ ticker: "CAC40", name: "CAC 40", category: "indices", exchange: "EURONEXT", country: "FR", source: "euronext", type: "index", instrumentType: "Index", iconUrl: "https://logo.clearbit.com/euronext.com" }),
];

const BONDS: AssetCatalogItem[] = [
  createAsset({ ticker: "US10Y", name: "US 10Y Treasury Note", category: "bonds", exchange: "UST", country: "US", source: "treasury", type: "government", instrumentType: "Government", iconUrl: "https://logo.clearbit.com/treasury.gov" }),
  createAsset({ ticker: "US30Y", name: "US 30Y Treasury Bond", category: "bonds", exchange: "UST", country: "US", source: "treasury", type: "government", instrumentType: "Government", iconUrl: "https://logo.clearbit.com/treasury.gov" }),
  createAsset({ ticker: "IN10Y", name: "India 10Y Government Bond", category: "bonds", exchange: "NSE", country: "IN", source: "nse", type: "government", instrumentType: "Government", iconUrl: "https://logo.clearbit.com/rbi.org.in" }),
  createAsset({ ticker: "DE10Y", name: "Germany 10Y Bund", category: "bonds", exchange: "DAX", country: "DE", source: "bund", type: "government", instrumentType: "Government", iconUrl: "https://logo.clearbit.com/bundesbank.de" }),
  createAsset({ ticker: "AAPL2030", name: "Apple 2030 Corporate Bond", category: "bonds", exchange: "FINRA", country: "US", source: "finra", type: "corporate", instrumentType: "Corporate", iconUrl: "https://logo.clearbit.com/apple.com" }),
  createAsset({ ticker: "MSFT2031", name: "Microsoft 2031 Corporate Bond", category: "bonds", exchange: "FINRA", country: "US", source: "finra", type: "corporate", instrumentType: "Corporate", iconUrl: "https://logo.clearbit.com/microsoft.com" }),
  createAsset({ ticker: "TSLA2029", name: "Tesla 2029 Corporate Bond", category: "bonds", exchange: "FINRA", country: "US", source: "finra", type: "corporate", instrumentType: "Corporate", iconUrl: "https://logo.clearbit.com/tesla.com" }),
  createAsset({ ticker: "RIL2032", name: "Reliance 2032 Corporate Bond", category: "bonds", exchange: "NSE", country: "IN", source: "nse", type: "corporate", instrumentType: "Corporate", iconUrl: "https://logo.clearbit.com/ril.com" }),
];

const ECONOMY: AssetCatalogItem[] = [
  createAsset({ ticker: "US_CPI", name: "US Consumer Price Index", category: "economy", exchange: "FRED", country: "US", source: "fred", type: "macro", instrumentType: "Inflation", iconUrl: "https://logo.clearbit.com/stlouisfed.org", economyCategory: "prices" }),
  createAsset({ ticker: "EU_HICP", name: "Euro Area HICP", category: "economy", exchange: "OECD", country: "DE", source: "oecd", type: "macro", instrumentType: "Inflation", iconUrl: "https://logo.clearbit.com/oecd.org", economyCategory: "prices" }),
  createAsset({ ticker: "US_GDP", name: "US Real GDP Growth", category: "economy", exchange: "FRED", country: "US", source: "fred", type: "macro", instrumentType: "GDP", iconUrl: "https://logo.clearbit.com/stlouisfed.org", economyCategory: "gdp" }),
  createAsset({ ticker: "IN_GDP", name: "India GDP Growth", category: "economy", exchange: "WORLD BANK", country: "IN", source: "world_bank", type: "macro", instrumentType: "GDP", iconUrl: "https://logo.clearbit.com/worldbank.org", economyCategory: "gdp" }),
  createAsset({ ticker: "US_NFP", name: "US Non-Farm Payrolls", category: "economy", exchange: "FRED", country: "US", source: "fred", type: "macro", instrumentType: "Employment", iconUrl: "https://logo.clearbit.com/stlouisfed.org", economyCategory: "labor" }),
  createAsset({ ticker: "EU_UNEMP", name: "Euro Area Unemployment Rate", category: "economy", exchange: "OECD", country: "FR", source: "oecd", type: "macro", instrumentType: "Employment", iconUrl: "https://logo.clearbit.com/oecd.org", economyCategory: "labor" }),
  createAsset({ ticker: "FED_FUNDS", name: "US Federal Funds Rate", category: "economy", exchange: "FRED", country: "US", source: "fred", type: "macro", instrumentType: "Interest Rates", iconUrl: "https://logo.clearbit.com/stlouisfed.org", economyCategory: "money" }),
  createAsset({ ticker: "ECB_RATE", name: "ECB Main Refinancing Rate", category: "economy", exchange: "IMF", country: "DE", source: "imf", type: "macro", instrumentType: "Interest Rates", iconUrl: "https://logo.clearbit.com/imf.org", economyCategory: "money" }),
  createAsset({ ticker: "US_ISM_PMI", name: "US ISM Manufacturing PMI", category: "economy", exchange: "FRED", country: "US", source: "fred", type: "macro", instrumentType: "Manufacturing", iconUrl: "https://logo.clearbit.com/stlouisfed.org", economyCategory: "business" }),
  createAsset({ ticker: "CN_PMI", name: "China Manufacturing PMI", category: "economy", exchange: "IMF", country: "CN", source: "imf", type: "macro", instrumentType: "Manufacturing", iconUrl: "https://logo.clearbit.com/imf.org", economyCategory: "business" }),
  createAsset({ ticker: "US_CONFIDENCE", name: "US Consumer Confidence", category: "economy", exchange: "FRED", country: "US", source: "fred", type: "macro", instrumentType: "Consumer", iconUrl: "https://logo.clearbit.com/stlouisfed.org", economyCategory: "consumer" }),
  createAsset({ ticker: "IN_CONSUMER", name: "India Consumer Sentiment", category: "economy", exchange: "WORLD BANK", country: "IN", source: "world_bank", type: "macro", instrumentType: "Consumer", iconUrl: "https://logo.clearbit.com/worldbank.org", economyCategory: "consumer" }),
  createAsset({ ticker: "US_TRADE", name: "US Trade Balance", category: "economy", exchange: "FRED", country: "US", source: "fred", type: "macro", instrumentType: "Trade", iconUrl: "https://logo.clearbit.com/stlouisfed.org", economyCategory: "trade" }),
  createAsset({ ticker: "US_GOVT_DEBT", name: "US Government Debt to GDP", category: "economy", exchange: "FRED", country: "US", source: "fred", type: "macro", instrumentType: "Government", iconUrl: "https://logo.clearbit.com/stlouisfed.org", economyCategory: "government" }),
  createAsset({ ticker: "US_HOUSING", name: "US Housing Starts", category: "economy", exchange: "FRED", country: "US", source: "fred", type: "macro", instrumentType: "Housing", iconUrl: "https://logo.clearbit.com/stlouisfed.org", economyCategory: "housing" }),
  createAsset({ ticker: "US_TAX_REV", name: "US Federal Tax Revenue", category: "economy", exchange: "FRED", country: "US", source: "fred", type: "macro", instrumentType: "Taxes", iconUrl: "https://logo.clearbit.com/stlouisfed.org", economyCategory: "taxes" }),
  createAsset({ ticker: "EU_GDP", name: "EU GDP Growth Rate", category: "economy", exchange: "OECD", country: "DE", source: "oecd", type: "macro", instrumentType: "GDP", iconUrl: "https://logo.clearbit.com/oecd.org", economyCategory: "gdp" }),
  createAsset({ ticker: "EU_TRADE", name: "EU Trade Balance", category: "economy", exchange: "OECD", country: "DE", source: "oecd", type: "macro", instrumentType: "Trade", iconUrl: "https://logo.clearbit.com/oecd.org", economyCategory: "trade" }),
  createAsset({ ticker: "IN_CPI", name: "India Consumer Price Index", category: "economy", exchange: "WORLD BANK", country: "IN", source: "world_bank", type: "macro", instrumentType: "Prices", iconUrl: "https://logo.clearbit.com/worldbank.org", economyCategory: "prices" }),
  createAsset({ ticker: "GLOBAL_HEALTH", name: "Global Health Expenditure", category: "economy", exchange: "WORLD BANK", country: "GLOBAL", source: "world_bank", type: "macro", instrumentType: "Health", iconUrl: "https://logo.clearbit.com/worldbank.org", economyCategory: "health" }),
  createAsset({ ticker: "US_M2", name: "US M2 Money Supply", category: "economy", exchange: "FRED", country: "US", source: "fred", type: "macro", instrumentType: "Money", iconUrl: "https://logo.clearbit.com/stlouisfed.org", economyCategory: "money" }),
];

const OPTIONS: AssetCatalogItem[] = [
  // AAPL options — various strikes/expiries
  createAsset({ ticker: "AAPL-260619-190C", name: "Apple Jun 2026 190 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/apple.com", expiry: "2026-06", strike: "190", underlyingAsset: "AAPL" }),
  createAsset({ ticker: "AAPL-260619-170P", name: "Apple Jun 2026 170 Put", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "put", instrumentType: "Put Option", iconUrl: "https://logo.clearbit.com/apple.com", expiry: "2026-06", strike: "170", underlyingAsset: "AAPL" }),
  createAsset({ ticker: "AAPL-260918-200C", name: "Apple Sep 2026 200 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/apple.com", expiry: "2026-09", strike: "200", underlyingAsset: "AAPL" }),
  createAsset({ ticker: "AAPL-260918-160P", name: "Apple Sep 2026 160 Put", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "put", instrumentType: "Put Option", iconUrl: "https://logo.clearbit.com/apple.com", expiry: "2026-09", strike: "160", underlyingAsset: "AAPL" }),
  createAsset({ ticker: "AAPL-261218-210C", name: "Apple Dec 2026 210 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/apple.com", expiry: "2026-12", strike: "210", underlyingAsset: "AAPL" }),

  // MSFT options
  createAsset({ ticker: "MSFT-260619-400C", name: "Microsoft Jun 2026 400 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/microsoft.com", expiry: "2026-06", strike: "400", underlyingAsset: "MSFT" }),
  createAsset({ ticker: "MSFT-260619-350P", name: "Microsoft Jun 2026 350 Put", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "put", instrumentType: "Put Option", iconUrl: "https://logo.clearbit.com/microsoft.com", expiry: "2026-06", strike: "350", underlyingAsset: "MSFT" }),
  createAsset({ ticker: "MSFT-260918-420C", name: "Microsoft Sep 2026 420 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/microsoft.com", expiry: "2026-09", strike: "420", underlyingAsset: "MSFT" }),

  // TSLA options
  createAsset({ ticker: "TSLA-260619-250C", name: "Tesla Jun 2026 250 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/tesla.com", expiry: "2026-06", strike: "250", underlyingAsset: "TSLA" }),
  createAsset({ ticker: "TSLA-260619-200P", name: "Tesla Jun 2026 200 Put", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "put", instrumentType: "Put Option", iconUrl: "https://logo.clearbit.com/tesla.com", expiry: "2026-06", strike: "200", underlyingAsset: "TSLA" }),
  createAsset({ ticker: "TSLA-260918-300C", name: "Tesla Sep 2026 300 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/tesla.com", expiry: "2026-09", strike: "300", underlyingAsset: "TSLA" }),

  // AMZN options
  createAsset({ ticker: "AMZN-260619-180C", name: "Amazon Jun 2026 180 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/amazon.com", expiry: "2026-06", strike: "180", underlyingAsset: "AMZN" }),
  createAsset({ ticker: "AMZN-260619-160P", name: "Amazon Jun 2026 160 Put", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "put", instrumentType: "Put Option", iconUrl: "https://logo.clearbit.com/amazon.com", expiry: "2026-06", strike: "160", underlyingAsset: "AMZN" }),

  // GOOGL options
  createAsset({ ticker: "GOOGL-260619-170C", name: "Alphabet Jun 2026 170 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/google.com", expiry: "2026-06", strike: "170", underlyingAsset: "GOOGL" }),
  createAsset({ ticker: "GOOGL-260918-180C", name: "Alphabet Sep 2026 180 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/google.com", expiry: "2026-09", strike: "180", underlyingAsset: "GOOGL" }),

  // META options
  createAsset({ ticker: "META-260619-500C", name: "Meta Jun 2026 500 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/meta.com", expiry: "2026-06", strike: "500", underlyingAsset: "META" }),
  createAsset({ ticker: "META-260619-450P", name: "Meta Jun 2026 450 Put", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "put", instrumentType: "Put Option", iconUrl: "https://logo.clearbit.com/meta.com", expiry: "2026-06", strike: "450", underlyingAsset: "META" }),

  // NVDA options
  createAsset({ ticker: "NVDA-260619-130C", name: "NVIDIA Jun 2026 130 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/nvidia.com", expiry: "2026-06", strike: "130", underlyingAsset: "NVDA" }),
  createAsset({ ticker: "NVDA-260918-150C", name: "NVIDIA Sep 2026 150 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/nvidia.com", expiry: "2026-09", strike: "150", underlyingAsset: "NVDA" }),

  // SPY ETF options
  createAsset({ ticker: "SPY-260619-500C", name: "SPY Jun 2026 500 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/ssga.com", expiry: "2026-06", strike: "500", underlyingAsset: "SPY" }),
  createAsset({ ticker: "SPY-260918-520C", name: "SPY Sep 2026 520 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/ssga.com", expiry: "2026-09", strike: "520", underlyingAsset: "SPY" }),
  createAsset({ ticker: "SPY-260619-420P", name: "SPY Jun 2026 420 Put", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "put", instrumentType: "Put Option", iconUrl: "https://logo.clearbit.com/ssga.com", expiry: "2026-06", strike: "420", underlyingAsset: "SPY" }),

  // QQQ ETF options
  createAsset({ ticker: "QQQ-260619-400C", name: "QQQ Jun 2026 400 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/invesco.com", expiry: "2026-06", strike: "400", underlyingAsset: "QQQ" }),
  createAsset({ ticker: "QQQ-260918-420C", name: "QQQ Sep 2026 420 Call", category: "options", exchange: "OPRA", country: "US", source: "opra", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/invesco.com", expiry: "2026-09", strike: "420", underlyingAsset: "QQQ" }),

  // NIFTY options (India)
  createAsset({ ticker: "NIFTY-260625-22500CE", name: "NIFTY Jun 2026 22500 Call", category: "options", exchange: "NSE", country: "IN", source: "nse", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/nseindia.com", expiry: "2026-06", strike: "22500", underlyingAsset: "NIFTY" }),
  createAsset({ ticker: "NIFTY-260625-22000PE", name: "NIFTY Jun 2026 22000 Put", category: "options", exchange: "NSE", country: "IN", source: "nse", type: "put", instrumentType: "Put Option", iconUrl: "https://logo.clearbit.com/nseindia.com", expiry: "2026-06", strike: "22000", underlyingAsset: "NIFTY" }),
  createAsset({ ticker: "NIFTY-260924-23000CE", name: "NIFTY Sep 2026 23000 Call", category: "options", exchange: "NSE", country: "IN", source: "nse", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/nseindia.com", expiry: "2026-09", strike: "23000", underlyingAsset: "NIFTY" }),

  // BANKNIFTY options (India)
  createAsset({ ticker: "BANKNIFTY-260625-48000CE", name: "Bank NIFTY Jun 2026 48000 Call", category: "options", exchange: "NSE", country: "IN", source: "nse", type: "call", instrumentType: "Call Option", iconUrl: "https://logo.clearbit.com/nseindia.com", expiry: "2026-06", strike: "48000", underlyingAsset: "BANKNIFTY" }),
  createAsset({ ticker: "BANKNIFTY-260625-46000PE", name: "Bank NIFTY Jun 2026 46000 Put", category: "options", exchange: "NSE", country: "IN", source: "nse", type: "put", instrumentType: "Put Option", iconUrl: "https://logo.clearbit.com/nseindia.com", expiry: "2026-06", strike: "46000", underlyingAsset: "BANKNIFTY" }),

  // BTC / ETH crypto options
  createAsset({ ticker: "BTC-260626-70000C", name: "BTC Jun 2026 70000 Call", category: "options", exchange: "BINANCE", country: "GLOBAL", source: "binance", type: "call", instrumentType: "Call Option", iconUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png", expiry: "2026-06", strike: "70000", underlyingAsset: "BTC" }),
  createAsset({ ticker: "BTC-260626-60000P", name: "BTC Jun 2026 60000 Put", category: "options", exchange: "BINANCE", country: "GLOBAL", source: "binance", type: "put", instrumentType: "Put Option", iconUrl: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png", expiry: "2026-06", strike: "60000", underlyingAsset: "BTC" }),
  createAsset({ ticker: "ETH-260626-4000C", name: "ETH Jun 2026 4000 Call", category: "options", exchange: "BINANCE", country: "GLOBAL", source: "binance", type: "call", instrumentType: "Call Option", iconUrl: "https://assets.coingecko.com/coins/images/279/large/ethereum.png", expiry: "2026-06", strike: "4000", underlyingAsset: "ETH" }),
  createAsset({ ticker: "ETH-260626-3000P", name: "ETH Jun 2026 3000 Put", category: "options", exchange: "BINANCE", country: "GLOBAL", source: "binance", type: "put", instrumentType: "Put Option", iconUrl: "https://assets.coingecko.com/coins/images/279/large/ethereum.png", expiry: "2026-06", strike: "3000", underlyingAsset: "ETH" }),
];

export const CATALOG_BY_CATEGORY: Record<AssetCategory, AssetCatalogItem[]> = {
  stocks: STOCKS,
  funds: FUNDS,
  futures: FUTURES,
  forex: FOREX,
  crypto: CRYPTO,
  indices: INDICES,
  bonds: BONDS,
  economy: ECONOMY,
  options: OPTIONS,
};
