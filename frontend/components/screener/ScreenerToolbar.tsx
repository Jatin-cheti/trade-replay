import {
  Check,
  ChevronDown,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { isSpreadExpression } from "@/lib/spreadOperator";
import type { SavedScreen, ScreenerTypeDefinition } from "@/lib/screener";
import { FALLBACK_SCREENER_TYPES } from "@/lib/screener";

export default function ScreenerToolbar({
  meta,
  routeType,
  currentType,
  typeMenuOpen,
  setTypeMenuOpen,
  typeMenuRef,
  onTypeSelect,
  screenMenuOpen,
  setScreenMenuOpen,
  screenMenuRef,
  activeScreenName,
  activeScreenId,
  screenDirty,
  isAuthenticated,
  savedScreens,
  renamingScreenId,
  setRenamingScreenId,
  renameValue,
  setRenameValue,
  saveScreen,
  deleteScreenById,
  copyScreenById,
  renameScreenById,
  loadScreenState,
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
  screenMenuOpen: boolean;
  setScreenMenuOpen: (open: boolean) => void;
  screenMenuRef: React.RefObject<HTMLDivElement>;
  activeScreenName: string;
  activeScreenId: string | null;
  screenDirty: boolean;
  isAuthenticated: boolean;
  savedScreens: SavedScreen[];
  renamingScreenId: string | null;
  setRenamingScreenId: (id: string | null) => void;
  renameValue: string;
  setRenameValue: (val: string) => void;
  saveScreen: (name?: string) => void;
  deleteScreenById: (id: string) => void;
  copyScreenById: (id: string) => void;
  renameScreenById: (id: string, name: string) => void;
  loadScreenState: (screen: SavedScreen) => void;
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

      {/* Screen picker */}
      <div className="relative" ref={screenMenuRef}>
        <button
          type="button"
          onClick={() => setScreenMenuOpen(!screenMenuOpen)}
          className="inline-flex items-center gap-2 rounded-lg border border-border/55 bg-secondary/25 px-3 py-2 text-sm text-foreground transition-colors hover:border-border"
        >
          {activeScreenName}
          {screenDirty && activeScreenId && <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Unsaved changes" />}
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
        {screenMenuOpen && (
          <div className="absolute left-0 top-full z-40 mt-1.5 w-[280px] rounded-xl border border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl">
            {isAuthenticated && (
              <>
                <button type="button" onClick={() => { saveScreen(activeScreenId ? activeScreenName : undefined); setScreenMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/45">
                  <Save className="h-3.5 w-3.5 text-muted-foreground" />{activeScreenId ? "Save" : "Save screen"}
                </button>
                {activeScreenId && (
                  <button type="button" onClick={() => { saveScreen("Unnamed screen"); setScreenMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground/85 transition-colors hover:bg-secondary/45">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />Save as new
                  </button>
                )}
              </>
            )}
            {savedScreens.length > 0 && (
              <>
                <div className="my-1.5 h-px bg-border/40" />
                <p className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Saved Screens</p>
                <div className="max-h-48 overflow-auto">
                  {savedScreens.map((screen) => (
                    <div key={screen._id} className={`group flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-secondary/45 ${screen._id === activeScreenId ? "bg-primary/12" : ""}`}>
                      {renamingScreenId === screen._id ? (
                        <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => { if (renameValue.trim()) renameScreenById(screen._id, renameValue.trim()); setRenamingScreenId(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { if (renameValue.trim()) renameScreenById(screen._id, renameValue.trim()); setRenamingScreenId(null); } if (e.key === "Escape") setRenamingScreenId(null); }}
                          className="mr-2 flex-1 rounded border border-primary/40 bg-secondary/25 px-1.5 py-0.5 text-xs text-foreground focus:outline-none" />
                      ) : (
                        <button type="button" onClick={() => { loadScreenState(screen); setScreenMenuOpen(false); }}
                          className="flex-1 truncate text-left text-sm text-foreground/85">{screen.name}</button>
                      )}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => { setRenamingScreenId(screen._id); setRenameValue(screen.name); }}
                          className="rounded p-1 text-muted-foreground hover:text-foreground" title="Rename"><Pencil className="h-3 w-3" /></button>
                        <button type="button" onClick={() => copyScreenById(screen._id)}
                          className="rounded p-1 text-muted-foreground hover:text-foreground" title="Duplicate"><Copy className="h-3 w-3" /></button>
                        <button type="button" onClick={() => deleteScreenById(screen._id)}
                          className="rounded p-1 text-muted-foreground hover:text-red-400" title="Delete"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!isAuthenticated && <p className="px-2.5 py-2 text-xs text-muted-foreground">Log in to save screens</p>}
          </div>
        )}
      </div>

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
