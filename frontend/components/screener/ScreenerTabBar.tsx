import { motion } from "framer-motion";
import {
  RefreshCw,
  LayoutGrid, LineChart, PieChart, Coins, BarChart3, FileText,
  Scale, Droplets, Share2, Activity,
  LayoutList, BarChart2,
} from "lucide-react";
import type { ScreenerTabDefinition } from "@/lib/screener";
import { DEFAULT_VISIBLE_COLUMNS } from "@/lib/screener";

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: LayoutGrid,
  performance: LineChart,
  valuation: PieChart,
  dividends: Coins,
  profitability: BarChart3,
  "income-statement": FileText,
  "balance-sheet": Scale,
  "cash-flow": Droplets,
  "per-share": Share2,
  technicals: Activity,
};

export default function ScreenerTabBar({
  tabs,
  activeTab,
  loading,
  onTabSelect,
  onRefresh,
  viewMode = "table",
  onViewModeChange,
}: {
  tabs: ScreenerTabDefinition[];
  activeTab: string;
  loading: boolean;
  onTabSelect: (tab: ScreenerTabDefinition) => void;
  onRefresh: () => void;
  viewMode?: "table" | "chart";
  onViewModeChange?: (mode: "table" | "chart") => void;
}) {
  const tabList = tabs.length > 0 ? tabs : [{ key: "overview", label: "Overview", defaultColumns: DEFAULT_VISIBLE_COLUMNS }];

  return (
    <div className="mb-2 flex items-center gap-0 border-b border-border/25 pb-0.5">
      {/* ── View toggle — always visible, never scrolled away ── */}
      {onViewModeChange && (
        <div className="mr-2 flex shrink-0 items-center gap-0.5 rounded-md border border-border/40 bg-secondary/20 p-0.5">
          <button
            type="button"
            data-testid="screener-view-toggle-table"
            aria-pressed={viewMode === "table"}
            aria-label="Table view"
            title="Table view"
            onClick={() => onViewModeChange("table")}
            className={`rounded p-1.5 transition-colors ${
              viewMode === "table"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-testid="screener-view-toggle-chart"
            aria-pressed={viewMode === "chart"}
            aria-label="Chart view"
            title="Chart view"
            onClick={() => onViewModeChange("chart")}
            className={`rounded p-1.5 transition-colors ${
              viewMode === "chart"
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Column tabs — horizontally scrollable section ── */}
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-hide">
        {viewMode !== "chart" && tabList.map((tab) => {
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
              <span className="inline-flex items-center gap-1.5">
                {(() => { const Icon = TAB_ICONS[tab.key]; return Icon ? <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "opacity-50"}`} /> : null; })()}
                {tab.label}
              </span>
              {active && <motion.div layoutId="screener-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          );
        })}
      </div>

      {/* ── Refresh — always visible on the right ── */}
      <button
        type="button"
        onClick={onRefresh}
        className="ml-1.5 shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
        title="Refresh data"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
