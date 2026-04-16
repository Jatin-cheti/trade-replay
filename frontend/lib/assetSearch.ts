import { api } from "@/lib/api";
import { getStaticFilters } from "@/config/filters";
import { mapSymbolItemToUi } from "@/utils/symbolMapper";

const reportedMissingLogoSymbols = new Set<string>();
const iconCache = new Map<string, string>();
const ICON_CACHE_MAX_ENTRIES = 500;

export type AssetMarketType = "Stocks" | "Funds" | "Futures" | "Forex" | "Crypto" | "Indices" | "Bonds" | "Economy" | "Options";
export type AssetCategory = "stocks" | "funds" | "futures" | "forex" | "crypto" | "indices" | "bonds" | "economy" | "options";
export type AssetSortOption = "relevance" | "name" | "symbol" | "volume" | "marketCap";

export interface AssetSearchItem {
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
  displayIconUrl?: string;
  isFallback?: boolean;
  price?: number;
  change?: number;
  changePercent?: number;
  pnl?: number;
  volume?: number;
  marketCap?: number;
  liquidityScore?: number;
  source: string;
  futureCategory?: string;
  economyCategory?: string;
  expiry?: string;
  strike?: string;
  underlyingAsset?: string;
  contracts?: AssetSearchItem[];
}

export interface AssetSearchResponse {
  queryKey?: string;
  assets: AssetSearchItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string | null;
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

function detectFallbackType(item: AssetSearchItem): string | null {
  if (item.isFallback) {
    return "generated";
  }
  const icon = item.iconUrl || item.logoUrl || "";
  if (!icon) return "none";
  if (icon === item.exchangeIcon || icon === item.exchangeLogoUrl) return "exchange";
  if (icon.startsWith("/icons/exchange/")) return "exchange";
  if (icon.startsWith("/icons/sector/")) return "sector";
  if (icon.startsWith("/icons/category/")) return "category";
  return null;
}

function reportMissingLogo(item: AssetSearchItem): void {
  const fallbackType = detectFallbackType(item);
  if (!fallbackType) return;

  const fullSymbol = `${(item.exchange || "GLOBAL").toUpperCase()}:${(item.symbol || item.ticker || "UNKNOWN").toUpperCase()}`;
  if (reportedMissingLogoSymbols.has(fullSymbol)) return;
  reportedMissingLogoSymbols.add(fullSymbol);

  void api.post("/symbols/missing-logo", {
    symbol: (item.symbol || item.ticker || "UNKNOWN").toUpperCase(),
    fullSymbol,
    name: item.name || item.symbol || item.ticker || "Unknown Asset",
    exchange: (item.exchange || "GLOBAL").toUpperCase(),
    type: (item.type || item.instrumentType || "unknown").toLowerCase(),
    country: (item.country || item.region || "GLOBAL").toUpperCase(),
    fallbackType,
  }).catch(() => {
    // Telemetry must never block search UX.
  });
}

function iconCacheKey(item: AssetSearchItem): string {
  const exchange = (item.exchange || "GLOBAL").toUpperCase();
  const symbol = (item.symbol || item.ticker || "UNKNOWN").toUpperCase();
  return `${exchange}:${symbol}`;
}

function setCachedIcon(key: string, iconUrl: string): void {
  if (!iconUrl) return;
  if (iconCache.has(key)) {
    iconCache.delete(key);
  }
  iconCache.set(key, iconUrl);
  while (iconCache.size > ICON_CACHE_MAX_ENTRIES) {
    const oldest = iconCache.keys().next().value as string | undefined;
    if (!oldest) break;
    iconCache.delete(oldest);
  }
}

export async function searchAssets(params: {
  q: string;
  market?: string;
  category?: string;
  country?: string;
  type?: string;
  sector?: string;
  source?: string;
  exchangeType?: string;
  futureCategory?: string;
  economyCategory?: string;
  expiry?: string;
  strike?: string;
  underlyingAsset?: string;
  sort?: AssetSortOption;
  page?: number;
  limit?: number;
  cursor?: string;
  signal?: AbortSignal;
}): Promise<AssetSearchResponse> {
  const limit = params.limit ?? 50;
  const requestedCategory = params.category ?? params.market;

  const response = await api.get<AssetSearchResponse>("/simulation/assets", {
    signal: params.signal,
    params: {
      q: params.q,
      market: params.market,
      category: params.category,
      country: params.country,
      type: params.type,
      sector: params.sector,
      source: params.source,
      exchangeType: params.exchangeType,
      futureCategory: params.futureCategory,
      economyCategory: params.economyCategory,
      expiry: params.expiry,
      strike: params.strike,
      underlyingAsset: params.underlyingAsset,
      sort: params.sort,
      limit,
      cursor: params.cursor,
    },
  });

  const mappedAssets = response.data.assets
    .map((item) => mapSymbolItemToUi(item, requestedCategory))
    .map((item) => {
      const key = iconCacheKey(item);
      const effectiveIcon = item.displayIconUrl || item.logoUrl || item.iconUrl || "";

      if (effectiveIcon) {
        setCachedIcon(key, effectiveIcon);
        return {
          ...item,
          logoUrl: effectiveIcon,
          iconUrl: item.iconUrl || "",
          displayIconUrl: effectiveIcon,
        };
      }

      const cached = iconCache.get(key);
      if (!cached) return item;

      return {
        ...item,
        displayIconUrl: cached,
        logoUrl: cached,
      };
    });

  mappedAssets.forEach(reportMissingLogo);

  const sortedAssets = params.sort && params.sort !== "relevance"
    ? [...mappedAssets].sort((a, b) => {
        switch (params.sort) {
          case "name":
            return (a.name || "").localeCompare(b.name || "");
          case "symbol":
            return (a.ticker || a.symbol || "").localeCompare(b.ticker || b.symbol || "");
          case "volume":
            return (b.volume ?? 0) - (a.volume ?? 0);
          case "marketCap":
            return (b.marketCap ?? 0) - (a.marketCap ?? 0);
          default:
            return 0;
        }
      })
    : mappedAssets;

  return {
    ...response.data,
    assets: sortedAssets,
  };
}

export async function fetchAssetSearchFilters(params?: { category?: string }): Promise<AssetSearchFiltersResponse> {
  const category = (params?.category as AssetCategory | "all" | undefined) ?? "all";
  return getStaticFilters(category);
}
