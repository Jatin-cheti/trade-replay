export type ProductAssetClass = "stocks" | "crypto";

export type ProductColumnKey = "symbol" | "isin" | "description" | "source";

export interface ProductColumn {
  key: ProductColumnKey;
  label: string;
  copyable?: boolean;
}

export interface ProductRow {
  id: string;
  displaySymbol: string;
  canonicalSymbol: string;
  isin?: string;
  description?: string;
  source: string;
  assetClass: ProductAssetClass;
}

export interface ProductTab {
  key: string;
  label: string;
  count: number;
  columns: ProductColumn[];
  rows: ProductRow[];
}

const STOCK_COLUMNS: ProductColumn[] = [
  { key: "symbol", label: "Symbol" },
  { key: "isin", label: "ISIN", copyable: true },
  { key: "source", label: "Source" },
];

const FUTURES_COLUMNS: ProductColumn[] = [
  { key: "symbol", label: "Symbol" },
  { key: "description", label: "Description" },
  { key: "source", label: "Source" },
];

const SYMBOL_SOURCE_COLUMNS: ProductColumn[] = [
  { key: "symbol", label: "Symbol" },
  { key: "source", label: "Source" },
];

const STOCK_ROWS: ProductRow[] = [
  { id: "stk-1", displaySymbol: "RELIANCE", canonicalSymbol: "RELIANCE", isin: "INE002A01018", source: "NSE", assetClass: "stocks" },
  { id: "stk-2", displaySymbol: "RELIANCE", canonicalSymbol: "RELIANCE", isin: "INE002A01018", source: "BSE", assetClass: "stocks" },
  { id: "stk-3", displaySymbol: "RIGD", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "LSIN", assetClass: "stocks" },
  { id: "stk-4", displaySymbol: "RELIN", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "LUXSE", assetClass: "stocks" },
  { id: "stk-5", displaySymbol: "RIL", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "GETTEX", assetClass: "stocks" },
  { id: "stk-6", displaySymbol: "RIGDL", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "Turquoise", assetClass: "stocks" },
  { id: "stk-7", displaySymbol: "RIL", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "TRADEGATE", assetClass: "stocks" },
  { id: "stk-8", displaySymbol: "RIL", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "FWB", assetClass: "stocks" },
  { id: "stk-9", displaySymbol: "884241", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "LS", assetClass: "stocks" },
  { id: "stk-10", displaySymbol: "884241", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "LSX", assetClass: "stocks" },
  { id: "stk-11", displaySymbol: "RIL", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "SWB", assetClass: "stocks" },
  { id: "stk-12", displaySymbol: "RIL", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "WB", assetClass: "stocks" },
  { id: "stk-13", displaySymbol: "RIL", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "MUN", assetClass: "stocks" },
  { id: "stk-14", displaySymbol: "RIL CHF", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "BX", assetClass: "stocks" },
  { id: "stk-15", displaySymbol: "RIL EUR", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "DUS", assetClass: "stocks" },
  { id: "stk-16", displaySymbol: "RIL EUR", canonicalSymbol: "RELIANCE", isin: "US7594701077", source: "HAM", assetClass: "stocks" },
];

const STOCK_FUTURES_ROWS: ProductRow[] = [
  { id: "fut-1", displaySymbol: "RELIANCE1!", canonicalSymbol: "RELIANCE", description: "RELIANCE INDS FUTURES", source: "NSE", assetClass: "stocks" },
  { id: "fut-2", displaySymbol: "RELI1!", canonicalSymbol: "RELIANCE", description: "RIL", source: "BSE", assetClass: "stocks" },
  { id: "fut-3", displaySymbol: "ZRIL1!", canonicalSymbol: "RELIANCE", description: "Reliance Industries Ltd Futures", source: "SGX", assetClass: "stocks" },
];

const CRYPTO_FUTURES_ROWS: ProductRow[] = [
  { id: "cf-1", displaySymbol: "BTC1!", canonicalSymbol: "BTCUSDT", description: "Bitcoin Futures", source: "BINANCE", assetClass: "crypto" },
  { id: "cf-2", displaySymbol: "ETH1!", canonicalSymbol: "ETHUSDT", description: "Ether Futures", source: "BINANCE", assetClass: "crypto" },
  { id: "cf-3", displaySymbol: "SOL1!", canonicalSymbol: "SOLUSDT", description: "Solana Futures", source: "BINANCE", assetClass: "crypto" },
  { id: "cf-4", displaySymbol: "XRP1!", canonicalSymbol: "XRPUSDT", description: "XRP Futures", source: "BINANCE", assetClass: "crypto" },
  { id: "cf-5", displaySymbol: "BNB1!", canonicalSymbol: "BNBUSDT", description: "BNB Futures", source: "BINANCE", assetClass: "crypto" },
  { id: "cf-6", displaySymbol: "ADA1!", canonicalSymbol: "ADAUSDT", description: "Cardano Futures", source: "BINANCE", assetClass: "crypto" },
  { id: "cf-7", displaySymbol: "DOGE1!", canonicalSymbol: "DOGEUSDT", description: "Dogecoin Futures", source: "BINANCE", assetClass: "crypto" },
  { id: "cf-8", displaySymbol: "AVAX1!", canonicalSymbol: "AVAXUSDT", description: "Avalanche Futures", source: "BYBIT", assetClass: "crypto" },
  { id: "cf-9", displaySymbol: "LINK1!", canonicalSymbol: "LINKUSDT", description: "Chainlink Futures", source: "BYBIT", assetClass: "crypto" },
  { id: "cf-10", displaySymbol: "DOT1!", canonicalSymbol: "DOTUSDT", description: "Polkadot Futures", source: "BYBIT", assetClass: "crypto" },
  { id: "cf-11", displaySymbol: "LTC1!", canonicalSymbol: "LTCUSDT", description: "Litecoin Futures", source: "BYBIT", assetClass: "crypto" },
  { id: "cf-12", displaySymbol: "TRX1!", canonicalSymbol: "TRXUSDT", description: "Tron Futures", source: "BYBIT", assetClass: "crypto" },
  { id: "cf-13", displaySymbol: "BTC2!", canonicalSymbol: "BTCUSDT", description: "Bitcoin Quarterly Futures", source: "OKX", assetClass: "crypto" },
  { id: "cf-14", displaySymbol: "ETH2!", canonicalSymbol: "ETHUSDT", description: "Ether Quarterly Futures", source: "OKX", assetClass: "crypto" },
  { id: "cf-15", displaySymbol: "BTC3!", canonicalSymbol: "BTCUSDT", description: "Bitcoin Next Quarter Futures", source: "DERIBIT", assetClass: "crypto" },
  { id: "cf-16", displaySymbol: "ETH3!", canonicalSymbol: "ETHUSDT", description: "Ether Next Quarter Futures", source: "DERIBIT", assetClass: "crypto" },
];

const CRYPTO_INDICES_ROWS: ProductRow[] = [
  { id: "ci-1", displaySymbol: "BTC.D", canonicalSymbol: "BTCUSDT", source: "CRYPTOCAP", assetClass: "crypto" },
  { id: "ci-2", displaySymbol: "ETH.D", canonicalSymbol: "ETHUSDT", source: "CRYPTOCAP", assetClass: "crypto" },
  { id: "ci-3", displaySymbol: "TOTAL", canonicalSymbol: "BTCUSDT", source: "CRYPTOCAP", assetClass: "crypto" },
  { id: "ci-4", displaySymbol: "TOTAL2", canonicalSymbol: "ETHUSDT", source: "CRYPTOCAP", assetClass: "crypto" },
  { id: "ci-5", displaySymbol: "TOTAL3", canonicalSymbol: "SOLUSDT", source: "CRYPTOCAP", assetClass: "crypto" },
  { id: "ci-6", displaySymbol: "ALTS", canonicalSymbol: "SOLUSDT", source: "CRYPTOCAP", assetClass: "crypto" },
  { id: "ci-7", displaySymbol: "DEFI", canonicalSymbol: "LINKUSDT", source: "CRYPTOCAP", assetClass: "crypto" },
  { id: "ci-8", displaySymbol: "NFT", canonicalSymbol: "ETHUSDT", source: "CRYPTOCAP", assetClass: "crypto" },
  { id: "ci-9", displaySymbol: "L1", canonicalSymbol: "ETHUSDT", source: "TradeReplay", assetClass: "crypto" },
  { id: "ci-10", displaySymbol: "L2", canonicalSymbol: "ETHUSDT", source: "TradeReplay", assetClass: "crypto" },
  { id: "ci-11", displaySymbol: "Meme", canonicalSymbol: "DOGEUSDT", source: "TradeReplay", assetClass: "crypto" },
  { id: "ci-12", displaySymbol: "AI", canonicalSymbol: "RNDRUSDT", source: "TradeReplay", assetClass: "crypto" },
  { id: "ci-13", displaySymbol: "RWA", canonicalSymbol: "ONDOUSDT", source: "TradeReplay", assetClass: "crypto" },
  { id: "ci-14", displaySymbol: "BRC20", canonicalSymbol: "ORDIUSDT", source: "TradeReplay", assetClass: "crypto" },
  { id: "ci-15", displaySymbol: "Privacy", canonicalSymbol: "XMRUSDT", source: "TradeReplay", assetClass: "crypto" },
  { id: "ci-16", displaySymbol: "Oracle", canonicalSymbol: "LINKUSDT", source: "TradeReplay", assetClass: "crypto" },
  { id: "ci-17", displaySymbol: "Storage", canonicalSymbol: "FILUSDT", source: "TradeReplay", assetClass: "crypto" },
  { id: "ci-18", displaySymbol: "DEX", canonicalSymbol: "UNIUSDT", source: "TradeReplay", assetClass: "crypto" },
];

const SPOT_BASES = ["BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE", "AVAX", "LTC", "DOT", "TRX", "LINK"];
const SPOT_SOURCES = ["BINANCE", "COINBASE", "KRAKEN", "BYBIT"];
const SWAP_SOURCES = ["BINANCE", "BYBIT"];

function buildPairRows(prefix: string, bases: string[], sources: string[], assetClass: ProductAssetClass): ProductRow[] {
  const rows: ProductRow[] = [];
  for (const base of bases) {
    for (const source of sources) {
      const quote = source === "COINBASE" || source === "KRAKEN" ? "USD" : "USDT";
      rows.push({
        id: `${prefix}-${base}-${source}`,
        displaySymbol: `${base}${quote}`,
        canonicalSymbol: `${base}USDT`,
        source,
        assetClass,
      });
    }
  }
  return rows;
}

const CRYPTO_SPOT_ROWS = buildPairRows("cs", SPOT_BASES, SPOT_SOURCES, "crypto");
const CRYPTO_SWAP_ROWS = buildPairRows("cw", SPOT_BASES, SWAP_SOURCES, "crypto");

export function getProductTabsForAssetClass(assetClass: ProductAssetClass): ProductTab[] {
  if (assetClass === "crypto") {
    return [
      { key: "futures", label: "Futures", count: 16, columns: FUTURES_COLUMNS, rows: CRYPTO_FUTURES_ROWS },
      { key: "indices", label: "Indices", count: 18, columns: SYMBOL_SOURCE_COLUMNS, rows: CRYPTO_INDICES_ROWS },
      { key: "spot", label: "Spot", count: 48, columns: SYMBOL_SOURCE_COLUMNS, rows: CRYPTO_SPOT_ROWS },
      { key: "swap", label: "Swap", count: 24, columns: SYMBOL_SOURCE_COLUMNS, rows: CRYPTO_SWAP_ROWS },
    ];
  }

  return [
    { key: "stocks", label: "Stocks", count: 16, columns: STOCK_COLUMNS, rows: STOCK_ROWS },
    { key: "futures", label: "Futures", count: 3, columns: FUTURES_COLUMNS, rows: STOCK_FUTURES_ROWS },
  ];
}

const SOURCE_LOGO_MAP: Record<string, string> = {
  NSE: "/icons/exchange/NSE.svg",
  BSE: "/icons/exchange/BSE.svg",
  BINANCE: "/icons/exchange/BINANCE.svg",
  NASDAQ: "/icons/exchange/NASDAQ.svg",
  NYSE: "/icons/exchange/NYSE.svg",
  FOREX: "/icons/exchange/FOREX.svg",
  SPX: "/icons/exchange/SP.svg",
  SP500: "/icons/exchange/SP.svg",
  DJ: "/icons/exchange/DJ.svg",
  DJI: "/icons/exchange/DJ.svg",
  GLOBAL: "/icons/exchange/GLOBAL.svg",
  DEFAULT: "/icons/exchange/default.svg",
};

const SOURCE_ALIAS_MAP: Record<string, string> = {
  NAS: "NASDAQ",
  NSDQ: "NASDAQ",
  NASDAQCM: "NASDAQ",
  NASDAQGS: "NASDAQ",
  NASDAQGM: "NASDAQ",
  NYSEARCA: "NYSE",
  NYSEMKT: "NYSE",
  AMEX: "NYSE",
  BINANCEUS: "BINANCE",
  BINANCEFUTURES: "BINANCE",
  BYBIT: "BINANCE",
  OKX: "BINANCE",
  COINBASE: "BINANCE",
  KRAKEN: "BINANCE",
  BITSTAMP: "BINANCE",
  MEXC: "BINANCE",
  BITGET: "BINANCE",
  GATE: "BINANCE",
  OANDA: "FOREX",
  FXCM: "FOREX",
  FOREXCOM: "FOREX",
  SP: "SPX",
  SANDP500: "SPX",
  DOWJONES: "DJ",
};

export function resolveSourceLogo(source: string): string | null {
  const key = source.trim().toUpperCase();
  if (!key) return SOURCE_LOGO_MAP.DEFAULT;

  const aliasedKey = SOURCE_ALIAS_MAP[key] || key;
  if (SOURCE_LOGO_MAP[aliasedKey]) return SOURCE_LOGO_MAP[aliasedKey];

  if (key.includes("NASDAQ")) return SOURCE_LOGO_MAP.NASDAQ;
  if (key.includes("NYSE") || key.includes("ARCA") || key.includes("AMEX")) return SOURCE_LOGO_MAP.NYSE;
  if (key.includes("BINANCE") || key.includes("BYBIT") || key.includes("COINBASE") || key.includes("KRAKEN") || key.includes("OKX") || key.includes("MEXC") || key.includes("BITGET") || key.includes("GATE")) return SOURCE_LOGO_MAP.BINANCE;
  if (key.includes("FOREX") || key.includes("FX") || key.includes("OANDA") || key.includes("FXCM")) return SOURCE_LOGO_MAP.FOREX;
  if (key.includes("NSE")) return SOURCE_LOGO_MAP.NSE;
  if (key.includes("BSE")) return SOURCE_LOGO_MAP.BSE;
  if (key.includes("SP") || key.includes("S&P")) return SOURCE_LOGO_MAP.SPX;
  if (key.includes("DOW") || key.includes("DJ")) return SOURCE_LOGO_MAP.DJ;

  return SOURCE_LOGO_MAP.GLOBAL;
}
