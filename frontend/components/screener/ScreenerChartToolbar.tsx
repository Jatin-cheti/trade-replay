import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw, ChevronDown, LayoutGrid, Search, Calendar,
} from "lucide-react";
import type { ChartType } from "@/services/chart/dataTransforms";
import { COMING_SOON_CHART_TYPES } from "@/services/chart/dataTransforms";

export type ChartPeriod = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "All";
export type ChartLayout = { mode: "auto" } | { mode: "custom"; cols: number };

const PERIODS: ChartPeriod[] = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];
const COLUMN_OPTIONS = [1, 2, 3, 4, 5, 6];

interface ChartCatalogItem { id: ChartType; name: string }
interface ChartCatalogGroup { group: string; label: string; items: ChartCatalogItem[] }

// Aligned with main chart-type dropdown: 20 TradingView-parity types only.
// Indicators (MA/EMA/VWAP/RSI/MACD/etc) live in the indicator picker, and
// analytics/widgets (equity curve, monte carlo, treemap, heatmap, …) are
// dedicated panels — none of them are chart types.
const CHART_CATALOG: ChartCatalogGroup[] = [
  {
    group: "Core", label: "Core", items: [
      { id: "candlestick", name: "Candlestick" },
      { id: "line", name: "Line" },
      { id: "area", name: "Area" },
      { id: "baseline", name: "Baseline" },
      { id: "histogram", name: "Histogram" },
      { id: "bar", name: "Bar" },
      { id: "ohlc", name: "OHLC" },
    ],
  },
  {
    group: "Advanced", label: "Advanced", items: [
      { id: "heikinAshi", name: "Heikin Ashi" },
      { id: "hollowCandles", name: "Hollow Candles" },
      { id: "stepLine", name: "Step Line" },
      { id: "rangeArea", name: "Range Area" },
      { id: "mountainArea", name: "Mountain Area" },
    ],
  },
  {
    group: "Premium", label: "Premium", items: [
      { id: "renko", name: "Renko" },
      { id: "rangeBars", name: "Range Bars" },
      { id: "lineBreak", name: "3-Line Break" },
      { id: "kagi", name: "Kagi" },
      { id: "pointFigure", name: "Point & Figure" },
      { id: "brick", name: "Brick" },
    ],
  },
  {
    group: "Volume", label: "Volume", items: [
      { id: "volumeCandles", name: "Candles + Volume" },
      { id: "volumeLine", name: "Line + Volume" },
    ],
  },
];

const CHART_NAME_MAP: Record<string, string> = {};
for (const g of CHART_CATALOG) for (const item of g.items) CHART_NAME_MAP[item.id] = item.name;
function getChartName(t: ChartType): string { return CHART_NAME_MAP[t] ?? t; }

interface Props {
  viewMode: "table" | "chart";
  onViewModeChange: (mode: "table" | "chart") => void;
  period: ChartPeriod;
  onPeriodChange: (p: ChartPeriod) => void;
  customRange?: { from: Date; to: Date } | null;
  onCustomRange?: (range: { from: Date; to: Date } | null) => void;
  chartType: ChartType;
  onChartTypeChange: (t: ChartType) => void;
  layout: ChartLayout;
  onLayoutChange: (l: ChartLayout) => void;
  total: number;
  loading: boolean;
  onRefresh: () => void;
}

type DropPos = { top: number; left: number };
function btnPos(btn: HTMLButtonElement | null): DropPos | null {
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  return { top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 290) };
}

export default function ScreenerChartToolbar({
  viewMode: _viewMode,
  onViewModeChange: _onViewModeChange,
  period,
  onPeriodChange,
  customRange,
  onCustomRange,
  chartType,
  onChartTypeChange,
  layout,
  onLayoutChange,
  total: _total,
  loading,
  onRefresh,
}: Props) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutPos, setLayoutPos] = useState<DropPos | null>(null);
  const [hoverCols, setHoverCols] = useState<number | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [typePos, setTypePos] = useState<DropPos | null>(null);
  const [typeSearch, setTypeSearch] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePos, setDatePos] = useState<DropPos | null>(null);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");

  const layoutBtnRef = useRef<HTMLButtonElement | null>(null);
  const typeBtnRef = useRef<HTMLButtonElement | null>(null);
  const dateBtnRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  function toDateInputValue(d: Date): string { return d.toISOString().slice(0, 10); }

  function applyCustomRange() {
    if (!fromInput || !toInput) return;
    const from = new Date(fromInput);
    const to = new Date(toInput);
    to.setHours(23, 59, 59, 999);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) return;
    onCustomRange?.({ from, to });
    setDatePickerOpen(false);
  }

  useEffect(() => {
    if (typeOpen) {
      setTypeSearch("");
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [typeOpen]);

  const filteredGroups = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    if (!q) return CHART_CATALOG;
    return CHART_CATALOG
      .map((g) => ({ ...g, items: g.items.filter((item) => item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [typeSearch]);

  const currentCols = layout.mode === "custom" ? layout.cols : null;

  const closeAll = () => {
    setLayoutOpen(false); setTypeOpen(false); setDatePickerOpen(false);
    setLayoutPos(null); setTypePos(null); setDatePos(null);
    setHoverCols(null);
  };

  // Close all dropdowns on scroll or resize — but NOT when scrolling inside a dropdown panel
  useEffect(() => {
    if (!layoutOpen && !typeOpen && !datePickerOpen) return;
    const handleScroll = (e: Event) => {
      // If the scroll originated inside a dropdown panel, ignore it.
      // Use optional chaining on both target AND .closest to handle cases where
      // e.target is document/window (which don't have .closest).
      const target = e.target as Element | null;
      if (target?.closest?.('[data-dropdown-panel]')) return;
      closeAll();
    };
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('[data-dropdown-panel]')) return;
      closeAll();
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('wheel', handleWheel, true);
    window.addEventListener('resize', closeAll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('wheel', handleWheel, true);
      window.removeEventListener('resize', closeAll);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutOpen, typeOpen, datePickerOpen]);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-border/25 pb-1.5">

      {/* ── Layout picker — columns only ── */}
      <div className="relative hidden sm:block" data-testid="screener-layout-picker">
        <button
          ref={layoutBtnRef}
          type="button"
          onClick={() => {
            const p = btnPos(layoutBtnRef.current);
            setLayoutPos(p);
            setLayoutOpen((o) => !o);
            setTypeOpen(false);
            setDatePickerOpen(false);
          }}
          className="flex items-center gap-1.5 rounded-md border border-border/40 bg-secondary/20 px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary/40 transition-colors"
        >
          <LayoutGrid className="h-3 w-3 text-muted-foreground" />
          <span>{layout.mode === "auto" ? "Auto" : `${layout.cols} cols`}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {layoutOpen && layoutPos && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setLayoutOpen(false)} />
            <div data-dropdown-panel className="fixed z-[9999] w-56 rounded-xl border border-border/50 bg-background p-3 shadow-2xl"
              style={{ top: layoutPos.top, left: layoutPos.left }}>
              <button
                type="button"
                onClick={() => { onLayoutChange({ mode: "auto" }); setLayoutOpen(false); setHoverCols(null); }}
                className={`mb-3 w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                  layout.mode === "auto" ? "bg-primary/20 text-primary" : "text-foreground hover:bg-secondary/40"
                }`}
              >Auto</button>
              <p className="mb-1.5 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wide">Columns</p>
              <div className="flex gap-0.5" onMouseLeave={() => setHoverCols(null)}>
                {COLUMN_OPTIONS.map((c) => {
                  const isSelected = currentCols !== null && c <= currentCols;
                  const isHoverPreview = hoverCols !== null && c <= hoverCols;
                  return (
                    <button key={c} type="button"
                      onMouseEnter={() => setHoverCols(c)}
                      onClick={() => { onLayoutChange({ mode: "custom", cols: c }); setLayoutOpen(false); setHoverCols(null); }}
                      className={`flex-1 rounded py-2 text-[11px] font-semibold transition-all duration-100 ${
                        isHoverPreview
                          ? "bg-primary/35 text-primary"
                          : isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/25 text-muted-foreground hover:text-foreground"
                      }`}>
                      {c}
                    </button>
                  );
                })}
              </div>
              {currentCols !== null && (
                <p className="mt-2 text-center text-[9px] text-muted-foreground/50">
                  {hoverCols ?? currentCols} column{(hoverCols ?? currentCols) !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Chart type picker ── */}
      <div className="relative hidden sm:block" data-testid="screener-chart-type-picker">
        <button
          ref={typeBtnRef}
          type="button"
          onClick={() => {
            const p = btnPos(typeBtnRef.current);
            setTypePos(p);
            setTypeOpen((o) => !o);
            setLayoutOpen(false);
            setDatePickerOpen(false);
          }}
          className="flex items-center gap-1.5 rounded-md border border-border/40 bg-secondary/20 px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary/40 transition-colors"
        >
          <span>{getChartName(chartType)}</span>
          {COMING_SOON_CHART_TYPES.has(chartType) && (
            <span className="ml-0.5 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold text-amber-400">SOON</span>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {typeOpen && typePos && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setTypeOpen(false)} />
            <div data-dropdown-panel className="fixed z-[9999] w-64 rounded-xl border border-border/50 bg-background shadow-2xl flex flex-col"
              style={{ top: typePos.top, left: typePos.left, maxHeight: "420px" }}>
              <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2 shrink-0">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input ref={searchInputRef} type="text" placeholder="Search chart types…"
                  value={typeSearch} onChange={(e) => setTypeSearch(e.target.value)}
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60" />
              </div>
              <div className="overflow-y-auto py-1">
                {filteredGroups.length === 0 && <p className="px-4 py-3 text-xs text-muted-foreground/60">No chart types found</p>}
                {filteredGroups.map((g) => (
                  <div key={g.group}>
                    <p className="px-3 pt-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {g.group} — {g.label}
                    </p>
                    {g.items.map((item) => {
                      const isSoon = COMING_SOON_CHART_TYPES.has(item.id);
                      return (
                        <button key={item.id} type="button" aria-selected={chartType === item.id}
                          onClick={() => { onChartTypeChange(item.id); setTypeOpen(false); }}
                          className={`flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-secondary/40 ${
                            chartType === item.id ? "font-semibold text-primary" : "text-foreground/85"
                          }`}>
                          <span>{item.name}</span>
                          {isSoon && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold text-amber-400">SOON</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Period row: Custom first, then preset pills ── */}
      <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">

        {/* Custom date range — BEFORE preset pills */}
        <div className="relative mr-0.5">
          <button
            ref={dateBtnRef}
            type="button"
            aria-label="Custom date range"
            onClick={() => {
              const p = btnPos(dateBtnRef.current);
              setDatePos(p);
              setDatePickerOpen((o) => !o);
              setLayoutOpen(false);
              setTypeOpen(false);
              if (!fromInput && customRange) setFromInput(toDateInputValue(customRange.from));
              if (!toInput && customRange) setToInput(toDateInputValue(customRange.to));
            }}
            className={`flex items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors border ${
              customRange
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/30"
            }`}
          >
            <Calendar className="h-3 w-3" />
            {customRange
              ? `${customRange.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${customRange.to.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : "Custom"}
          </button>

          {datePickerOpen && datePos && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setDatePickerOpen(false)} />
              <div data-dropdown-panel className="fixed z-[9999] w-64 rounded-xl border border-border/50 bg-background p-3 shadow-2xl"
                style={{ top: datePos.top, left: Math.min(datePos.left, window.innerWidth - 270) }}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Date Range</p>
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground">From</span>
                    <input type="date" value={fromInput} max={toInput || undefined}
                      onChange={(e) => setFromInput(e.target.value)}
                      className="rounded border border-border/40 bg-secondary/20 px-2 py-1 text-xs text-foreground focus:border-primary/60 focus:outline-none" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground">To</span>
                    <input type="date" value={toInput} min={fromInput || undefined}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setToInput(e.target.value)}
                      className="rounded border border-border/40 bg-secondary/20 px-2 py-1 text-xs text-foreground focus:border-primary/60 focus:outline-none" />
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={applyCustomRange} disabled={!fromInput || !toInput}
                      className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors">
                      Apply
                    </button>
                    {customRange && (
                      <button type="button"
                        onClick={() => { onCustomRange?.(null); setDatePickerOpen(false); setFromInput(""); setToInput(""); }}
                        className="rounded-md border border-border/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Preset period pills */}
        {PERIODS.map((p) => (
          <button key={p} type="button"
            data-testid={`screener-period-${p}`}
            aria-pressed={!customRange && period === p}
            aria-label={`${p} period`}
            onClick={() => { onPeriodChange(p); onCustomRange?.(null); setDatePickerOpen(false); }}
            className={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors ${
              !customRange && period === p
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            {p}
          </button>
        ))}
      </div>

      {/* ── Refresh only (no total count shown) ── */}
      <div className="ml-auto flex items-center">
        <button type="button" data-testid="screener-chart-refresh" onClick={onRefresh}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
          title="Refresh data">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
