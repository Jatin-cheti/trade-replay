import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import type { ScreenerTabDefinition } from "@/lib/screener";
import { DEFAULT_VISIBLE_COLUMNS } from "@/lib/screener";

export default function ScreenerTabBar({
  tabs,
  activeTab,
  loading,
  onTabSelect,
  onRefresh,
}: {
  tabs: ScreenerTabDefinition[];
  activeTab: string;
  loading: boolean;
  onTabSelect: (tab: ScreenerTabDefinition) => void;
  onRefresh: () => void;
}) {
  const tabList = tabs.length > 0 ? tabs : [{ key: "overview", label: "Overview", defaultColumns: DEFAULT_VISIBLE_COLUMNS }];

  return (
    <div className="mb-2 flex items-center gap-0.5 overflow-x-auto border-b border-border/25 pb-0.5 scrollbar-hide">
      {tabList.map((tab) => {
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
      <button
        type="button"
        onClick={onRefresh}
        className="ml-auto rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
        title="Refresh data"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
