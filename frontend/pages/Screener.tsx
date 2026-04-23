import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, getDetectedCountry } from "@/lib/api";
import { useResponsive } from "@/hooks/useResponsive";
import { useScreenerData } from "@/hooks/useScreenerData";
import { useScreenerFilters } from "@/hooks/useScreenerFilters";
import { useScreenerScreens } from "@/hooks/useScreenerScreens";
import type { ScreenerColumnField, ScreenerMetaResponse, ScreenerStatsResponse, ScreenerTabDefinition } from "@/lib/screener";
import { DEFAULT_VISIBLE_COLUMNS, FALLBACK_SCREENER_TYPES, SCREENER_TYPE_ICONS, dedupe, normalizeRouteType, parseCsv, getMultiParamName, getDateParamNames } from "@/lib/screener";
import { COMPLETE_SCREENER_META_FALLBACK } from "@/lib/screener/fallback";
import CountryFlagImg from "@/components/screener/CountryFlagImg";
import ScreenerToolbar from "@/components/screener/ScreenerToolbar";
import ScreenerFilterBar from "@/components/screener/ScreenerFilterBar";
import ScreenerTabBar from "@/components/screener/ScreenerTabBar";
import ScreenerTable from "@/components/screener/ScreenerTable";
import ScreenerMobileList from "@/components/screener/ScreenerMobileList";
import ScreenerChartToolbar from "@/components/screener/ScreenerChartToolbar";
import ScreenerChartGrid from "@/components/screener/ScreenerChartGrid";
import type { ChartPeriod, ChartLayout } from "@/components/screener/ScreenerChartToolbar";
import type { ChartType } from "@/services/chart/dataTransforms";
import "@/styles/screener.css";

export default function Screener() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMobile } = useResponsive();

  const [meta, setMeta] = useState<ScreenerMetaResponse | null>(null);
  const [stats, setStats] = useState<ScreenerStatsResponse | null>(null);
  const [queryInput, setQueryInput] = useState(searchParams.get("q") || "");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [addColumnSearch, setAddColumnSearch] = useState("");
  const typeMenuRef = useRef<HTMLDivElement | null>(null);
  const addColumnRef = useRef<HTMLDivElement | null>(null);

  /* ── Chart view state (URL-persisted) ── */
  const viewMode = (searchParams.get("view") === "chart" ? "chart" : "table") as "table" | "chart";
  const chartPeriod = (searchParams.get("period") || "5D") as ChartPeriod;
  const chartType = (searchParams.get("chartType") || "area") as ChartType;
  const chartLayout: ChartLayout = (() => {
    const l = searchParams.get("layout");
    if (!l || l === "auto") return { mode: "auto" };
    const cols = parseInt(l, 10);
    return Number.isFinite(cols) && cols > 0 ? { mode: "custom", cols } : { mode: "auto" };
  })();

  /* ── Route ── */
  const availableRouteTypes = useMemo(
    () => (meta?.screenerTypes.length ? meta.screenerTypes : FALLBACK_SCREENER_TYPES).map((e) => e.routeType), [meta]);
  const routeType = useMemo(() => normalizeRouteType(type, availableRouteTypes), [availableRouteTypes, type]);

  useEffect(() => {
    if (!type) { navigate("/screener/stocks", { replace: true }); return; }
    if (routeType !== type) navigate(`/screener/${routeType}${location.search}`, { replace: true });
  }, [location.search, navigate, routeType, type]);

  /* ── Meta ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Fetch meta and stats independently so one failure doesn't block the other
      const [metaResult, statsResult] = await Promise.allSettled([
        api.get<ScreenerMetaResponse>("/screener/meta"),
        api.get<ScreenerStatsResponse>("/screener/stats"),
      ]);
      if (cancelled) return;
      if (metaResult.status === "fulfilled") {
        setMeta(metaResult.value.data);
      } else {
        console.warn("Failed to load screener meta, using fallback:", metaResult.reason);
        setMeta(COMPLETE_SCREENER_META_FALLBACK);
      }
      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value.data);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Columns ── */
  const tabLookup = useMemo(() => { const m = new Map<string, ScreenerTabDefinition>(); (meta?.tabs || []).forEach((t) => m.set(t.key, t)); return m; }, [meta]);
  const activeTab = searchParams.get("tab") || "overview";
  const tabDefaultColumns = (tabLookup.get(activeTab) || meta?.tabs[0])?.defaultColumns || DEFAULT_VISIBLE_COLUMNS;
  const selectedColumnsFromQuery = useMemo(() => parseCsv(searchParams.get("columns") || ""), [searchParams]);
  const selectedColumns = useMemo(() => { const d = dedupe(selectedColumnsFromQuery.length > 0 ? selectedColumnsFromQuery : tabDefaultColumns); if (!d.includes("symbol")) d.unshift("symbol"); return d; }, [selectedColumnsFromQuery, tabDefaultColumns]);
  const columnLookup = useMemo(() => { const m = new Map<string, ScreenerColumnField>(); (meta?.columnFields || []).forEach((c) => m.set(c.key, c)); return m; }, [meta]);
  const visibleColumns = useMemo(() => { const a = selectedColumns.filter((c) => columnLookup.has(c)); if (a.length === 0) return DEFAULT_VISIBLE_COLUMNS; if (!a.includes("symbol")) return ["symbol", ...a]; return a; }, [columnLookup, selectedColumns]);
  const availableAddColumnFields = useMemo(() => { const n = addColumnSearch.toLowerCase(); return (meta?.columnFields || []).filter((c) => !n || c.label.toLowerCase().includes(n) || c.category.toLowerCase().includes(n)); }, [addColumnSearch, meta]);

  const updateSearch = useCallback((apply: (n: URLSearchParams) => void) => { setSearchParams((p) => { const n = new URLSearchParams(p); apply(n); if (!n.get("tab")) n.set("tab", "overview"); return n; }, { replace: true }); }, [setSearchParams]);
  const updateSelectedColumns = useCallback((next: string[]) => { const d = dedupe(next); if (!d.includes("symbol")) d.unshift("symbol"); updateSearch((n) => n.set("columns", d.join(","))); }, [updateSearch]);

  /* ── Chart view setters (URL-persisted) ── */
  const setViewMode = useCallback((mode: "table" | "chart") => {
    setSearchParams((p) => { const n = new URLSearchParams(p); if (mode === "chart") n.set("view", "chart"); else n.delete("view"); return n; }, { replace: true });
  }, [setSearchParams]);
  const setChartPeriod = useCallback((p: ChartPeriod) => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set("period", p); return n; }, { replace: true });
  }, [setSearchParams]);
  const setChartType = useCallback((t: ChartType) => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set("chartType", t); return n; }, { replace: true });
  }, [setSearchParams]);
  const setChartLayout = useCallback((l: ChartLayout) => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); if (l.mode === "auto") n.delete("layout"); else n.set("layout", String(l.cols)); return n; }, { replace: true });
  }, [setSearchParams]);

  // Custom date range (not URL-persisted, session-only)
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);

  /* ── Hooks ── */
  const data = useScreenerData(routeType, selectedColumns, viewMode === "chart");
  const filters = useScreenerFilters(meta, data.parsedFilters);
  const screens = useScreenerScreens(routeType);

  /* ── Query debounce ── */
  useEffect(() => { setQueryInput(searchParams.get("q") || ""); }, [searchParams]);
  useEffect(() => { const t = window.setTimeout(() => { if (queryInput !== (searchParams.get("q") || "")) updateSearch((n) => { if (!queryInput) n.delete("q"); else n.set("q", queryInput); }); }, 250); return () => window.clearTimeout(t); }, [queryInput, searchParams, updateSearch]);

  /* ── Click outside ── */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (typeMenuOpen && typeMenuRef.current && !typeMenuRef.current.contains(t)) setTypeMenuOpen(false);
      if (filters.addFilterOpen && filters.addFilterRef.current && !filters.addFilterRef.current.contains(t)) filters.setAddFilterOpen(false);
      if (addColumnOpen && addColumnRef.current && !addColumnRef.current.contains(t)) setAddColumnOpen(false);
      if (filters.editingFilterKey) { const r = filters.filterChipRefs.current[filters.editingFilterKey]; if (r && !r.contains(t)) filters.setEditingFilterKey(null); }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [addColumnOpen, filters, typeMenuOpen]);

  useEffect(() => { setTypeMenuOpen(false); filters.setAddFilterOpen(false); setAddColumnOpen(false); filters.setEditingFilterKey(null); }, [location.pathname, location.search]);

  /* ── Callbacks ── */
  const currentType = useMemo(() => (meta?.screenerTypes || FALLBACK_SCREENER_TYPES).find((e) => e.routeType === routeType) || (meta?.screenerTypes || FALLBACK_SCREENER_TYPES)[0], [meta, routeType]);
  const setSort = useCallback((field: string) => { updateSearch((n) => { if ((n.get("sort") || "marketCap") === field) n.set("order", (n.get("order") || "desc") === "desc" ? "asc" : "desc"); else { n.set("sort", field); n.set("order", "desc"); } }); }, [updateSearch]);
  const onTypeSelect = useCallback((nextType: string) => { setTypeMenuOpen(false); navigate(`/screener/${nextType}${location.search}`); }, [location.search, navigate]);
  const onTabSelect = useCallback((tab: ScreenerTabDefinition) => {
    updateSearch((n) => { n.set("tab", tab.key); n.set("columns", tab.defaultColumns.join(",")); });
    // In chart mode, auto-switch to the most meaningful chart type for the selected tab
    if (viewMode === "chart") {
      const TAB_CHART: Partial<Record<string, ChartType>> = {
        overview:           "area",
        performance:        "equityCurve",
        valuation:          "returnsHistogram",
        profitability:      "drawdownChart",
        dividends:          "priceChange",
        technicals:         "candlestick",
        "income-statement": "priceChange",
        "balance-sheet":    "regressionChannel",
      };
      const mapped = TAB_CHART[tab.key];
      if (mapped) setChartType(mapped);
    }
  }, [updateSearch, setChartType, viewMode]);

  const downloadCSV = useCallback(() => {
    const headers = visibleColumns.join(",");
    const rows = data.items.map((item) =>
      visibleColumns.map((col) => {
        const val = item[col as keyof typeof item];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `screener-${routeType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [visibleColumns, data.items, routeType]);

  const loadScreenState = useCallback((screen: any) => {
    screens.setActiveScreenId(screen._id); screens.setScreenDirty(false);
    const p = new URLSearchParams();
    p.set("tab", screen.tab || "overview");
    if (screen.columns?.length) p.set("columns", screen.columns.join(","));
    if (screen.sort) p.set("sort", screen.sort);
    if (screen.order) p.set("order", screen.order);
    if (screen.query) p.set("q", screen.query);
    const f = screen.filters || {};
    for (const [key, val] of Object.entries(f)) {
      if (Array.isArray(val) && val.length > 0) p.set(getMultiParamName(key), (val as string[]).join(","));
      else if (typeof val === "boolean" && val && key === "primaryListingOnly") p.set("primaryListing", "true");
      else if (val && typeof val === "object") { const o = val as Record<string, unknown>; if ("min" in o && o.min !== undefined) p.set(`${key}Min`, String(o.min)); if ("max" in o && o.max !== undefined) p.set(`${key}Max`, String(o.max)); if ("from" in o && o.from) { const nm = getDateParamNames(key); p.set(nm.from, String(o.from)); } if ("to" in o && o.to) { const nm = getDateParamNames(key); p.set(nm.to, String(o.to)); } }
    }
    if (screen.screenerType !== routeType) navigate(`/screener/${screen.screenerType}?${p.toString()}`); else setSearchParams(p, { replace: true });
  }, [navigate, routeType, setSearchParams, screens]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-8 pt-3">
      <div className="px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10">
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>Screener</span><span className="text-muted-foreground/35">/</span>
          {(() => { const Icon = SCREENER_TYPE_ICONS[currentType?.routeType || "stocks"]; return Icon ? <Icon className="h-3.5 w-3.5" /> : null; })()}
          <span>{currentType?.label || "Stock Screener"}</span>
        </div>
        <ScreenerToolbar meta={meta} routeType={routeType} currentType={currentType} typeMenuOpen={typeMenuOpen} setTypeMenuOpen={setTypeMenuOpen} typeMenuRef={typeMenuRef} onTypeSelect={onTypeSelect} activeScreenName={screens.activeScreenName} activeScreenId={screens.activeScreenId} screenDirty={screens.screenDirty} isAuthenticated={screens.isAuthenticated} savedScreens={screens.savedScreens} saveScreen={screens.saveScreen} deleteScreenById={screens.deleteScreenById} copyScreenById={screens.copyScreenById} renameScreenById={screens.renameScreenById} loadScreenState={loadScreenState} onDownloadCSV={downloadCSV} queryInput={queryInput} setQueryInput={setQueryInput} onSpreadChart={(sym) => navigate(`/simulation?symbol=${encodeURIComponent(sym)}`)} />
        <ScreenerFilterBar meta={meta} parsedFilters={data.parsedFilters} filterFields={filters.filterFields} visibleFilterKeys={filters.visibleFilterKeys} filterCount={filters.filterCount} editingFilterKey={filters.editingFilterKey} setEditingFilterKey={filters.setEditingFilterKey} addFilterOpen={filters.addFilterOpen} setAddFilterOpen={filters.setAddFilterOpen} addFilterSearch={filters.addFilterSearch} setAddFilterSearch={filters.setAddFilterSearch} filterChipRefs={filters.filterChipRefs} addFilterRef={filters.addFilterRef} manualFilterKeys={filters.manualFilterKeys} setManualFilterKeys={filters.setManualFilterKeys} setMultiFilter={filters.setMultiFilter} setRangeFilter={filters.setRangeFilter} setDateFilter={filters.setDateFilter} setToggleFilter={filters.setToggleFilter} clearAllFilters={filters.clearAllFilters} />
        {/* ── Region info bar with quick country toggles ── */}
        {(() => {
          const countryTypes = new Set(["stocks", "etfs", "bonds"]);
          if (!countryTypes.has(routeType)) return null;
          const activeCountries = (data.parsedFilters.marketCountries as string[] | undefined) || [];
          const userCountry = getDetectedCountry();
          const countryLabel = activeCountries.length === 1 ? activeCountries[0] : activeCountries.length > 1 ? `${activeCountries.length} countries` : "Global";
          const QUICK_COUNTRIES = [
            ...(userCountry && userCountry !== "US" && userCountry !== "IN" ? [{ code: userCountry, label: userCountry }] : []),
            { code: "US", label: "US" },
            { code: "IN", label: "India" },
            { code: "", label: "Global" },
          ];
          return (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border/30 bg-secondary/15 px-3 py-1.5">
              {QUICK_COUNTRIES.map((c) => {
                const isActive = c.code === "" ? activeCountries.length === 0 : activeCountries.includes(c.code);
                return (
                  <button
                    key={c.code || "global"}
                    type="button"
                    data-testid={`screener-country-${c.code || "global"}`}
                    onClick={() => {
                      // Synchronously clear the count BEFORE the URL navigation so
                      // Playwright's poll (and users) see a blank count immediately.
                      flushSync(() => { data.resetForFilterChange(); });
                      if (c.code === "") {
                        filters.setMultiFilter("marketCountries", []);
                        return;
                      }
                      const current = (data.parsedFilters.marketCountries as string[] | undefined) || [];
                      if (current.includes(c.code)) {
                        filters.setMultiFilter("marketCountries", current.filter(x => x !== c.code));
                      } else {
                        filters.setMultiFilter("marketCountries", [...current, c.code]);
                      }
                    }}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    <CountryFlagImg code={c.code || "WORLD"} size={13} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          );
        })()}
        <ScreenerTabBar tabs={meta?.tabs || []} activeTab={activeTab} loading={data.loading} onTabSelect={onTabSelect} onRefresh={data.refreshList} viewMode={viewMode} onViewModeChange={setViewMode} />
        {data.total > 0 && (
          <span
            data-testid="screener-result-count"
            style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
            aria-hidden="true"
          >
            {data.total.toLocaleString()}
          </span>
        )}
      </div>{/* end padded section */}

      {/* ── Chart toolbar — shown only in chart mode ── */}
      {viewMode === "chart" && (
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10">
          <ScreenerChartToolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            period={chartPeriod}
            onPeriodChange={setChartPeriod}
            customRange={customRange}
            onCustomRange={setCustomRange}
            chartType={chartType}
            onChartTypeChange={setChartType}
            layout={chartLayout}
            onLayoutChange={setChartLayout}
            total={data.total}
            loading={data.loading}
            onRefresh={data.refreshList}
          />
        </div>
      )}

      <div className="w-full min-w-0">{/* full-width section */}
        {data.loading && data.items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />Loading screener…</div>
        ) : viewMode === "chart" ? (
          <ScreenerChartGrid
            items={data.items}
            layout={chartLayout}
            chartType={chartType}
            period={chartPeriod}
            customRange={customRange}
            onLoadMore={data.loadMore}
            hasMore={data.items.length < data.total}
            loadingMore={data.loadingMore}
          />
        ) : isMobile ? (
          <ScreenerMobileList items={data.items} loadingMore={data.loadingMore} onLoadMore={data.loadMore} onNavigate={(sym) => navigate(`/symbol/${encodeURIComponent(sym)}`)} />
        ) : (
          <ScreenerTable items={data.items} flashBySymbol={data.flashBySymbol} visibleColumns={visibleColumns} columnLookup={columnLookup} sortField={data.sortField} sortOrder={data.sortOrder} loadingMore={data.loadingMore} onSort={setSort} onLoadMore={data.loadMore} addColumnOpen={addColumnOpen} setAddColumnOpen={setAddColumnOpen} addColumnSearch={addColumnSearch} setAddColumnSearch={setAddColumnSearch} availableAddColumnFields={availableAddColumnFields} updateSelectedColumns={updateSelectedColumns} addColumnRef={addColumnRef} />
        )}
        {!data.loading && data.items.length === 0 && (
          <div data-testid="screener-no-results" className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="text-3xl" aria-hidden>🔍</div>
            <p className="text-sm font-medium text-foreground">No results found</p>
            <p className="max-w-xs text-xs text-muted-foreground">Try adjusting your filters or switching to a different market.</p>
            <button
              type="button"
              onClick={() => navigate(`/screener/${routeType}`)}
              className="mt-1 rounded-lg bg-secondary/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/60"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
