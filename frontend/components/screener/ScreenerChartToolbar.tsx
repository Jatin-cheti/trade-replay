import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw, ChevronDown, LayoutGrid, Search, Calendar,
} from "lucide-react";
import type { ChartType } from "@/services/chart/dataTransforms";
import { COMING_SOON_CHART_TYPES } from "@/services/chart/dataTransforms";

export type ChartPeriod = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "All";
export type ChartLayout = { mode: "auto" } | { mode: "custom"; cols: number };

const PERIODS: ChartPeriod[] = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];

/** Full catalog matching the user's JSON schema */
interface ChartCatalogItem { id: ChartType; name: string }
interface ChartCatalogGroup { group: string; label: string; items: ChartCatalogItem[] }

const CHART_CATALOG: ChartCatalogGroup[] = [
  {
    group: "Standard", label: "Time-Series", items: [
      { id: "line", name: "Line Chart" },
      { id: "candlestick", name: "Japanese Candlestick" },
      { id: "bar", name: "Bar Chart (OHLC)" },
      { id: "hlcBar", name: "HLC Bar" },
      { id: "area", name: "Area Chart" },
      { id: "baseline", name: "Baseline Chart" },
      { id: "heikinAshi", name: "Heikin-Ashi" },
      { id: "hollowCandles", name: "Hollow Candles" },
      { id: "ohlc", name: "Colored Bar" },
      { id: "stepLine", name: "Step Line" },
      { id: "mountainArea", name: "Mountain Chart" },
      { id: "dotChart", name: "Dot Chart" },
      { id: "rangeArea", name: "High-Low Chart" },
      { id: "openClose", name: "Open-Close Chart" },
      { id: "avgPriceBar", name: "Average Price Bar" },
    ],
  },
  {
    group: "Price Action", label: "Non-Time Based", items: [
      { id: "renko", name: "Renko" },
      { id: "pointFigure", name: "Point & Figure" },
      { id: "kagi", name: "Kagi" },
      { id: "lineBreak", name: "3-Line Break" },
      { id: "rangeBars", name: "Range Bars" },
      { id: "brick", name: "Brick Chart" },
    ],
  },
  {
    group: "Volume", label: "Volume & Order Flow", items: [
      { id: "volumeCandles", name: "Candles + Volume" },
      { id: "volumeLine", name: "Line + Volume" },
      { id: "histogram", name: "Volume Histogram" },
    ],
  },
  {
    group: "Indicators", label: "Indicators & Overlays", items: [
      { id: "maLine", name: "MA Line (20)" },
      { id: "emaLine", name: "EMA Line (20)" },
      { id: "vwapLine", name: "VWAP" },
      { id: "priceChange", name: "Price Change" },
      { id: "rsiLine", name: "RSI Line" },
      { id: "macdHistogram", name: "MACD Histogram" },
      { id: "volumeOscillator", name: "Volume Oscillator" },
      { id: "zScoreLine", name: "Z-Score Line" },
    ],
  },
  {
    group: "Analysis", label: "Statistical & Quantitative", items: [
      { id: "equityCurve", name: "Equity Curve" },
      { id: "drawdownChart", name: "Drawdown Chart" },
      { id: "returnsHistogram", name: "Returns Histogram" },
      { id: "scatterPlot", name: "Scatter Plot" },
      { id: "bubblePlot", name: "Bubble Plot" },
      { id: "boxPlot", name: "Box Plot" },
      { id: "heatMap", name: "Heat Map" },
      { id: "regressionChannel", name: "Regression Channel" },
      { id: "seasonality", name: "Seasonality" },
      { id: "monteCarlo", name: "Monte Carlo" },
    ],
  },
  {
    group: "Advanced", label: "Advanced Analytics", items: [
      { id: "radarChart", name: "Radar Chart" },
      { id: "treemap", name: "Treemap" },
      { id: "waterfallChart", name: "Waterfall Chart" },
      { id: "sunburst", name: "Sunburst Chart" },
      { id: "fanChart", name: "Fan Chart" },
      { id: "paretoChart", name: "Pareto Chart" },
      { id: "funnelChart", name: "Funnel Chart" },
      { id: "networkGraph", name: "Network Graph" },
    ],
  },
  {
    group: "Layouts", label: "Economic & Layouts", items: [
      { id: "yieldCurve", name: "Yield Curve" },
      { id: "volatilitySurface", name: "Volatility Surface" },
      { id: "correlationMatrix", name: "Correlation Matrix" },
      { id: "optionsPayoff", name: "Options Payoff" },
      { id: "donutChart", name: "Donut Chart" },
      { id: "stackedArea", name: "Stacked Area" },
    ],
  },
];

/** Flat map: id → name for quick lookup */
const CHART_NAME_MAP: Record<string, string> = {};
for (const g of CHART_CATALOG) for (const item of g.items) CHART_NAME_MAP[item.id] = item.name;

function getChartName(t: ChartType): string {
  return CHART_NAME_MAP[t] ?? t;
}

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

export default function ScreenerChartToolbar({
  viewMode,
  onViewModeChange,
  period,
  onPeriodChange,
  customRange,
  onCustomRange,
  chartType,
  onChartTypeChange,
  layout,
  onLayoutChange,
  total,
  loading,
  onRefresh,
}: Props) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeSearch, setTypeSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");

  // Custom grid picker state
  const [hoverGrid, setHoverGrid] = useState<[number, number] | null>(null);
  const currentCustom = layout.mode === "custom" ? [layout.cols, 4] : null;

  const GRID_ROWS = 4;
  const GRID_COLS = 6;

  // Format date for input[type=date] value
  function toDateInputValue(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  function applyCustomRange() {
    if (!fromInput || !toInput) return;
    const from = new Date(fromInput);
    const to = new Date(toInput);
    to.setHours(23, 59, 59, 999);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) return;
    onCustomRange?.({ from, to });
    setDatePickerOpen(false);
  }

  // Focus search input when dropdown opens
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
      .map((g) => ({
        ...g,
        items: g.items.filter((item) =>
          item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [typeSearch]);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-border/25 pb-1.5">
      {/* ── Layout picker ── */}
      <div className="relative hidden sm:block" data-testid="screener-layout-picker">
        <button
          type="button"
          onClick={() => { setLayoutOpen((o) => !o); setTypeOpen(false); }}
          className="flex items-center gap-1.5 rounded-md border border-border/40 bg-secondary/20 px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary/40 transition-colors"
        >
          <LayoutGrid className="h-3 w-3 text-muted-foreground" />
          <span>{layout.mode === "auto" ? "Auto" : `${layout.cols}×`}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {layoutOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-border/50 bg-background p-3 shadow-xl">
            {/* Auto option */}
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="layout"
                checked={layout.mode === "auto"}
                onChange={() => { onLayoutChange({ mode: "auto" }); setLayoutOpen(false); }}
                className="accent-primary"
              />
              <span className="font-medium">Auto</span>
            </label>

            {/* Custom option */}
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="layout"
                checked={layout.mode === "custom"}
                onChange={() => {}}
                className="accent-primary"
              />
              <span className="font-medium">Custom</span>
              {currentCustom && (
                <span className="text-xs text-muted-foreground">
                  {currentCustom[0]}×{currentCustom[1]}
                </span>
              )}
            </label>

            {/* Grid picker */}
            <p className="mb-1.5 text-[10px] text-muted-foreground">Choose grid</p>
            <div className="grid grid-cols-6 gap-0.5">
              {Array.from({ length: GRID_ROWS }, (_, row) =>
                Array.from({ length: GRID_COLS }, (_, col) => {
                  const c = col + 1;
                  const r = row + 1;
                  const isHovered =
                    hoverGrid
                      ? c <= hoverGrid[0] && r <= hoverGrid[1]
                      : false;
                  const isSelected = currentCustom
                    ? c <= currentCustom[0] && r <= currentCustom[1]
                    : false;
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`h-5 w-5 cursor-pointer rounded-sm border transition-colors ${
                        isHovered
                          ? "border-primary bg-primary/30"
                          : isSelected
                          ? "border-primary/60 bg-primary/15"
                          : "border-border/40 bg-secondary/30 hover:border-primary/40"
                      }`}
                      onMouseEnter={() => setHoverGrid([c, r])}
                      onMouseLeave={() => setHoverGrid(null)}
                      onClick={() => {
                        onLayoutChange({ mode: "custom", cols: c });
                        setLayoutOpen(false);
                      }}
                    />
                  );
                })
              )}
            </div>
            {hoverGrid && (
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                {hoverGrid[0]}×{hoverGrid[1]}
              </p>
            )}
          </div>
        )}
        {layoutOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setLayoutOpen(false)}
          />
        )}
      </div>

      {/* ── Chart type picker with search ── */}
      <div className="relative hidden sm:block" data-testid="screener-chart-type-picker">
        <button
          type="button"
          onClick={() => { setTypeOpen((o) => !o); setLayoutOpen(false); }}
          className="flex items-center gap-1.5 rounded-md border border-border/40 bg-secondary/20 px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary/40 transition-colors"
        >
          <span>{getChartName(chartType)}</span>
          {COMING_SOON_CHART_TYPES.has(chartType) && (
            <span className="ml-0.5 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold text-amber-400">SOON</span>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {typeOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-border/50 bg-background shadow-xl flex flex-col" style={{ maxHeight: "420px" }}>
            {/* Search box */}
            <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2 shrink-0">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search chart types…"
                value={typeSearch}
                onChange={(e) => setTypeSearch(e.target.value)}
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Type list */}
            <div className="overflow-y-auto py-1">
              {filteredGroups.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground/60">No chart types found</p>
              )}
              {filteredGroups.map((g) => (
                <div key={g.group}>
                  <p className="px-3 pt-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {g.group} — {g.label}
                  </p>
                  {g.items.map((item) => {
                    const isSoon = COMING_SOON_CHART_TYPES.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-selected={chartType === item.id}
                        onClick={() => { onChartTypeChange(item.id); setTypeOpen(false); }}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-xs transition-colors hover:bg-secondary/40 ${
                          chartType === item.id ? "font-semibold text-primary" : "text-foreground/85"
                        }`}
                      >
                        <span>{item.name}</span>
                        {isSoon && (
                          <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold text-amber-400">SOON</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
        {typeOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setTypeOpen(false)} />
        )}
      </div>

      {/* ── Time period pills ── */}
      <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            data-testid={`screener-period-${p}`}
            aria-pressed={!customRange && period === p}
            aria-label={`${p} period`}
            onClick={() => { onPeriodChange(p); onCustomRange?.(null); setDatePickerOpen(false); }}
            className={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors ${
              !customRange && period === p
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p}
          </button>
        ))}

        {/* Custom date range picker */}
        <div className="relative ml-1">
          <button
            type="button"
            aria-label="Custom date range"
            onClick={() => { setDatePickerOpen((o) => !o); if (!fromInput && customRange) setFromInput(toDateInputValue(customRange.from)); if (!toInput && customRange) setToInput(toDateInputValue(customRange.to)); }}
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

          {datePickerOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-border/50 bg-background p-3 shadow-xl">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Date Range</p>
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground">From</span>
                  <input
                    type="date"
                    value={fromInput}
                    max={toInput || undefined}
                    onChange={(e) => setFromInput(e.target.value)}
                    className="rounded border border-border/40 bg-secondary/20 px-2 py-1 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground">To</span>
                  <input
                    type="date"
                    value={toInput}
                    min={fromInput || undefined}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setToInput(e.target.value)}
                    className="rounded border border-border/40 bg-secondary/20 px-2 py-1 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                  />
                </label>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={applyCustomRange}
                    disabled={!fromInput || !toInput}
                    className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
                  >
                    Apply
                  </button>
                  {customRange && (
                    <button
                      type="button"
                      onClick={() => { onCustomRange?.(null); setDatePickerOpen(false); setFromInput(""); setToInput(""); }}
                      className="rounded-md border border-border/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {datePickerOpen && (
            <div className="fixed inset-0 z-40" onClick={() => setDatePickerOpen(false)} />
          )}
        </div>
      </div>

      {/* ── Right side: total + refresh ── */}
      <div className="ml-auto flex items-center gap-2">
        <span
          data-testid="screener-chart-total-count"
          className="text-xs text-muted-foreground"
        >
          {total.toLocaleString()} total
        </span>
        <button
          type="button"
          data-testid="screener-chart-refresh"
          onClick={onRefresh}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
          title="Refresh data"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}


export type ChartPeriod = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "All";
export type ChartLayout = { mode: "auto" } | { mode: "custom"; cols: number };
