export interface ScreenerOption {
  value: string;
  label: string;
}

export interface ScreenerTypeDefinition {
  routeType: string;
  label: string;
}

export interface ScreenerTabDefinition {
  key: string;
  label: string;
  defaultColumns: string[];
}

export interface ScreenerFilterField {
  key: string;
  label: string;
  category: string;
  inputType: "multiselect" | "range" | "date-range" | "toggle";
  supportsMultiSelect?: boolean;
  options?: ScreenerOption[];
}

export interface ScreenerColumnField {
  key: string;
  label: string;
  category: string;
  numeric?: boolean;
}

export interface ScreenerMetaResponse {
  screenerTypes: ScreenerTypeDefinition[];
  heatmapTypes: Array<{ label: string; routeType: string }>;
  tabs: ScreenerTabDefinition[];
  filterCategories: Array<{ key: string; label: string }>;
  filterFields: ScreenerFilterField[];
  columnFields: ScreenerColumnField[];
  screenMenuOptions: Array<{ key: string; label: string }>;
  countries: ScreenerOption[];
  indices: Array<{ code: string; name: string }>;
  watchlists: ScreenerOption[];
  sectors: ScreenerOption[];
  exchanges: string[];
}

export interface ScreenerStatsResponse {
  total: number;
  byType: Record<string, number>;
}

export interface SavedScreen {
  _id: string;
  name: string;
  screenerType: string;
  tab: string;
  columns: string[];
  filters: Record<string, unknown>;
  sort: string;
  order: string;
  query: string;
  updatedAt: string;
}

export interface ScreenerItem {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency: string;
  iconUrl: string;
  companyDomain?: string;
  sector?: string;
  source?: string;
  marketCap: number | null;
  volume: number;
  liquidityScore: number;
  priorityScore: number;
  popularity: number;
  isPrimaryListing: boolean;
  isSynthetic?: boolean;
  price: number;
  change: number;
  changePercent: number;
  relVolume?: number | null;
  pe?: number | null;
  epsDilTtm?: number | null;
  epsDilGrowth?: number | null;
  divYieldPercent?: number | null;
  analystRating?: string;
  perfPercent?: number;
  revenueGrowth?: number | null;
  peg?: number | null;
  roe?: number | null;
  beta?: number | null;
  recentEarningsDate?: string;
  upcomingEarningsDate?: string;
  netIncome?: number | null;
  revenue?: number | null;
  sharesFloat?: number | null;
  eps?: number | null;
  epsGrowth?: number | null;
  dividendYield?: number | null;
  avgVolume?: number | null;
  marketClass?: string;
}

export interface ScreenerListResponse {
  items: ScreenerItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  scannedCount: number;
}

export type RangeFilterValue = { min?: number; max?: number };
export type DateRangeFilterValue = { from?: string; to?: string };
export type ParsedFilters = Record<string, string[] | boolean | RangeFilterValue | DateRangeFilterValue | undefined>;

export type SortOrder = "asc" | "desc";
