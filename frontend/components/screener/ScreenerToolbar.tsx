import { Check, ChevronDown, Search, X } from "lucide-react";
import { isSpreadExpression } from "@/lib/spreadOperator";
import type { SavedScreen, ScreenerTypeDefinition } from "@/lib/screener";
import { FALLBACK_SCREENER_TYPES } from "@/lib/screener";
import ScreenerScreenMenu from "./ScreenerScreenMenu";

export default function ScreenerToolbar({
  meta,
  routeType,
  currentType,
  typeMenuOpen,
  setTypeMenuOpen,
  typeMenuRef,
  onTypeSelect,
  activeScreenName,
  activeScreenId,
  screenDirty,
  isAuthenticated,
  savedScreens,
  saveScreen,
  deleteScreenById,
  copyScreenById,
  renameScreenById,
  loadScreenState,
  onDownloadCSV,
  queryInput,
  setQueryInput,
  onSpreadChart,
}: {
  meta: { screenerTypes: ScreenerTypeDefinition[] } | null;
  routeType: string;
  currentType: ScreenerTypeDefinition | undefined;
  typeMenuOpen: boolean;
  setTypeMenuOpen: (open: boolean) => void;
  typeMenuRef: React.RefObject<HTMLDivElement>;
  onTypeSelect: (type: string) => void;
  activeScreenName: string;
  activeScreenId: string | null;
  screenDirty: boolean;
  isAuthenticated: boolean;
  savedScreens: SavedScreen[];
  saveScreen: (name?: string) => void;
  deleteScreenById: (id: string) => void;
  copyScreenById: (id: string) => void;
  renameScreenById: (id: string, name: string) => void;
  loadScreenState: (screen: SavedScreen) => void;
  onDownloadCSV: () => void;
  queryInput: string;
  setQueryInput: (val: string) => void;
  onSpreadChart: (symbol: string) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 md:gap-3">
      {/* Type picker */}
      <div className="relative" ref={typeMenuRef}>
        <button
          type="button"
          onClick={() => setTypeMenuOpen(!typeMenuOpen)}
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
                <button key={entry.routeType} type="button" onClick={() => onTypeSelect(entry.routeType)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${active ? "bg-primary/12 text-foreground" : "text-foreground/85 hover:bg-secondary/45"}`}
                >
                  <span>{entry.label}</span>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Screen menu */}
      <ScreenerScreenMenu
        activeScreenId={activeScreenId}
        activeScreenName={activeScreenName}
        savedScreens={savedScreens}
        screenDirty={screenDirty}
        isAuthenticated={isAuthenticated}
        saveScreen={saveScreen}
        deleteScreenById={deleteScreenById}
        copyScreenById={copyScreenById}
        renameScreenById={renameScreenById}
        loadScreenState={loadScreenState}
        onDownloadCSV={onDownloadCSV}
      />

      {/* Search + spread chart */}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search by symbol or company"
            className="w-[220px] rounded-lg border border-border/55 bg-secondary/25 py-2 pl-7 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
          />
          {queryInput && (
            <button type="button" onClick={() => setQueryInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          )}
        </div>
        {queryInput && isSpreadExpression(queryInput) && (
          <button type="button" onClick={() => onSpreadChart(queryInput)}
            className="rounded-lg border border-primary/45 bg-primary/12 px-3 py-2 text-xs font-semibold text-primary">Open spread chart</button>
        )}
      </div>
    </div>
  );
}
