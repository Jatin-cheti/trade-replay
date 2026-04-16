import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, ChevronDown, TrendingUp, TrendingDown, X, SlidersHorizontal, ChevronRight, BarChart3, Star, ArrowUpDown } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { api } from "@/lib/api";
import { isSpreadExpression } from "@/lib/spreadOperator";
import AssetAvatar from "@/components/ui/AssetAvatar";

/* ── Types ─────────────────────────────────────────────────────────────── */
interface ScreenerItem {
  symbol: string;
  fullSymbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  currency: string;
  iconUrl: string;
  marketCap: number;
  volume: number;
  liquidityScore: number;
  priorityScore: number;
  sector: string;
  popularity: number;
  price: number;
  change: number;
  changePercent: number;
  isPrimaryListing: boolean;
}

interface ScreenerResponse {
  items: ScreenerItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface ScreenerStats {
  total: number;
  byType: Record<string, number>;
  exchanges: string[];
  countries: string[];
  sectors: string[];
}

/* ── Constants ─────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { key: "all", label: "All", type: undefined },
  { key: "stock", label: "Stocks", type: "stock" },
  { key: "etf", label: "ETFs", type: "etf" },
  { key: "crypto", label: "Crypto", type: "crypto" },
  { key: "forex", label: "Forex", type: "forex" },
  { key: "index", label: "Indices", type: "index" },
  { key: "bond", label: "Bonds", type: "bond" },
  { key: "economy", label: "Economy", type: "economy" },
] as const;

const COUNTRY_FLAGS: Record<string, string> = {
  US: "\u{1F1FA}\u{1F1F8}", IN: "\u{1F1EE}\u{1F1F3}", GB: "\u{1F1EC}\u{1F1E7}",
  DE: "\u{1F1E9}\u{1F1EA}", JP: "\u{1F1EF}\u{1F1F5}", CN: "\u{1F1E8}\u{1F1F3}",
  CA: "\u{1F1E8}\u{1F1E6}", AU: "\u{1F1E6}\u{1F1FA}", FR: "\u{1F1EB}\u{1F1F7}",
  KR: "\u{1F1F0}\u{1F1F7}", HK: "\u{1F1ED}\u{1F1F0}", SG: "\u{1F1F8}\u{1F1EC}",
  BR: "\u{1F1E7}\u{1F1F7}", CH: "\u{1F1E8}\u{1F1ED}", NL: "\u{1F1F3}\u{1F1F1}",
  SE: "\u{1F1F8}\u{1F1EA}", NO: "\u{1F1F3}\u{1F1F4}", DK: "\u{1F1E9}\u{1F1F0}",
  ES: "\u{1F1EA}\u{1F1F8}", IT: "\u{1F1EE}\u{1F1F9}", PT: "\u{1F1F5}\u{1F1F9}",
  RU: "\u{1F1F7}\u{1F1FA}", ZA: "\u{1F1FF}\u{1F1E6}", MX: "\u{1F1F2}\u{1F1FD}",
  AR: "\u{1F1E6}\u{1F1F7}", CL: "\u{1F1E8}\u{1F1F1}", CO: "\u{1F1E8}\u{1F1F4}",
  TH: "\u{1F1F9}\u{1F1ED}", MY: "\u{1F1F2}\u{1F1FE}", ID: "\u{1F1EE}\u{1F1E9}",
  PH: "\u{1F1F5}\u{1F1ED}", VN: "\u{1F1FB}\u{1F1F3}", TW: "\u{1F1F9}\u{1F1FC}",
  TR: "\u{1F1F9}\u{1F1F7}", PL: "\u{1F1F5}\u{1F1F1}", IL: "\u{1F1EE}\u{1F1F1}",
  AE: "\u{1F1E6}\u{1F1EA}", SA: "\u{1F1F8}\u{1F1E6}", NZ: "\u{1F1F3}\u{1F1FF}",
};

type SortField = "marketCap" | "volume" | "priorityScore" | "liquidityScore" | "symbol" | "name" | "price" | "changePercent";

const VIEW_TABS = ["Overview", "Performance", "Valuation", "Dividends", "Profitability", "Technicals"] as const;
const BATCH_SIZE = 200;

/* ── Market Cap Range Presets (TradingView style) ──────────────────── */
const MARKET_CAP_RANGES = [
  { label: "Mega (>200B)", min: 200e9, max: undefined },
  { label: "Large (10B-200B)", min: 10e9, max: 200e9 },
  { label: "Mid (2B-10B)", min: 2e9, max: 10e9 },
  { label: "Small (300M-2B)", min: 300e6, max: 2e9 },
  { label: "Micro (<300M)", min: undefined, max: 300e6 },
] as const;

const VOLUME_RANGES = [
  { label: "Very High (>20M)", min: 20e6, max: undefined },
  { label: "High (5M-20M)", min: 5e6, max: 20e6 },
  { label: "Normal (1M-5M)", min: 1e6, max: 5e6 },
  { label: "Low (<1M)", min: undefined, max: 1e6 },
] as const;

/* ── Formatters ────────────────────────────────────────────────────────── */
function fmt(value: number, suffix = ""): string {
  if (!value || value <= 0) return "\u2014";
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T${suffix}`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B${suffix}`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M${suffix}`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K${suffix}`;
  return `${value.toFixed(0)}${suffix}`;
}

function fmtPrice(value: number): string {
  if (!value || value <= 0) return "\u2014";
  if (value >= 10000) return value.toLocaleString("en", { maximumFractionDigits: 0 });
  if (value >= 1) return value.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value.toLocaleString("en", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function typeLabel(t: string): string {
  return { stock: "Stock", etf: "ETF", crypto: "Crypto", forex: "Forex", index: "Index", bond: "Bond", economy: "Economy" }[t] || t;
}

function typeBadge(t: string): string {
  return {
    stock: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    etf: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    crypto: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    forex: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    index: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    bond: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    economy: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  }[t] || "bg-gray-500/15 text-gray-400 border-gray-500/30";
}

/* ── FilterChip component ──────────────────────────────────────────────── */
function FilterChip({
  label, active, options, onSelect, onClear,
}: {
  label: string;
  active: boolean;
  options: { value: string; label: string }[];
  onSelect: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = search ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())) : options;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          active
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
        }`}
      >
        {label}
        {active ? (
          <X
            className="w-3 h-3 ml-0.5 cursor-pointer hover:text-red-400"
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false); }}
          />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-56 max-h-64 overflow-auto rounded-lg border border-border/60 bg-background/95 backdrop-blur-xl shadow-xl">
          {options.length > 8 && (
            <div className="sticky top-0 p-1.5 bg-background/95 border-b border-border/30">
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded border border-border/40 bg-secondary/20 text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
            </div>
          )}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
          )}
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onSelect(opt.value); setOpen(false); setSearch(""); }}
              className="flex w-full items-center px-3 py-1.5 text-xs text-foreground hover:bg-secondary/40 transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Screener Component ───────────────────────────────────────────── */
export default function Screener() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeCategory = searchParams.get("type") || "all";
  const activeCountry = searchParams.get("country") || "";
  const activeExchange = searchParams.get("exchange") || "";
  const activeSector = searchParams.get("sector") || "";
  const sortField = (searchParams.get("sort") || "priorityScore") as SortField;
  const sortOrder = (searchParams.get("order") as "asc" | "desc") || "desc";
  const searchQuery = searchParams.get("q") || "";
  const marketCapMin = searchParams.get("marketCapMin") || "";
  const marketCapMax = searchParams.get("marketCapMax") || "";
  const volumeMin = searchParams.get("volumeMin") || "";
  const volumeMax = searchParams.get("volumeMax") || "";
  const primaryOnly = searchParams.get("primary") || "";

  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState<ScreenerStats | null>(null);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [activeViewTab, setActiveViewTab] = useState("Overview");

  const hasMoreRef = useRef(true);
  const offsetRef = useRef(0);
  const fetchIdRef = useRef(0);

  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === "all") next.delete(k);
        else next.set(k, v);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Fetch stats once
  useEffect(() => {
    api.get<ScreenerStats>("/screener/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  // Fetch items
  const fetchItems = useCallback(async (offset: number, append: boolean) => {
    const id = ++fetchIdRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const params: Record<string, string | number> = { limit: BATCH_SIZE, offset, sort: sortField, order: sortOrder };
      const cat = CATEGORIES.find((c) => c.key === activeCategory);
      if (cat?.type) params.type = cat.type;
      if (activeCountry) params.country = activeCountry;
      if (activeExchange) params.exchange = activeExchange;
      if (activeSector) params.sector = activeSector;
      if (searchQuery) params.q = searchQuery;
      if (marketCapMin) params.marketCapMin = marketCapMin;
      if (marketCapMax) params.marketCapMax = marketCapMax;
      if (volumeMin) params.volumeMin = volumeMin;
      if (volumeMax) params.volumeMax = volumeMax;
      if (primaryOnly) params.primary = primaryOnly;

      const res = await api.get<ScreenerResponse>("/screener/list", { params });
      if (id !== fetchIdRef.current) return;

      const data = res.data;
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setTotal(data.total);
      hasMoreRef.current = data.hasMore;
      offsetRef.current = offset + data.items.length;
    } catch (err) {
      console.error("Screener fetch failed:", err);
    } finally {
      if (id === fetchIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeCategory, activeCountry, activeExchange, activeSector, sortField, sortOrder, searchQuery, marketCapMin, marketCapMax, volumeMin, volumeMax, primaryOnly]);

  useEffect(() => {
    offsetRef.current = 0;
    hasMoreRef.current = true;
    fetchItems(0, false);
  }, [fetchItems]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      if (localQuery !== searchQuery) updateParams({ q: localQuery || undefined });
    }, 300);
    return () => clearTimeout(t);
  }, [localQuery, searchQuery, updateParams]);

  const handleSort = (field: SortField) => {
    if (field === sortField) updateParams({ order: sortOrder === "desc" ? "asc" : "desc" });
    else updateParams({ sort: field, order: "desc" });
  };

  const loadMore = useCallback(() => {
    if (hasMoreRef.current && !loadingMore) fetchItems(offsetRef.current, true);
  }, [fetchItems, loadingMore]);

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortOrder === "desc"
      ? <TrendingDown className="inline ml-0.5 w-3 h-3 text-primary" />
      : <TrendingUp className="inline ml-0.5 w-3 h-3 text-primary" />;
  };

  const activeFilterCount = [activeCountry, activeExchange, activeSector, marketCapMin, marketCapMax, volumeMin, volumeMax, primaryOnly].filter(Boolean).length;

  /* ── TradingView-style column grid ─────────────────────────────────── */
  const gridTemplate = "minmax(200px,2.5fr) 100px 90px 110px 120px 100px 90px";

  const catLabel = activeCategory === "all"
    ? "All stocks"
    : CATEGORIES.find(c => c.key === activeCategory)?.label || "All";

  return (
    <div className="min-h-screen bg-background pt-2 pb-8">
      <div className="mx-auto max-w-[1440px] px-4 md:px-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <span className="text-[10px] uppercase tracking-wider">Stock Screener</span>
          <ChevronDown className="w-3 h-3" />
        </div>

        {/* Title + count */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-foreground">
            {catLabel}
            {activeCountry && (
              <span className="text-muted-foreground font-normal text-sm ml-2">
                {COUNTRY_FLAGS[activeCountry] || ""} {activeCountry}
              </span>
            )}
          </h1>
        </div>

        {/* Filter chips row — TradingView style */}
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 scrollbar-hide">
          {/* Country chip */}
          <FilterChip
            label={activeCountry ? `${COUNTRY_FLAGS[activeCountry] || ""} ${activeCountry}` : "\u{1F30D} All countries"}
            active={!!activeCountry}
            options={stats?.countries.filter(Boolean).map(c => ({ value: c, label: `${COUNTRY_FLAGS[c] || "\u{1F3F3}"} ${c}` })) || []}
            onSelect={(v) => updateParams({ country: v || undefined })}
            onClear={() => updateParams({ country: undefined })}
          />

          {/* Exchange chip */}
          <FilterChip
            label={activeExchange || "Exchange"}
            active={!!activeExchange}
            options={stats?.exchanges.map(e => ({ value: e, label: e })) || []}
            onSelect={(v) => updateParams({ exchange: v || undefined })}
            onClear={() => updateParams({ exchange: undefined })}
          />

          {/* Market cap range chip */}
          <FilterChip
            label={marketCapMin || marketCapMax ? `Mkt Cap: ${MARKET_CAP_RANGES.find(r => String(r.min ?? "") === marketCapMin)?.label || "Custom"}` : "Market cap"}
            active={!!marketCapMin || !!marketCapMax}
            options={MARKET_CAP_RANGES.map(r => ({ value: `${r.min ?? ""},${r.max ?? ""}`, label: r.label }))}
            onSelect={(v) => {
              const [min, max] = v.split(",");
              updateParams({ marketCapMin: min || undefined, marketCapMax: max || undefined });
            }}
            onClear={() => updateParams({ marketCapMin: undefined, marketCapMax: undefined })}
          />

          {/* Sector chip */}
          <FilterChip
            label={activeSector || "Sector"}
            active={!!activeSector}
            options={stats?.sectors.map(s => ({ value: s, label: s })) || []}
            onSelect={(v) => updateParams({ sector: v || undefined })}
            onClear={() => updateParams({ sector: undefined })}
          />

          {/* Volume range chip */}
          <FilterChip
            label={volumeMin || volumeMax ? `Vol: ${VOLUME_RANGES.find(r => String(r.min ?? "") === volumeMin)?.label || "Custom"}` : "Volume"}
            active={!!volumeMin || !!volumeMax}
            options={VOLUME_RANGES.map(r => ({ value: `${r.min ?? ""},${r.max ?? ""}`, label: r.label }))}
            onSelect={(v) => {
              const [min, max] = v.split(",");
              updateParams({ volumeMin: min || undefined, volumeMax: max || undefined });
            }}
            onClear={() => updateParams({ volumeMin: undefined, volumeMax: undefined })}
          />

          {/* Primary listing toggle */}
          <button
            onClick={() => updateParams({ primary: primaryOnly === "true" ? undefined : "true" })}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              primaryOnly === "true"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Star className="w-3 h-3" />
            Primary
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={() => updateParams({
                country: undefined, exchange: undefined, sector: undefined,
                marketCapMin: undefined, marketCapMax: undefined,
                volumeMin: undefined, volumeMax: undefined,
                primary: undefined,
              })}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors whitespace-nowrap"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>

        {/* Category Tabs — TradingView style */}
        <div className="flex items-center gap-0.5 border-b border-border/30 mb-0.5">
          {CATEGORIES.map((cat) => {
            const count = cat.type ? stats?.byType[cat.type] || 0 : stats?.total || 0;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => updateParams({ type: cat.key === "all" ? undefined : cat.key })}
                className={`relative px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {cat.label}
                  {count > 0 && (
                    <span className={`text-[10px] ${isActive ? "text-primary/80" : "text-muted-foreground/50"}`}>
                      {count > 999 ? `${(count / 1000).toFixed(1)}K` : count}
                    </span>
                  )}
                </span>
                {isActive && (
                  <motion.div layoutId="screener-cat-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" transition={{ duration: 0.2 }} />
                )}
              </button>
            );
          })}
        </div>

        {/* View sub-tabs — TradingView style */}
        <div className="flex items-center gap-0.5 mb-2 border-b border-border/20">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveViewTab(tab)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                activeViewTab === tab ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {total > 0 ? `${total.toLocaleString()}` : "\u2014"}
            </span>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                className="w-40 pl-7 pr-7 py-1.5 rounded-md border border-border/40 bg-secondary/20 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              />
              {localQuery && (
                <button onClick={() => { setLocalQuery(""); updateParams({ q: undefined }); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {/* Spread operator detection */}
            {localQuery && isSpreadExpression(localQuery) && (
              <button
                onClick={() => navigate(`/simulation?symbol=${encodeURIComponent(localQuery)}`)}
                className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
              >
                <BarChart3 className="w-3 h-3" /> Open spread chart
              </button>
            )}
          </div>
        </div>

        {/* Table Header — TradingView style */}
        <div className="sticky top-[var(--navbar-height,64px)] z-20 rounded-t-lg border border-border/30 bg-secondary/40 backdrop-blur-sm">
          <div
            className="grid gap-2 px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div className="flex items-center">
              <button onClick={() => handleSort("symbol")} className="flex items-center gap-0.5 hover:text-foreground">
                Ticker <SortIcon field="symbol" />
              </button>
            </div>
            <div className="text-right">
              <button onClick={() => handleSort("price" as SortField)} className="flex items-center gap-0.5 hover:text-foreground ml-auto">
                Last <SortIcon field="price" />
              </button>
            </div>
            <div className="text-right">
              <button onClick={() => handleSort("changePercent" as SortField)} className="flex items-center gap-0.5 hover:text-foreground ml-auto">
                Chg% <SortIcon field="changePercent" />
              </button>
            </div>
            <div className="text-right">
              <button onClick={() => handleSort("volume")} className="flex items-center gap-0.5 hover:text-foreground ml-auto">
                Vol <SortIcon field="volume" />
              </button>
            </div>
            <div className="text-right">
              <button onClick={() => handleSort("marketCap")} className="flex items-center gap-0.5 hover:text-foreground ml-auto">
                Mkt cap <SortIcon field="marketCap" />
              </button>
            </div>
            <div className="text-center">Sector</div>
            <div className="text-center">Country</div>
          </div>
        </div>

        {/* Table Body — Virtualized */}
        <div className="border-x border-b border-border/30 rounded-b-lg bg-background/60">
          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Loading symbols...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-24 text-center text-muted-foreground">
              <p className="text-lg mb-1">No symbols found</p>
              <p className="text-sm">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <Virtuoso
              data={items}
              style={{ height: "calc(100vh - 320px)", minHeight: "400px" }}
              endReached={loadMore}
              overscan={400}
              itemContent={(index, item) => (
                <div
                  onClick={() => navigate(`/symbol/${encodeURIComponent(item.fullSymbol)}`)}
                  className={`grid gap-2 px-4 py-2.5 items-center cursor-pointer transition-colors hover:bg-secondary/30 ${
                    index > 0 ? "border-t border-border/10" : ""
                  }`}
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {/* Ticker + Description (TradingView style) */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AssetAvatar
                      src={item.iconUrl}
                      label={item.symbol}
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-border/40 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-foreground truncate">{item.symbol}</span>
                        <span className="text-[10px] text-muted-foreground/60 font-medium">{item.exchange}</span>
                        {item.type !== "stock" && (
                          <span className={`text-[9px] px-1 py-0.5 rounded border ${typeBadge(item.type)}`}>
                            {typeLabel(item.type)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{item.name}</p>
                    </div>
                  </div>

                  {/* Last (Price) */}
                  <div className="text-right">
                    <span className="text-sm font-medium text-foreground tabular-nums">{fmtPrice(item.price)}</span>
                    {item.currency && item.currency !== "USD" && (
                      <span className="text-[10px] text-muted-foreground ml-0.5">{item.currency}</span>
                    )}
                  </div>

                  {/* Chg% */}
                  <div className="text-right">
                    {item.changePercent !== 0 ? (
                      <span className={`text-sm font-medium tabular-nums ${
                        item.changePercent > 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {item.changePercent > 0 ? "+" : ""}{item.changePercent.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground tabular-nums">{"\u2014"}</span>
                    )}
                  </div>

                  {/* Vol */}
                  <div className="text-right">
                    <span className="text-sm text-foreground tabular-nums">{fmt(item.volume)}</span>
                  </div>

                  {/* Mkt cap */}
                  <div className="text-right">
                    <span className="text-sm text-foreground tabular-nums">{fmt(item.marketCap)}</span>
                  </div>

                  {/* Sector */}
                  <div className="text-center">
                    <span className="text-[10px] text-muted-foreground truncate block">{item.sector || "\u2014"}</span>
                  </div>

                  {/* Country */}
                  <div className="text-center">
                    <span className="text-xs">
                      {item.country ? `${COUNTRY_FLAGS[item.country] || ""} ${item.country}` : "\u2014"}
                    </span>
                  </div>
                </div>
              )}
              components={{
                Footer: () => loadingMore ? (
                  <div className="flex items-center justify-center py-4 gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                    <span className="text-xs text-muted-foreground">Loading more...</span>
                  </div>
                ) : null,
              }}
            />
          )}
        </div>

        {/* Footer */}
        {!loading && items.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Showing {items.length.toLocaleString()} of {total.toLocaleString()}</span>
            {!hasMoreRef.current && <span className="text-muted-foreground/50">End of results</span>}
          </div>
        )}
      </div>
    </div>
  );
}
