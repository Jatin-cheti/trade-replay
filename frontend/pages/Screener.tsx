import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Virtuoso } from "react-virtuoso";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Columns3,
  Copy,
  Filter,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { isSpreadExpression } from "@/lib/spreadOperator";
import AssetAvatar from "@/components/ui/AssetAvatar";
import { useResponsive } from "@/hooks/useResponsive";
import { useApp } from "@/context/AppContext";

interface ScreenerOption {
  value: string;
  label: string;
}

interface ScreenerTypeDefinition {
  routeType: string;
  label: string;
}

interface ScreenerTabDefinition {
  key: string;
  label: string;
  defaultColumns: string[];
}

interface ScreenerFilterField {
  key: string;
  label: string;
  category: string;
  inputType: "multiselect" | "range" | "date-range" | "toggle";
  supportsMultiSelect?: boolean;
  options?: ScreenerOption[];
}

interface ScreenerColumnField {
  key: string;
  label: string;
  category: string;
  numeric?: boolean;
}

interface ScreenerMetaResponse {
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

interface ScreenerStatsResponse {
  total: number;
  byType: Record<string, number>;
}

interface SavedScreen {
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

interface ScreenerItem {
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
}

interface ScreenerListResponse {
  items: ScreenerItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  scannedCount: number;
}

type RangeFilterValue = { min?: number; max?: number };
type DateRangeFilterValue = { from?: string; to?: string };
type ParsedFilters = Record<string, string[] | boolean | RangeFilterValue | DateRangeFilterValue | undefined>;

type SortOrder = "asc" | "desc";

const FALLBACK_SCREENER_TYPES: ScreenerTypeDefinition[] = [
  { routeType: "stocks", label: "Stock Screener" },
  { routeType: "etfs", label: "ETF Screener" },
  { routeType: "bonds", label: "Bond Screener" },
  { routeType: "crypto-coins", label: "Crypto Coins Screener" },
  { routeType: "cex-pairs", label: "CEX Screener" },
  { routeType: "dex-pairs", label: "DEX Screener" },
];

const DEFAULT_VISIBLE_COLUMNS = [
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

const DEFAULT_FILTER_KEYS = ["marketCountries", "watchlists", "indices", "primaryListingOnly"];
const BATCH_SIZE = 50;

const MULTI_FILTER_KEYS = ["marketCountries", "exchanges", "watchlists", "indices", "sector", "analystRating"];
const RANGE_FILTER_KEYS = [
  "price",
  "changePercent",
  "marketCap",
  "pe",
  "epsDilGrowth",
  "divYieldPercent",
  "perfPercent",
  "revenueGrowth",
  "peg",
  "roe",
  "beta",
];
const DATE_FILTER_KEYS = ["recentEarningsDate", "upcomingEarningsDate"];
const TOGGLE_FILTER_KEYS = ["primaryListingOnly"];

const COLUMN_WIDTHS: Record<string, string> = {
  symbol: "minmax(260px, 2.2fr)",
  name: "minmax(240px, 2fr)",
  price: "minmax(110px, 1fr)",
  changePercent: "minmax(100px, 1fr)",
  volume: "minmax(120px, 1fr)",
  relVolume: "minmax(110px, 1fr)",
  marketCap: "minmax(130px, 1fr)",
  pe: "minmax(90px, 0.8fr)",
  epsDilTtm: "minmax(110px, 0.9fr)",
  epsDilGrowth: "minmax(130px, 1fr)",
  divYieldPercent: "minmax(120px, 1fr)",
  sector: "minmax(140px, 1fr)",
  analystRating: "minmax(130px, 1fr)",
  perfPercent: "minmax(100px, 0.9fr)",
  revenueGrowth: "minmax(130px, 1fr)",
  peg: "minmax(90px, 0.8fr)",
  roe: "minmax(100px, 0.9fr)",
  beta: "minmax(90px, 0.8fr)",
  recentEarningsDate: "minmax(130px, 1fr)",
  upcomingEarningsDate: "minmax(140px, 1fr)",
  exchange: "minmax(110px, 0.9fr)",
  country: "minmax(100px, 0.9fr)",
  currency: "minmax(90px, 0.8fr)",
  netIncome: "minmax(120px, 1fr)",
  revenue: "minmax(120px, 1fr)",
  sharesFloat: "minmax(120px, 1fr)",
};

const NUMERIC_COLUMNS = new Set([
  "price",
  "changePercent",
  "volume",
  "relVolume",
  "marketCap",
  "pe",
  "epsDilTtm",
  "epsDilGrowth",
  "divYieldPercent",
  "perfPercent",
  "revenueGrowth",
  "peg",
  "roe",
  "beta",
  "netIncome",
  "revenue",
  "sharesFloat",
]);

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseFiniteNumber(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatCompactNumber(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value === 0) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatPrice(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1000) return value.toLocaleString("en", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value.toLocaleString("en", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function formatPercent(value?: number | null): string {
  if (value === undefined || value === null || !Number.isFinite(value) || value === 0) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatDateValue(value?: string): string {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

function getMultiParamName(filterKey: string): string {
  if (filterKey === "sector") return "sectors";
  if (filterKey === "analystRating") return "analystRatings";
  return filterKey;
}

function getDateParamNames(filterKey: string): { from: string; to: string } {
  if (filterKey === "recentEarningsDate") return { from: "recentEarningsFrom", to: "recentEarningsTo" };
  if (filterKey === "upcomingEarningsDate") return { from: "upcomingEarningsFrom", to: "upcomingEarningsTo" };
  return { from: `${filterKey}From`, to: `${filterKey}To` };
}

function parseFiltersFromSearch(searchParams: URLSearchParams): ParsedFilters {
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

function isFilterActiveValue(value: ParsedFilters[string]): boolean {
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

function buildFilterLabel(field: ScreenerFilterField, value: ParsedFilters[string]): string {
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

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeRouteType(routeType: string | undefined, allowedTypes: string[]): string {
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

function toStatsTypeKey(routeType: string): string {
  if (routeType === "stocks") return "stock";
  if (routeType === "etfs") return "etf";
  if (routeType === "bonds") return "bond";
  if (routeType === "crypto-coins" || routeType === "cex-pairs" || routeType === "dex-pairs") return "crypto";
  return routeType;
}

function MultiSelectEditor({
  options,
  selected,
  onChange,
}: {
  options: ScreenerOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return options;
    const needle = search.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle));
  }, [options, search]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((entry) => entry !== value));
      return;
    }
    onChange([...selected, value]);
  };

  return (
    <div className="w-[320px] rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
      {options.length > 8 && (
        <div className="mb-2 border-b border-border/40 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search filter values"
              className="w-full rounded-md border border-border/50 bg-secondary/25 py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="max-h-64 overflow-auto pr-1">
        {filtered.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">No results</p>
        )}

        {filtered.map((option) => {
          const active = selectedSet.has(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs transition-colors ${
                active ? "bg-primary/12 text-foreground" : "text-foreground/85 hover:bg-secondary/45"
              }`}
            >
              <span className="truncate">{option.label}</span>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-2 w-full rounded-md border border-border/50 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}

function RangeEditor({
  value,
  onChange,
}: {
  value?: RangeFilterValue;
  onChange: (next?: RangeFilterValue) => void;
}) {
  const [minValue, setMinValue] = useState(value?.min !== undefined ? String(value.min) : "");
  const [maxValue, setMaxValue] = useState(value?.max !== undefined ? String(value.max) : "");

  const apply = () => {
    const min = minValue === "" ? undefined : Number(minValue);
    const max = maxValue === "" ? undefined : Number(maxValue);
    if ((min !== undefined && !Number.isFinite(min)) || (max !== undefined && !Number.isFinite(max))) return;
    onChange(min === undefined && max === undefined ? undefined : { min, max });
  };

  return (
    <div className="w-[280px] rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-xl">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={minValue}
          onChange={(event) => setMinValue(event.target.value)}
          placeholder="Min"
          className="rounded-md border border-border/50 bg-secondary/25 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
        />
        <input
          value={maxValue}
          onChange={(event) => setMaxValue(event.target.value)}
          placeholder="Max"
          className="rounded-md border border-border/50 bg-secondary/25 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={apply}
          className="flex-1 rounded-md border border-primary/45 bg-primary/12 px-2 py-1.5 text-xs font-medium text-primary"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => {
            setMinValue("");
            setMaxValue("");
            onChange(undefined);
          }}
          className="flex-1 rounded-md border border-border/50 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function DateRangeEditor({
  value,
  onChange,
}: {
  value?: DateRangeFilterValue;
  onChange: (next?: DateRangeFilterValue) => void;
}) {
  const [from, setFrom] = useState(value?.from || "");
  const [to, setTo] = useState(value?.to || "");

  return (
    <div className="w-[280px] rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-xl">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={from}
          onChange={(event) => {
            const next = event.target.value;
            setFrom(next);
            onChange(next || to ? { from: next || undefined, to: to || undefined } : undefined);
          }}
          className="rounded-md border border-border/50 bg-secondary/25 px-2 py-1.5 text-xs text-foreground focus:border-primary/40 focus:outline-none"
        />
        <input
          type="date"
          value={to}
          onChange={(event) => {
            const next = event.target.value;
            setTo(next);
            onChange(from || next ? { from: from || undefined, to: next || undefined } : undefined);
          }}
          className="rounded-md border border-border/50 bg-secondary/25 px-2 py-1.5 text-xs text-foreground focus:border-primary/40 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          setFrom("");
          setTo("");
          onChange(undefined);
        }}
        className="mt-2 w-full rounded-md border border-border/50 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Clear dates
      </button>
    </div>
  );
}

function ToggleEditor({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="w-[220px] rounded-xl border border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-xl">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-full rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
          value ? "border-primary/45 bg-primary/12 text-primary" : "border-border/50 text-foreground/85"
        }`}
      >
        {value ? "Enabled" : "Disabled"}
      </button>
    </div>
  );
}

export default function Screener() {
  const navigate = useNavigate();
  const location = useLocation();
  const { type } = useParams<{ type: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMobile } = useResponsive();
  const { isAuthenticated } = useApp();

  const [meta, setMeta] = useState<ScreenerMetaResponse | null>(null);
  const [stats, setStats] = useState<ScreenerStatsResponse | null>(null);

  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [queryInput, setQueryInput] = useState(searchParams.get("q") || "");

  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [screenMenuOpen, setScreenMenuOpen] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [editingFilterKey, setEditingFilterKey] = useState<string | null>(null);
  const [manualFilterKeys, setManualFilterKeys] = useState<string[]>([]);
  const [addFilterSearch, setAddFilterSearch] = useState("");
  const [addColumnSearch, setAddColumnSearch] = useState("");

  /* ── Saved screens state ── */
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>([]);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [renamingScreenId, setRenamingScreenId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [screenDirty, setScreenDirty] = useState(false);

  const fetchKeyRef = useRef("");
  const fetchCounterRef = useRef(0);
  const hasMoreRef = useRef(true);
  const offsetRef = useRef(0);
  const prefetchInFlightRef = useRef(false);
  const prefetchedRef = useRef<{ key: string; offset: number; payload: ScreenerListResponse } | null>(null);

  const typeMenuRef = useRef<HTMLDivElement | null>(null);
  const screenMenuRef = useRef<HTMLDivElement | null>(null);
  const addFilterRef = useRef<HTMLDivElement | null>(null);
  const addColumnRef = useRef<HTMLDivElement | null>(null);
  const filterChipRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const availableRouteTypes = useMemo(
    () => (meta?.screenerTypes.length ? meta.screenerTypes.map((entry) => entry.routeType) : FALLBACK_SCREENER_TYPES.map((entry) => entry.routeType)),
    [meta],
  );

  const routeType = useMemo(() => normalizeRouteType(type, availableRouteTypes), [availableRouteTypes, type]);

  useEffect(() => {
    if (!type) {
      navigate("/screener/stocks", { replace: true });
      return;
    }

    if (routeType !== type) {
      navigate(`/screener/${routeType}${location.search}`, { replace: true });
    }
  }, [location.search, navigate, routeType, type]);

  useEffect(() => {
    const nextQuery = searchParams.get("q") || "";
    setQueryInput(nextQuery);
  }, [searchParams]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [metaResponse, statsResponse] = await Promise.all([
          api.get<ScreenerMetaResponse>("/screener/meta"),
          api.get<ScreenerStatsResponse>("/screener/stats"),
        ]);
        setMeta(metaResponse.data);
        setStats(statsResponse.data);
      } catch {
        setMeta((current) => current ?? {
          screenerTypes: FALLBACK_SCREENER_TYPES,
          heatmapTypes: [],
          tabs: [{ key: "overview", label: "Overview", defaultColumns: DEFAULT_VISIBLE_COLUMNS }],
          filterCategories: [],
          filterFields: [],
          columnFields: DEFAULT_VISIBLE_COLUMNS.map((column) => ({ key: column, label: column, category: "market-data" })),
          screenMenuOptions: [],
          countries: [],
          indices: [],
          watchlists: [],
          sectors: [],
          exchanges: [],
        });
      }
    };

    void loadMeta();
  }, []);

  /* ── Saved screens CRUD ── */
  const loadScreens = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get<{ screens: SavedScreen[] }>("/screens");
      setSavedScreens(res.data.screens);
    } catch { /* ignore for unauth */ }
  }, [isAuthenticated]);

  useEffect(() => { void loadScreens(); }, [loadScreens]);

  const saveScreen = useCallback(async (name?: string) => {
    if (!isAuthenticated) return;
    const payload = {
      name: name || "Unnamed screen",
      screenerType: routeType,
      tab: searchParams.get("tab") || "overview",
      columns: parseCsv(searchParams.get("columns") || ""),
      filters: parseFiltersFromSearch(searchParams),
      sort: searchParams.get("sort") || "marketCap",
      order: searchParams.get("order") || "desc",
      query: searchParams.get("q") || "",
    };
    try {
      if (activeScreenId) {
        await api.put(`/screens/${activeScreenId}`, payload);
      } else {
        const res = await api.post<{ screen: SavedScreen }>("/screens", payload);
        setActiveScreenId(res.data.screen._id);
      }
      setScreenDirty(false);
      void loadScreens();
    } catch { /* ignore */ }
  }, [isAuthenticated, routeType, searchParams, activeScreenId, loadScreens]);

  const deleteScreenById = useCallback(async (id: string) => {
    try {
      await api.delete(`/screens/${id}`);
      if (activeScreenId === id) setActiveScreenId(null);
      void loadScreens();
    } catch { /* ignore */ }
  }, [activeScreenId, loadScreens]);

  const copyScreenById = useCallback(async (id: string) => {
    try {
      await api.post(`/screens/${id}/copy`);
      void loadScreens();
    } catch { /* ignore */ }
  }, [loadScreens]);

  const renameScreenById = useCallback(async (id: string, newName: string) => {
    try {
      await api.put(`/screens/${id}`, { name: newName });
      void loadScreens();
    } catch { /* ignore */ }
  }, [loadScreens]);

  const loadScreenState = useCallback((screen: SavedScreen) => {
    setActiveScreenId(screen._id);
    setScreenDirty(false);
    const params = new URLSearchParams();
    params.set("tab", screen.tab || "overview");
    if (screen.columns?.length) params.set("columns", screen.columns.join(","));
    if (screen.sort) params.set("sort", screen.sort);
    if (screen.order) params.set("order", screen.order);
    if (screen.query) params.set("q", screen.query);

    const filters = screen.filters || {};
    for (const [key, val] of Object.entries(filters)) {
      if (Array.isArray(val) && val.length > 0) {
        params.set(getMultiParamName(key), val.join(","));
      } else if (typeof val === "boolean" && val) {
        if (key === "primaryListingOnly") params.set("primaryListing", "true");
      } else if (val && typeof val === "object") {
        const obj = val as Record<string, unknown>;
        if ("min" in obj && obj.min !== undefined) params.set(`${key}Min`, String(obj.min));
        if ("max" in obj && obj.max !== undefined) params.set(`${key}Max`, String(obj.max));
        if ("from" in obj && obj.from) {
          const names = getDateParamNames(key);
          params.set(names.from, String(obj.from));
        }
        if ("to" in obj && obj.to) {
          const names = getDateParamNames(key);
          params.set(names.to, String(obj.to));
        }
      }
    }

    if (screen.screenerType !== routeType) {
      navigate(`/screener/${screen.screenerType}?${params.toString()}`);
    } else {
      setSearchParams(params, { replace: true });
    }
  }, [navigate, routeType, setSearchParams]);

  // Mark dirty when URL changes and a screen is active
  useEffect(() => {
    if (activeScreenId) setScreenDirty(true);
  }, [searchParams, activeScreenId]);

  const activeScreenName = useMemo(() => {
    if (!activeScreenId) return "Unnamed screen";
    const found = savedScreens.find((s) => s._id === activeScreenId);
    return found?.name || "Unnamed screen";
  }, [activeScreenId, savedScreens]);

  const parsedFilters = useMemo(() => parseFiltersFromSearch(searchParams), [searchParams]);

  const activeTab = searchParams.get("tab") || "overview";
  const sortField = searchParams.get("sort") || "marketCap";
  const sortOrder: SortOrder = searchParams.get("order") === "asc" ? "asc" : "desc";

  const tabLookup = useMemo(() => {
    const map = new Map<string, ScreenerTabDefinition>();
    (meta?.tabs || []).forEach((tab) => map.set(tab.key, tab));
    return map;
  }, [meta]);

  const activeTabDef = tabLookup.get(activeTab) || meta?.tabs[0];
  const tabDefaultColumns = activeTabDef?.defaultColumns || DEFAULT_VISIBLE_COLUMNS;

  const columnsParam = searchParams.get("columns") || "";
  const selectedColumnsFromQuery = useMemo(() => parseCsv(columnsParam), [columnsParam]);

  const selectedColumns = useMemo(() => {
    const fallback = selectedColumnsFromQuery.length > 0 ? selectedColumnsFromQuery : tabDefaultColumns;
    const deduped = dedupe(fallback);
    if (!deduped.includes("symbol")) deduped.unshift("symbol");
    return deduped;
  }, [selectedColumnsFromQuery, tabDefaultColumns]);

  const columnLookup = useMemo(() => {
    const map = new Map<string, ScreenerColumnField>();
    (meta?.columnFields || []).forEach((column) => map.set(column.key, column));
    return map;
  }, [meta]);

  const filterLookup = useMemo(() => {
    const map = new Map<string, ScreenerFilterField>();
    (meta?.filterFields || []).forEach((field) => map.set(field.key, field));
    return map;
  }, [meta]);

  const activeFilterKeys = useMemo(() => {
    const keys: string[] = [];
    for (const key of [...MULTI_FILTER_KEYS, ...RANGE_FILTER_KEYS, ...DATE_FILTER_KEYS, ...TOGGLE_FILTER_KEYS]) {
      if (isFilterActiveValue(parsedFilters[key])) keys.push(key);
    }
    return keys;
  }, [parsedFilters]);

  const visibleFilterKeys = useMemo(
    () => dedupe([...DEFAULT_FILTER_KEYS, ...manualFilterKeys, ...activeFilterKeys]).filter((key) => filterLookup.has(key)),
    [activeFilterKeys, filterLookup, manualFilterKeys],
  );

  const filterFields = useMemo(() => visibleFilterKeys.map((key) => filterLookup.get(key)).filter(Boolean) as ScreenerFilterField[], [filterLookup, visibleFilterKeys]);

  const filterCount = activeFilterKeys.length;

  const updateSearch = useCallback((apply: (next: URLSearchParams) => void) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      apply(next);
      if (!next.get("tab")) next.set("tab", "overview");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const clearLegacyFilterParams = useCallback((params: URLSearchParams) => {
    params.delete("country");
    params.delete("sector");
    params.delete("exchange");
    params.delete("primary");
  }, []);

  const setMultiFilter = useCallback((key: string, values: string[]) => {
    const paramName = getMultiParamName(key);
    updateSearch((next) => {
      clearLegacyFilterParams(next);
      if (values.length === 0) next.delete(paramName);
      else next.set(paramName, values.join(","));
    });
  }, [clearLegacyFilterParams, updateSearch]);

  const setRangeFilter = useCallback((key: string, value?: RangeFilterValue) => {
    updateSearch((next) => {
      next.delete(`${key}Min`);
      next.delete(`${key}Max`);
      if (value?.min !== undefined) next.set(`${key}Min`, String(value.min));
      if (value?.max !== undefined) next.set(`${key}Max`, String(value.max));
    });
  }, [updateSearch]);

  const setDateFilter = useCallback((key: string, value?: DateRangeFilterValue) => {
    const params = getDateParamNames(key);
    updateSearch((next) => {
      next.delete(params.from);
      next.delete(params.to);
      if (value?.from) next.set(params.from, value.from);
      if (value?.to) next.set(params.to, value.to);
    });
  }, [updateSearch]);

  const setToggleFilter = useCallback((key: string, value: boolean) => {
    if (key !== "primaryListingOnly") return;
    updateSearch((next) => {
      next.delete("primary");
      if (value) next.set("primaryListing", "true");
      else next.delete("primaryListing");
    });
  }, [updateSearch]);

  const clearAllFilters = useCallback(() => {
    updateSearch((next) => {
      clearLegacyFilterParams(next);
      for (const key of MULTI_FILTER_KEYS) {
        next.delete(getMultiParamName(key));
      }
      for (const key of RANGE_FILTER_KEYS) {
        next.delete(`${key}Min`);
        next.delete(`${key}Max`);
      }
      for (const key of DATE_FILTER_KEYS) {
        const names = getDateParamNames(key);
        next.delete(names.from);
        next.delete(names.to);
      }
      next.delete("primaryListing");
    });
    setManualFilterKeys([]);
    setEditingFilterKey(null);
  }, [clearLegacyFilterParams, updateSearch]);

  const requestKey = useMemo(() => {
    return JSON.stringify({
      routeType,
      tab: activeTab,
      sortField,
      sortOrder,
      query: searchParams.get("q") || "",
      columns: selectedColumns,
      filters: parsedFilters,
    });
  }, [activeTab, parsedFilters, routeType, searchParams, selectedColumns, sortField, sortOrder]);

  const buildRequestParams = useCallback((offset: number) => {
    const params: Record<string, string | number | boolean> = {
      type: routeType,
      tab: activeTab,
      columns: selectedColumns.join(","),
      limit: BATCH_SIZE,
      offset,
      sort: sortField,
      order: sortOrder,
    };

    const q = searchParams.get("q") || "";
    if (q) params.q = q;

    for (const key of MULTI_FILTER_KEYS) {
      const value = parsedFilters[key];
      if (Array.isArray(value) && value.length > 0) {
        params[getMultiParamName(key)] = value.join(",");
      }
    }

    for (const key of RANGE_FILTER_KEYS) {
      const value = parsedFilters[key] as RangeFilterValue | undefined;
      if (value?.min !== undefined) params[`${key}Min`] = value.min;
      if (value?.max !== undefined) params[`${key}Max`] = value.max;
    }

    for (const key of DATE_FILTER_KEYS) {
      const value = parsedFilters[key] as DateRangeFilterValue | undefined;
      if (!value) continue;
      const names = getDateParamNames(key);
      if (value.from) params[names.from] = value.from;
      if (value.to) params[names.to] = value.to;
    }

    if (parsedFilters.primaryListingOnly === true) {
      params.primaryListing = true;
    }

    return params;
  }, [activeTab, parsedFilters, routeType, searchParams, selectedColumns, sortField, sortOrder]);

  const fetchBatch = useCallback(async (offset: number): Promise<ScreenerListResponse> => {
    const response = await api.get<ScreenerListResponse>("/screener/list", {
      params: buildRequestParams(offset),
    });
    return response.data;
  }, [buildRequestParams]);

  const schedulePrefetch = useCallback(async (key: string, offset: number) => {
    if (prefetchInFlightRef.current) return;
    if (!hasMoreRef.current) return;

    prefetchInFlightRef.current = true;
    try {
      const payload = await fetchBatch(offset);
      if (fetchKeyRef.current !== key) return;
      prefetchedRef.current = { key, offset, payload };
    } catch {
      prefetchedRef.current = null;
    } finally {
      prefetchInFlightRef.current = false;
    }
  }, [fetchBatch]);

  const refreshList = useCallback(async () => {
    setLoading(true);
    setLoadingMore(false);
    prefetchedRef.current = null;
    hasMoreRef.current = true;
    offsetRef.current = 0;

    const key = requestKey;
    fetchKeyRef.current = key;
    const fetchId = ++fetchCounterRef.current;

    try {
      const payload = await fetchBatch(0);
      if (fetchCounterRef.current !== fetchId || fetchKeyRef.current !== key) return;

      setItems(payload.items);
      setTotal(payload.total);
      hasMoreRef.current = payload.hasMore;
      offsetRef.current = payload.offset + payload.items.length;

      if (payload.hasMore) {
        void schedulePrefetch(key, offsetRef.current);
      }
    } catch {
      if (fetchCounterRef.current === fetchId) {
        setItems([]);
        setTotal(0);
        hasMoreRef.current = false;
      }
    } finally {
      if (fetchCounterRef.current === fetchId) {
        setLoading(false);
      }
    }
  }, [fetchBatch, requestKey, schedulePrefetch]);

  const refreshListRef = useRef(refreshList);
  refreshListRef.current = refreshList;

  useEffect(() => {
    void refreshListRef.current();
  }, [requestKey]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMoreRef.current) return;

    const key = fetchKeyRef.current;
    const offset = offsetRef.current;

    if (prefetchedRef.current && prefetchedRef.current.key === key && prefetchedRef.current.offset === offset) {
      const payload = prefetchedRef.current.payload;
      prefetchedRef.current = null;

      setItems((previous) => [...previous, ...payload.items]);
      setTotal(payload.total);
      hasMoreRef.current = payload.hasMore;
      offsetRef.current = offset + payload.items.length;

      if (payload.hasMore) {
        void schedulePrefetch(key, offsetRef.current);
      }
      return;
    }

    setLoadingMore(true);
    const fetchId = ++fetchCounterRef.current;

    try {
      const payload = await fetchBatch(offset);
      if (fetchCounterRef.current !== fetchId || fetchKeyRef.current !== key) return;

      setItems((previous) => [...previous, ...payload.items]);
      setTotal(payload.total);
      hasMoreRef.current = payload.hasMore;
      offsetRef.current = offset + payload.items.length;

      if (payload.hasMore) {
        void schedulePrefetch(key, offsetRef.current);
      }
    } finally {
      if (fetchCounterRef.current === fetchId) {
        setLoadingMore(false);
      }
    }
  }, [fetchBatch, loading, loadingMore, schedulePrefetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (queryInput !== (searchParams.get("q") || "")) {
        updateSearch((next) => {
          if (!queryInput) next.delete("q");
          else next.set("q", queryInput);
        });
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [queryInput, searchParams, updateSearch]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (typeMenuOpen && typeMenuRef.current && !typeMenuRef.current.contains(target)) {
        setTypeMenuOpen(false);
      }
      if (screenMenuOpen && screenMenuRef.current && !screenMenuRef.current.contains(target)) {
        setScreenMenuOpen(false);
      }
      if (addFilterOpen && addFilterRef.current && !addFilterRef.current.contains(target)) {
        setAddFilterOpen(false);
      }
      if (addColumnOpen && addColumnRef.current && !addColumnRef.current.contains(target)) {
        setAddColumnOpen(false);
      }

      if (editingFilterKey) {
        const activeRef = filterChipRefs.current[editingFilterKey];
        if (activeRef && !activeRef.contains(target)) {
          setEditingFilterKey(null);
        }
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [addColumnOpen, addFilterOpen, editingFilterKey, screenMenuOpen, typeMenuOpen]);

  useEffect(() => {
    setTypeMenuOpen(false);
    setScreenMenuOpen(false);
    setAddFilterOpen(false);
    setAddColumnOpen(false);
    setEditingFilterKey(null);
  }, [location.pathname, location.search]);

  const currentType = useMemo(() => {
    const lookup = meta?.screenerTypes || FALLBACK_SCREENER_TYPES;
    return lookup.find((entry) => entry.routeType === routeType) || lookup[0];
  }, [meta, routeType]);

  const setSort = (field: string) => {
    updateSearch((next) => {
      if ((next.get("sort") || "marketCap") === field) {
        next.set("order", (next.get("order") || "desc") === "desc" ? "asc" : "desc");
      } else {
        next.set("sort", field);
        next.set("order", "desc");
      }
    });
  };

  const onTypeSelect = (nextType: string) => {
    setTypeMenuOpen(false);
    navigate(`/screener/${nextType}${location.search}`);
  };

  const onTabSelect = (nextTab: ScreenerTabDefinition) => {
    updateSearch((next) => {
      next.set("tab", nextTab.key);
      next.set("columns", nextTab.defaultColumns.join(","));
    });
  };

  const visibleColumns = useMemo(() => {
    const available = selectedColumns.filter((column) => columnLookup.has(column));
    if (available.length === 0) return DEFAULT_VISIBLE_COLUMNS;
    if (!available.includes("symbol")) return ["symbol", ...available];
    return available;
  }, [columnLookup, selectedColumns]);

  const tableGridTemplate = useMemo(
    () => visibleColumns.map((column) => COLUMN_WIDTHS[column] || "minmax(110px, 1fr)").join(" "),
    [visibleColumns],
  );

  const tableMinWidth = Math.max(920, visibleColumns.length * 130);

  const updateSelectedColumns = (nextColumns: string[]) => {
    const deduped = dedupe(nextColumns);
    if (!deduped.includes("symbol")) deduped.unshift("symbol");

    updateSearch((next) => {
      next.set("columns", deduped.join(","));
    });
  };

  const availableAddFilterFields = useMemo(() => {
    const needle = addFilterSearch.toLowerCase();
    return (meta?.filterFields || []).filter((field) => {
      if (!needle) return true;
      return field.label.toLowerCase().includes(needle) || field.category.toLowerCase().includes(needle);
    });
  }, [addFilterSearch, meta]);

  const availableAddColumnFields = useMemo(() => {
    const needle = addColumnSearch.toLowerCase();
    return (meta?.columnFields || []).filter((column) => {
      if (!needle) return true;
      return column.label.toLowerCase().includes(needle) || column.category.toLowerCase().includes(needle);
    });
  }, [addColumnSearch, meta]);

  const renderFilterEditor = (field: ScreenerFilterField) => {
    if (field.inputType === "multiselect") {
      const selected = (parsedFilters[field.key] as string[] | undefined) || [];
      return (
        <MultiSelectEditor
          options={field.options || []}
          selected={selected}
          onChange={(next) => setMultiFilter(field.key, next)}
        />
      );
    }

    if (field.inputType === "range") {
      return (
        <RangeEditor
          value={parsedFilters[field.key] as RangeFilterValue | undefined}
          onChange={(next) => setRangeFilter(field.key, next)}
        />
      );
    }

    if (field.inputType === "date-range") {
      return (
        <DateRangeEditor
          value={parsedFilters[field.key] as DateRangeFilterValue | undefined}
          onChange={(next) => setDateFilter(field.key, next)}
        />
      );
    }

    return (
      <ToggleEditor
        value={parsedFilters[field.key] === true}
        onChange={(next) => setToggleFilter(field.key, next)}
      />
    );
  };

  const renderCell = (item: ScreenerItem, columnKey: string) => {
    if (columnKey === "symbol") {
      return (
        <div className="flex min-w-0 items-center gap-2.5">
          <AssetAvatar
            src={item.iconUrl}
            label={item.symbol}
            className="h-7 w-7 shrink-0 rounded-full object-contain bg-white/90 p-0.5 ring-1 ring-border/40"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{item.symbol}</p>
            <p className="truncate text-[11px] text-muted-foreground">{item.name}</p>
          </div>
        </div>
      );
    }

    if (columnKey === "changePercent" || columnKey === "perfPercent") {
      const raw = item[columnKey as keyof ScreenerItem];
      if (raw === null || raw === undefined) return <span className="text-xs text-muted-foreground">—</span>;
      const num = Number(raw);
      const positive = num > 0;
      const negative = num < 0;
      return (
        <span className={`text-xs font-semibold tabular-nums ${positive ? "text-emerald-400" : ""} ${negative ? "text-red-400" : "text-muted-foreground"}`}>
          {formatPercent(num)}
        </span>
      );
    }

    if (columnKey === "price") {
      return <span className="text-xs tabular-nums text-foreground">{formatPrice(item.price)}</span>;
    }

    if (columnKey === "recentEarningsDate" || columnKey === "upcomingEarningsDate") {
      return <span className="text-xs text-foreground/85">{formatDateValue(item[columnKey as keyof ScreenerItem] as string | undefined)}</span>;
    }

    const raw = item[columnKey as keyof ScreenerItem];

    if (NUMERIC_COLUMNS.has(columnKey)) {
      if (raw === null || raw === undefined) return <span className="text-xs text-muted-foreground">—</span>;
      const num = Number(raw);
      if (!Number.isFinite(num) || num === 0) return <span className="text-xs text-muted-foreground">—</span>;

      if (columnKey === "pe" || columnKey === "peg" || columnKey === "beta" || columnKey === "roe" || columnKey === "relVolume" || columnKey === "epsDilTtm" || columnKey === "epsDilGrowth" || columnKey === "divYieldPercent") {
        return <span className="text-xs tabular-nums text-foreground">{num.toFixed(2)}</span>;
      }

      return <span className="text-xs tabular-nums text-foreground">{formatCompactNumber(num)}</span>;
    }

    return <span className="truncate text-xs text-foreground/85">{raw ? String(raw) : "—"}</span>;
  };

  return (
    <div className="min-h-screen bg-background pb-8 pt-3">
      <div className="mx-auto max-w-[1480px] px-4 md:px-6">
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>Screener</span>
          <span className="text-muted-foreground/35">/</span>
          <span>{currentType?.label || "Stock Screener"}</span>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2 md:gap-3">
          <div className="relative" ref={typeMenuRef}>
            <button
              type="button"
              onClick={() => setTypeMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg border border-border/55 bg-secondary/25 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-border"
            >
              {currentType?.label || "Stock Screener"}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>

            {typeMenuOpen && (
              <div className="absolute left-0 top-full z-40 mt-1.5 w-[280px] rounded-xl border border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl">
                {(meta?.screenerTypes || FALLBACK_SCREENER_TYPES).map((entry) => {
                  const active = entry.routeType === routeType;
                  return (
                    <button
                      key={entry.routeType}
                      type="button"
                      onClick={() => onTypeSelect(entry.routeType)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                        active ? "bg-primary/12 text-foreground" : "text-foreground/85 hover:bg-secondary/45"
                      }`}
                    >
                      <span>{entry.label}</span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative" ref={screenMenuRef}>
            <button
              type="button"
              onClick={() => setScreenMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg border border-border/55 bg-secondary/25 px-3 py-2 text-sm text-foreground transition-colors hover:border-border"
            >
              {activeScreenName}
              {screenDirty && activeScreenId && <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Unsaved changes" />}
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </button>

            {screenMenuOpen && (
              <div className="absolute left-0 top-full z-40 mt-1.5 w-[280px] rounded-xl border border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl">
                {/* Save / Save As */}
                {isAuthenticated && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void saveScreen(activeScreenId ? activeScreenName : undefined);
                        setScreenMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/45"
                    >
                      <Save className="h-3.5 w-3.5 text-muted-foreground" />
                      {activeScreenId ? "Save" : "Save screen"}
                    </button>
                    {activeScreenId && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveScreenId(null);
                          void saveScreen("Unnamed screen");
                          setScreenMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/45"
                      >
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        Save as new
                      </button>
                    )}
                  </>
                )}

                {/* Saved screens list */}
                {savedScreens.length > 0 && (
                  <>
                    <div className="my-1.5 h-px bg-border/40" />
                    <p className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Saved Screens</p>
                    <div className="max-h-48 overflow-auto">
                      {savedScreens.map((screen) => (
                        <div
                          key={screen._id}
                          className={`group flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-secondary/45 ${
                            screen._id === activeScreenId ? "bg-primary/12" : ""
                          }`}
                        >
                          {renamingScreenId === screen._id ? (
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={() => {
                                if (renameValue.trim()) {
                                  void renameScreenById(screen._id, renameValue.trim());
                                }
                                setRenamingScreenId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (renameValue.trim()) {
                                    void renameScreenById(screen._id, renameValue.trim());
                                  }
                                  setRenamingScreenId(null);
                                }
                                if (e.key === "Escape") setRenamingScreenId(null);
                              }}
                              className="mr-2 flex-1 rounded border border-primary/40 bg-secondary/25 px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                loadScreenState(screen);
                                setScreenMenuOpen(false);
                              }}
                              className="flex-1 truncate text-left text-sm text-foreground/85"
                            >
                              {screen.name}
                            </button>
                          )}

                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => { setRenamingScreenId(screen._id); setRenameValue(screen.name); }}
                              className="rounded p-1 text-muted-foreground hover:text-foreground" title="Rename">
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => void copyScreenById(screen._id)}
                              className="rounded p-1 text-muted-foreground hover:text-foreground" title="Duplicate">
                              <Copy className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => void deleteScreenById(screen._id)}
                              className="rounded p-1 text-muted-foreground hover:text-red-400" title="Delete">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {!isAuthenticated && (
                  <p className="px-2.5 py-2 text-xs text-muted-foreground">Log in to save screens</p>
                )}
              </div>
            )}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Search by symbol or company"
                className="w-[220px] rounded-lg border border-border/55 bg-secondary/25 py-2 pl-7 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
              />
              {queryInput && (
                <button
                  type="button"
                  onClick={() => setQueryInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {queryInput && isSpreadExpression(queryInput) && (
              <button
                type="button"
                onClick={() => navigate(`/simulation?symbol=${encodeURIComponent(queryInput)}`)}
                className="rounded-lg border border-primary/45 bg-primary/12 px-3 py-2 text-xs font-semibold text-primary"
              >
                Open spread chart
              </button>
            )}
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {filterFields.map((field) => {
            const value = parsedFilters[field.key];
            const active = isFilterActiveValue(value);

            return (
              <div
                key={field.key}
                ref={(element) => {
                  filterChipRefs.current[field.key] = element;
                }}
                className="relative"
              >
                <button
                  type="button"
                  onClick={() => setEditingFilterKey((current) => (current === field.key ? null : field.key))}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary/40 bg-primary/12 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {buildFilterLabel(field, value)}
                  <ChevronDown className="h-3 w-3" />
                </button>

                {active && !DEFAULT_FILTER_KEYS.includes(field.key) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFilterKey(null);

                      if (field.inputType === "multiselect") setMultiFilter(field.key, []);
                      if (field.inputType === "range") setRangeFilter(field.key, undefined);
                      if (field.inputType === "date-range") setDateFilter(field.key, undefined);
                      if (field.inputType === "toggle") setToggleFilter(field.key, false);

                      setManualFilterKeys((current) => current.filter((entry) => entry !== field.key));
                    }}
                    className="absolute -right-1 -top-1 rounded-full border border-border/50 bg-background p-0.5 text-muted-foreground transition-colors hover:text-red-400"
                    aria-label={`Remove ${field.label} filter`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}

                {editingFilterKey === field.key && (
                  <div className="absolute left-0 top-full z-40 mt-1.5">
                    {renderFilterEditor(field)}
                  </div>
                )}
              </div>
            );
          })}

          <div className="relative" ref={addFilterRef}>
            <button
              type="button"
              onClick={() => setAddFilterOpen((open) => !open)}
              className="inline-flex items-center gap-1 rounded-lg border border-border/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              <Filter className="h-3.5 w-3.5" />
              Add filter
            </button>

            {addFilterOpen && (
              <div className="absolute left-0 top-full z-40 mt-1.5 w-[340px] rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
                <div className="mb-2 border-b border-border/40 pb-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={addFilterSearch}
                      onChange={(event) => setAddFilterSearch(event.target.value)}
                      placeholder="Search filters"
                      className="w-full rounded-md border border-border/50 bg-secondary/25 py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="max-h-72 overflow-auto pr-1">
                  {availableAddFilterFields.map((field) => {
                    const active = visibleFilterKeys.includes(field.key);
                    return (
                      <button
                        key={field.key}
                        type="button"
                        onClick={() => {
                          setManualFilterKeys((current) => dedupe([...current, field.key]));
                          setEditingFilterKey(field.key);
                          setAddFilterOpen(false);
                        }}
                        className={`mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                          active ? "bg-primary/12 text-foreground" : "text-foreground/85 hover:bg-secondary/45"
                        }`}
                      >
                        <span>{field.label}</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{field.category}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={addColumnRef}>
            <button
              type="button"
              onClick={() => setAddColumnOpen((open) => !open)}
              className="inline-flex items-center gap-1 rounded-lg border border-border/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              <Columns3 className="h-3.5 w-3.5" />
              Add column
            </button>

            {addColumnOpen && (
              <div className="absolute right-0 top-full z-40 mt-1.5 w-[340px] rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
                <div className="mb-2 border-b border-border/40 pb-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={addColumnSearch}
                      onChange={(event) => setAddColumnSearch(event.target.value)}
                      placeholder="Search columns"
                      className="w-full rounded-md border border-border/50 bg-secondary/25 py-1.5 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="max-h-72 overflow-auto pr-1">
                  {availableAddColumnFields.map((column) => {
                    const checked = visibleColumns.includes(column.key);
                    return (
                      <button
                        key={column.key}
                        type="button"
                        onClick={() => {
                          if (column.key === "symbol" && checked) return;
                          if (checked) {
                            updateSelectedColumns(visibleColumns.filter((entry) => entry !== column.key));
                          } else {
                            updateSelectedColumns([...visibleColumns, column.key]);
                          }
                        }}
                        className={`mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                          checked ? "bg-primary/12 text-foreground" : "text-foreground/85 hover:bg-secondary/45"
                        }`}
                      >
                        <span>{column.label}</span>
                        {checked ? <Check className="h-3.5 w-3.5 text-primary" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {filterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400 transition-colors hover:text-red-300"
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </button>
          )}
        </div>

        <div className="mb-2 flex items-center gap-0.5 overflow-x-auto border-b border-border/25 pb-0.5 scrollbar-hide">
          {(meta?.tabs || [{ key: "overview", label: "Overview", defaultColumns: DEFAULT_VISIBLE_COLUMNS }]).map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabSelect(tab)}
                className={`relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {active && <motion.div layoutId="screener-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
              </button>
            );
          })}

          {/* Symbol count hidden until 600K+ symbols mapped */}
        </div>

        {loading && items.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-background/40 py-16 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading screener data...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border/40 bg-background/40 py-16 text-center">
            <p className="text-base text-foreground">No symbols found</p>
            <p className="mt-1 text-sm text-muted-foreground">Adjust filters or search query to broaden results.</p>
          </div>
        ) : isMobile ? (
          <div className="rounded-xl border border-border/30 bg-background/40">
            <Virtuoso
              data={items}
              style={{ height: "calc(100vh - 330px)", minHeight: 420 }}
              endReached={() => {
                void loadMore();
              }}
              overscan={300}
              itemContent={(index, item) => (
                <button
                  type="button"
                  onClick={() => navigate(`/symbol/${encodeURIComponent(item.symbol)}`)}
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary/35 ${
                    index > 0 ? "border-t border-border/20" : ""
                  }`}
                >
                  <AssetAvatar
                    src={item.iconUrl}
                    label={item.symbol}
                    className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border/40"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-foreground">{item.symbol}</span>
                      <span className="text-[10px] text-muted-foreground">{item.exchange}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{item.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums text-foreground">{formatPrice(item.price)}</p>
                    <p className={`text-xs font-semibold tabular-nums ${item.changePercent > 0 ? "text-emerald-400" : item.changePercent < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {formatPercent(item.changePercent)}
                    </p>
                    <p className="text-[11px] tabular-nums text-muted-foreground">{formatCompactNumber(item.marketCap)}</p>
                  </div>
                </button>
              )}
              components={{
                Footer: () => loadingMore ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Loading more symbols...
                  </div>
                ) : null,
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/30 bg-background/40">
            <div style={{ minWidth: tableMinWidth }}>
              <div
                className="sticky top-[var(--navbar-height,64px)] z-20 grid items-center gap-2 border-b border-border/35 bg-secondary/35 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur-sm"
                style={{ gridTemplateColumns: tableGridTemplate }}
              >
                {visibleColumns.map((column) => {
                  const label = columnLookup.get(column)?.label || column;
                  const activeSort = sortField === column;

                  return (
                    <button
                      key={column}
                      type="button"
                      onClick={() => setSort(column)}
                      className={`flex items-center gap-1 ${NUMERIC_COLUMNS.has(column) ? "justify-end" : "justify-start"} transition-colors hover:text-foreground`}
                    >
                      <span>{label}</span>
                      {activeSort ? (
                        sortOrder === "desc" ? <TrendingDown className="h-3.5 w-3.5 text-primary" /> : <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground/70" />
                      )}
                    </button>
                  );
                })}
              </div>

              <Virtuoso
                data={items}
                style={{ height: "calc(100vh - 350px)", minHeight: 420 }}
                endReached={() => {
                  void loadMore();
                }}
                overscan={450}
                itemContent={(index, item) => (
                  <button
                    key={`${item.fullSymbol}-${index}`}
                    type="button"
                    onClick={() => navigate(`/symbol/${encodeURIComponent(item.symbol)}`)}
                    className={`grid w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-secondary/30 ${
                      index > 0 ? "border-t border-border/20" : ""
                    }`}
                    style={{ gridTemplateColumns: tableGridTemplate }}
                  >
                    {visibleColumns.map((column) => (
                      <div key={column} className={`${NUMERIC_COLUMNS.has(column) ? "text-right" : "text-left"} min-w-0`}>
                        {renderCell(item, column)}
                      </div>
                    ))}
                  </button>
                )}
                components={{
                  Footer: () => loadingMore ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading more symbols...
                    </div>
                  ) : null,
                }}
              />
            </div>
          </div>
        )}

        {total > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {items.length.toLocaleString()} of {total.toLocaleString()} matches
              {stats?.total ? ` (${stats.total.toLocaleString()} total symbols)` : ""}
            </span>
            {loadingMore && <span className="text-primary">Loading more...</span>}
          </div>
        )}
      </div>
    </div>
  );
}
