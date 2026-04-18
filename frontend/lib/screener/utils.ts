import type {
  DateRangeFilterValue,
  ParsedFilters,
  RangeFilterValue,
  ScreenerFilterField,
} from "./types";
import {
  DATE_FILTER_KEYS,
  MULTI_FILTER_KEYS,
  RANGE_FILTER_KEYS,
} from "./constants";

export function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function parseFiniteNumber(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatCompactNumber(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value === 0) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

export function formatPrice(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1000) return value.toLocaleString("en", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value.toLocaleString("en", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

export function formatPercent(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value === 0) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

export function formatDateValue(value?: string): string {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

export function flagEmojiToCountryCode(flag: string): string {
  const points = [...flag];
  if (points.length !== 2) return "";
  const a = (points[0].codePointAt(0) ?? 0) - 0x1F1E6 + 65;
  const b = (points[1].codePointAt(0) ?? 0) - 0x1F1E6 + 65;
  if (a < 65 || a > 90 || b < 65 || b > 90) return "";
  return String.fromCharCode(a) + String.fromCharCode(b);
}

export function getMultiParamName(filterKey: string): string {
  if (filterKey === "sector") return "sectors";
  if (filterKey === "analystRating") return "analystRatings";
  return filterKey;
}

export function getDateParamNames(filterKey: string): { from: string; to: string } {
  if (filterKey === "recentEarningsDate") return { from: "recentEarningsFrom", to: "recentEarningsTo" };
  if (filterKey === "upcomingEarningsDate") return { from: "upcomingEarningsFrom", to: "upcomingEarningsTo" };
  return { from: `${filterKey}From`, to: `${filterKey}To` };
}

export function parseFiltersFromSearch(searchParams: URLSearchParams): ParsedFilters {
  const parsed: ParsedFilters = {};

  for (const key of MULTI_FILTER_KEYS) {
    const values = parseCsv(searchParams.get(getMultiParamName(key)));
    if (values.length > 0) parsed[key] = values;
  }

  if (!parsed.marketCountries) {
    const legacyCountry = searchParams.get("country");
    if (legacyCountry) parsed.marketCountries = [legacyCountry];
  }

  if (!parsed.exchanges) {
    const legacyExchange = searchParams.get("exchange");
    if (legacyExchange) parsed.exchanges = [legacyExchange];
  }

  if (!parsed.sector) {
    const legacySector = searchParams.get("sector");
    if (legacySector) parsed.sector = [legacySector];
  }

  for (const key of RANGE_FILTER_KEYS) {
    const min = parseFiniteNumber(searchParams.get(`${key}Min`));
    const max = parseFiniteNumber(searchParams.get(`${key}Max`));
    if (min !== undefined || max !== undefined) {
      parsed[key] = { min, max };
    }
  }

  for (const key of DATE_FILTER_KEYS) {
    const params = getDateParamNames(key);
    const from = searchParams.get(params.from) || undefined;
    const to = searchParams.get(params.to) || undefined;
    if (from || to) {
      parsed[key] = { from, to };
    }
  }

  parsed.primaryListingOnly =
    searchParams.get("primaryListing") === "true"
    || searchParams.get("primary") === "true"
    || searchParams.get("primary") === "1";

  return parsed;
}

export function isFilterActiveValue(value: ParsedFilters[string]): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  if (!value) return false;

  if ("min" in value || "max" in value) {
    const range = value as RangeFilterValue;
    return range.min !== undefined || range.max !== undefined;
  }

  if ("from" in value || "to" in value) {
    const range = value as DateRangeFilterValue;
    return Boolean(range.from || range.to);
  }

  return false;
}

export function buildFilterLabel(field: ScreenerFilterField, value: ParsedFilters[string]): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return field.label;
    if (value.length === 1) {
      const optionLabel = field.options?.find((option) => option.value === value[0])?.label;
      return optionLabel ? `${field.label}: ${optionLabel}` : `${field.label}: ${value[0]}`;
    }
    return `${field.label}: ${value.length}`;
  }

  if (typeof value === "boolean") {
    return value ? `${field.label}: On` : field.label;
  }

  if (!value) return field.label;

  if ("min" in value || "max" in value) {
    const range = value as RangeFilterValue;
    const minValue = range.min !== undefined ? String(range.min) : "Min";
    const maxValue = range.max !== undefined ? String(range.max) : "Max";
    return `${field.label}: ${minValue} - ${maxValue}`;
  }

  const dateRange = value as DateRangeFilterValue;
  const fromLabel = dateRange.from || "From";
  const toLabel = dateRange.to || "To";
  return `${field.label}: ${fromLabel} - ${toLabel}`;
}

export function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function normalizeRouteType(routeType: string | undefined, allowedTypes: string[]): string {
  const normalized = (routeType || "stocks").toLowerCase();
  if (allowedTypes.includes(normalized)) return normalized;

  if (normalized === "stock") return "stocks";
  if (normalized === "etf") return "etfs";
  if (normalized === "bond") return "bonds";
  if (normalized === "crypto") return "crypto-coins";
  if (normalized === "cex") return "cex-pairs";
  if (normalized === "dex") return "dex-pairs";

  return "stocks";
}

export function toStatsTypeKey(routeType: string): string {
  if (routeType === "stocks") return "stock";
  if (routeType === "etfs") return "etf";
  if (routeType === "bonds") return "bond";
  if (routeType === "crypto-coins" || routeType === "cex-pairs" || routeType === "dex-pairs") return "crypto";
  return routeType;
}
