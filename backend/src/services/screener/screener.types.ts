import type { FullSymbolData } from "../symbolAggregation.service";
import type { ScreenerRouteType, ScreenerTabKey } from "./screener.constants";

export interface ScreenerRangeFilter {
  min?: number;
  max?: number;
}

export interface ScreenerDateRangeFilter {
  from?: string;
  to?: string;
}

export interface ScreenerFiltersInput {
  marketCountries: string[];
  exchanges: string[];
  watchlists: string[];
  indices: string[];
  primaryListingOnly?: boolean;

  price?: ScreenerRangeFilter;
  changePercent?: ScreenerRangeFilter;
  marketCap?: ScreenerRangeFilter;
  pe?: ScreenerRangeFilter;
  epsDilGrowth?: ScreenerRangeFilter;
  divYieldPercent?: ScreenerRangeFilter;
  sector: string[];
  analystRating: string[];
  perfPercent?: ScreenerRangeFilter;
  revenueGrowth?: ScreenerRangeFilter;
  peg?: ScreenerRangeFilter;
  roe?: ScreenerRangeFilter;
  beta?: ScreenerRangeFilter;
  recentEarningsDate?: ScreenerDateRangeFilter;
  upcomingEarningsDate?: ScreenerDateRangeFilter;
}

export interface ScreenerGetSymbolsRequest {
  type: ScreenerRouteType;
  query?: string;
  filters: ScreenerFiltersInput;
  sortField: string;
  sortOrder: "asc" | "desc";
  offset: number;
  limit: number;
  tab: ScreenerTabKey;
  selectedColumns: string[];
}

export interface ScreenerRow extends FullSymbolData {
  // Computed display fields (not in FullSymbolData)
  relVolume: number | null;
  epsDilTtm: number | null;
  epsDilGrowth: number | null;
  divYieldPercent: number | null;
  perfPercent: number;
  peg: number | null;
  marketClass: "cex" | "dex";
  // Note: recentEarningsDate, upcomingEarningsDate, epsEstimate, revenueEstimate,
  // company profile fields (industry, ceo, headquarters, founded, ipoDate,
  // isin, cfiCode, description), analystRating, roe, revenueGrowth
  // are all inherited from FullSymbolData.
}

export interface ScreenerGetSymbolsResponse {
  items: ScreenerRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  scannedCount: number;
}

export interface ScreenerRepositoryQuery {
  typeAssetValues: string[];
  query?: string;
  countries: string[];
  exchanges: string[];
  sectors: string[];
  primaryListingOnly?: boolean;
  marketCap?: ScreenerRangeFilter;
  volume?: ScreenerRangeFilter;
}

export interface ScreenerRepositorySort {
  field: string;
  order: "asc" | "desc";
}
