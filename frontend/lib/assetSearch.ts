import { api } from "@/lib/api";
import { getStaticFilters } from "@/config/filters";
import { mapSymbolItemToUi } from "@/utils/symbolMapper";

const reportedMissingLogoSymbols = new Set<string>();
const iconCache = new Map<string, string>();

export type AssetMarketType = "Stocks" | "Funds" | "Futures" | "Forex" | "Crypto" | "Indices" | "Bonds" | "Economy" | "Options";
export type AssetCategory = "stocks" | "funds" | "futures" | "forex" | "crypto" | "indices" | "bonds" | "economy" | "options";

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
  source: string;
  futureCategory?: string;
  economyCategory?: string;
  contracts?: AssetSearchItem[];
}

export interface AssetSearchResponse {
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
  page?: number;
  limit?: number;
  cursor?: string;
}): Promise<AssetSearchResponse> {
  const limit = params.limit ?? 50;
  const requestedCategory = params.category ?? params.market;

  const response = await api.get<AssetSearchResponse>("/simulation/assets", {
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
      limit,
      cursor: params.cursor,
    },
  });

  const mappedAssets = response.data.assets
    .map((item) => mapSymbolItemToUi(item, requestedCategory))
    .filter((item) => {
      if (params.type && params.type !== "all" && item.type !== params.type) return false;
      if (params.sector && params.sector !== "all" && item.sector !== params.sector) return false;
      return true;
    })
    .map((item) => {
      const key = iconCacheKey(item);
      const effectiveIcon = item.displayIconUrl || item.logoUrl || item.iconUrl || "";

      if (effectiveIcon) {
        iconCache.set(key, effectiveIcon);
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

  return {
    ...response.data,
    assets: mappedAssets,
  };
}

export async function fetchAssetSearchFilters(params?: { category?: string }): Promise<AssetSearchFiltersResponse> {
  const category = (params?.category as AssetCategory | "all" | undefined) ?? "all";
  return getStaticFilters(category);
}
