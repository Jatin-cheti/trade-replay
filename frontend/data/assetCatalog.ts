export type MarketType = "stocks" | "crypto" | "forex" | "commodities" | "bonds";

export interface AssetCatalogItem {
  symbol: string;
  name: string;
  market: MarketType;
  icon: string;
}

export interface CurrencyItem {
  code: string;
  name: string;
  icon: string;
}

export const marketMeta: Array<{ key: MarketType; label: string; icon: string }> = [
  { key: "stocks", label: "Stocks", icon: "📈" },
  { key: "crypto", label: "Crypto", icon: "🪙" },
  { key: "forex", label: "Forex", icon: "💱" },
  { key: "commodities", label: "Commodities", icon: "🛢️" },
  { key: "bonds", label: "Bonds", icon: "🏛️" },
];

export const assetCatalog: AssetCatalogItem[] = [
  { symbol: "AAPL", name: "Apple Inc.", market: "stocks", icon: "🍎" },
  { symbol: "TSLA", name: "Tesla", market: "stocks", icon: "🚗" },
  { symbol: "RELIANCE.NS", name: "Reliance Industries", market: "stocks", icon: "🏭" },
  { symbol: "MSFT", name: "Microsoft", market: "stocks", icon: "🪟" },
  { symbol: "NVDA", name: "NVIDIA", market: "stocks", icon: "🧠" },
  { symbol: "BTCUSD", name: "Bitcoin", market: "crypto", icon: "₿" },
  { symbol: "ETHUSD", name: "Ethereum", market: "crypto", icon: "Ξ" },
  { symbol: "SOLUSD", name: "Solana", market: "crypto", icon: "◎" },
  { symbol: "XRPUSD", name: "XRP", market: "crypto", icon: "✕" },
  { symbol: "DOGEUSD", name: "Dogecoin", market: "crypto", icon: "🐕" },
  { symbol: "EURUSD", name: "Euro / US Dollar", market: "forex", icon: "💶" },
  { symbol: "USDINR", name: "US Dollar / Indian Rupee", market: "forex", icon: "🇮🇳" },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", market: "forex", icon: "💴" },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", market: "forex", icon: "💷" },
  { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", market: "forex", icon: "🍁" },
  { symbol: "XAUUSD", name: "Gold Spot", market: "commodities", icon: "🥇" },
  { symbol: "CL=F", name: "Crude Oil Futures", market: "commodities", icon: "🛢️" },
  { symbol: "NG=F", name: "Natural Gas Futures", market: "commodities", icon: "🔥" },
  { symbol: "SI=F", name: "Silver Futures", market: "commodities", icon: "🥈" },
  { symbol: "HG=F", name: "Copper Futures", market: "commodities", icon: "🟤" },
  { symbol: "US10Y", name: "US 10Y Treasury", market: "bonds", icon: "📜" },
  { symbol: "IND10Y", name: "India 10Y G-Sec", market: "bonds", icon: "🏦" },
];

export const currencyCatalog: CurrencyItem[] = [
  { code: "USD", name: "US Dollar", icon: "🇺🇸" },
  { code: "INR", name: "Indian Rupee", icon: "🇮🇳" },
  { code: "EUR", name: "Euro", icon: "🇪🇺" },
  { code: "GBP", name: "British Pound", icon: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", icon: "🇯🇵" },
  { code: "CHF", name: "Swiss Franc", icon: "🇨🇭" },
  { code: "CAD", name: "Canadian Dollar", icon: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar", icon: "🇦🇺" },
  { code: "SGD", name: "Singapore Dollar", icon: "🇸🇬" },
  { code: "AED", name: "UAE Dirham", icon: "🇦🇪" },
];

export function findAssetBySymbol(symbol: string): AssetCatalogItem | null {
  return assetCatalog.find((asset) => asset.symbol === symbol) ?? null;
}
