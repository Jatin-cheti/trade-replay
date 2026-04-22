import { useState } from "react";
import {
  RefreshCw, ChevronDown, LayoutGrid,
} from "lucide-react";
import type { ChartType } from "@/services/chart/dataTransforms";
import { chartTypeLabels } from "@/services/chart/dataTransforms";

export type ChartPeriod = "1D" | "5D" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "All";
export type ChartLayout = { mode: "auto" } | { mode: "custom"; cols: number };

const PERIODS: ChartPeriod[] = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];

// Subset of chart types to expose in the screener chart toolbar
const SCREENER_CHART_TYPES: ChartType[] = ["area", "line", "candlestick", "bar", "heikinAshi"];

interface Props {
  viewMode: "table" | "chart";
  onViewModeChange: (mode: "table" | "chart") => void;
  period: ChartPeriod;
  onPeriodChange: (p: ChartPeriod) => void;
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

  // Custom grid picker state
  const [hoverGrid, setHoverGrid] = useState<[number, number] | null>(null);
  const currentCustom = layout.mode === "custom" ? [layout.cols, 4] : null;

  const GRID_ROWS = 4;
  const GRID_COLS = 6;

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

      {/* ── Chart type picker ── */}
      <div className="relative hidden sm:block" data-testid="screener-chart-type-picker">
        <button
          type="button"
          onClick={() => { setTypeOpen((o) => !o); setLayoutOpen(false); }}
          className="flex items-center gap-1.5 rounded-md border border-border/40 bg-secondary/20 px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary/40 transition-colors"
        >
          <span>{chartTypeLabels[chartType] ?? "Area"}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {typeOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-36 rounded-xl border border-border/50 bg-background py-1.5 shadow-xl">
            {SCREENER_CHART_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-selected={chartType === t}
                onClick={() => { onChartTypeChange(t); setTypeOpen(false); }}
                className={`flex w-full items-center px-3 py-2 text-xs transition-colors hover:bg-secondary/40 ${
                  chartType === t ? "font-semibold text-primary" : "text-foreground/85"
                }`}
              >
                {chartTypeLabels[t]}
              </button>
            ))}
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
            aria-pressed={period === p}
            aria-label={`${p} period`}
            onClick={() => onPeriodChange(p)}
            className={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
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
