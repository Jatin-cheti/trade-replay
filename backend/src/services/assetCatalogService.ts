import { env } from "../config/env";

export type AssetType = "stock" | "crypto" | "forex" | "commodity";
export type MarketType = "US" | "India" | "Crypto" | "Forex" | "Commodities";

export interface AssetCatalogItem {
  symbol: string;
  name: string;
  assetType: AssetType;
  market: MarketType;
  icon: string;
  source: "alpha-vantage" | "coingecko" | "exchange-rate-api" | "fallback";
}

const fallbackAssets: AssetCatalogItem[] = [
  { symbol: "AAPL", name: "Apple Inc", assetType: "stock", market: "US", icon: "🍎", source: "fallback" },
  { symbol: "NVDA", name: "NVIDIA", assetType: "stock", market: "US", icon: "🧠", source: "fallback" },
  { symbol: "RELIANCE.NS", name: "Reliance Industries", assetType: "stock", market: "India", icon: "🇮🇳", source: "fallback" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services", assetType: "stock", market: "India", icon: "🏢", source: "fallback" },
  { symbol: "BTCUSD", name: "Bitcoin", assetType: "crypto", market: "Crypto", icon: "₿", source: "fallback" },
  { symbol: "ETHUSD", name: "Ethereum", assetType: "crypto", market: "Crypto", icon: "Ξ", source: "fallback" },
  { symbol: "EURUSD", name: "Euro / US Dollar", assetType: "forex", market: "Forex", icon: "💶", source: "fallback" },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", assetType: "forex", market: "Forex", icon: "💴", source: "fallback" },
  { symbol: "XAUUSD", name: "Gold Spot", assetType: "commodity", market: "Commodities", icon: "🥇", source: "fallback" },
  { symbol: "CL=F", name: "Crude Oil Futures", assetType: "commodity", market: "Commodities", icon: "🛢️", source: "fallback" },
  { symbol: "NG=F", name: "Natural Gas Futures", assetType: "commodity", market: "Commodities", icon: "🔥", source: "fallback" },
];

function detectMarket(symbol: string): MarketType {
  if (symbol.endsWith(".NS") || symbol.endsWith(".BO")) return "India";
  return "US";
}

async function fetchStocks(query: string): Promise<AssetCatalogItem[]> {
  if (!env.ALPHA_VANTAGE_KEY || query.trim().length < 2) {
    return [];
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "SYMBOL_SEARCH");
  url.searchParams.set("keywords", query);
  url.searchParams.set("apikey", env.ALPHA_VANTAGE_KEY);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return [];

    const payload = (await response.json()) as {
      bestMatches?: Array<Record<string, string>>;
    };

    return (payload.bestMatches ?? []).slice(0, 20).map((match) => {
      const symbol = match["1. symbol"]?.trim() ?? "";
      const name = match["2. name"]?.trim() ?? symbol;
      return {
        symbol,
        name,
        assetType: "stock" as const,
        market: detectMarket(symbol),
        icon: symbol.endsWith(".NS") || symbol.endsWith(".BO") ? "🇮🇳" : "📈",
        source: "alpha-vantage" as const,
      };
    }).filter((item) => item.symbol.length > 0);
  } catch (_error) {
    return [];
  }
}

async function fetchCrypto(query: string): Promise<AssetCatalogItem[]> {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=60&page=1&sparkline=false");
    if (!response.ok) return [];

    const payload = (await response.json()) as Array<{ symbol: string; name: string }>;
    return payload
      .map((coin) => ({
        symbol: `${coin.symbol.toUpperCase()}USD`,
        name: coin.name,
        assetType: "crypto" as const,
        market: "Crypto" as const,
        icon: "🪙",
        source: "coingecko" as const,
      }))
      .filter((item) => {
        const text = `${item.symbol} ${item.name}`.toLowerCase();
        return query ? text.includes(query.toLowerCase()) : true;
      })
      .slice(0, 20);
  } catch (_error) {
    return [];
  }
}

async function fetchForex(): Promise<AssetCatalogItem[]> {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!response.ok) return [];

    const payload = (await response.json()) as { rates?: Record<string, number> };
    const picks = ["EUR", "GBP", "JPY", "INR", "AUD", "CAD"];

    return picks
      .filter((code) => payload.rates?.[code])
      .map((code) => ({
        symbol: `USD${code}`,
        name: `US Dollar / ${code}`,
        assetType: "forex" as const,
        market: "Forex" as const,
        icon: "💱",
        source: "exchange-rate-api" as const,
      }));
  } catch (_error) {
    return [];
  }
}

const commodityAssets: AssetCatalogItem[] = [
  { symbol: "XAUUSD", name: "Gold Spot", assetType: "commodity", market: "Commodities", icon: "🥇", source: "fallback" },
  { symbol: "XAGUSD", name: "Silver Spot", assetType: "commodity", market: "Commodities", icon: "🥈", source: "fallback" },
  { symbol: "CL=F", name: "Crude Oil Futures", assetType: "commodity", market: "Commodities", icon: "🛢️", source: "fallback" },
  { symbol: "NG=F", name: "Natural Gas Futures", assetType: "commodity", market: "Commodities", icon: "🔥", source: "fallback" },
];

export async function searchAssetCatalog(input: {
  query?: string;
  market?: string;
  assetType?: string;
}): Promise<AssetCatalogItem[]> {
  const query = (input.query ?? "").trim();

  const [stocks, crypto, forex] = await Promise.all([
    fetchStocks(query),
    fetchCrypto(query),
    fetchForex(),
  ]);

  const merged = [...stocks, ...crypto, ...forex, ...commodityAssets, ...fallbackAssets];

  const deduped = Array.from(new Map(merged.map((item) => [item.symbol, item])).values());

  return deduped
    .filter((item) => {
      const q = query.toLowerCase();
      const matchesQuery = !q || `${item.symbol} ${item.name}`.toLowerCase().includes(q);
      const matchesMarket = !input.market || input.market === "ALL" || item.market === input.market;
      const matchesType = !input.assetType || input.assetType === "all" || item.assetType === input.assetType;
      return matchesQuery && matchesMarket && matchesType;
    })
    .slice(0, 60);
}
