import { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { ArrowUpDown, Check, Plus, Search, X, TrendingDown, TrendingUp } from "lucide-react";
import type { ScreenerColumnField, ScreenerItem } from "@/lib/screener";
import { COLUMN_WIDTHS, NUMERIC_COLUMNS } from "@/lib/screener";
import type { SortOrder } from "@/lib/screener";
import renderCell from "./renderCell";

export default function ScreenerTable({
  items,
  visibleColumns,
  columnLookup,
  sortField,
  sortOrder,
  flashBySymbol,
  loadingMore,
  onSort,
  onNavigate,
  onLoadMore,
  addColumnOpen,
  setAddColumnOpen,
  addColumnSearch,
  setAddColumnSearch,
  availableAddColumnFields,
  updateSelectedColumns,
  addColumnRef,
}: {
  items: ScreenerItem[];
  visibleColumns: string[];
  columnLookup: Map<string, ScreenerColumnField>;
  sortField: string;
  sortOrder: SortOrder;
  flashBySymbol: Record<string, "up" | "down">;
  loadingMore: boolean;
  onSort: (field: string) => void;
  onNavigate: (symbol: string) => void;
  onLoadMore: () => void;
  addColumnOpen: boolean;
  setAddColumnOpen: (open: boolean) => void;
  addColumnSearch: string;
  setAddColumnSearch: (search: string) => void;
  availableAddColumnFields: ScreenerColumnField[];
  updateSelectedColumns: (cols: string[]) => void;
  addColumnRef: React.RefObject<HTMLDivElement>;
}) {
  // FIXED: Calculate grid template with explicit widths (no flex units in header)
  const tableGridTemplate = useMemo(
    () => visibleColumns
      .map((column) => {
        const width = COLUMN_WIDTHS[column] || "minmax(100px, 1fr)";
        // Normalize all to explicit minmax for consistent alignment
        if (width.includes("minmax")) return width;
        return `minmax(${width}, ${width})`;
      })
      .join(" "),
    [visibleColumns],
  );

  // FIXED: Calculate minimum width including all columns plus padding
  const tableMinWidth = useMemo(() => {
    let total = 0;
    for (const column of visibleColumns) {
      const width = COLUMN_WIDTHS[column] || "minmax(100px, 1fr)";
      const match = /minmax\((\d+)px/.exec(width);
      const minWidth = match ? Number(match[1]) : 100;
      total += minWidth;
    }
    return Math.max(700, total + 50); // 50 for padding and scrollbar
  }, [visibleColumns]);

  return (
    <div className="rounded-xl border border-border/30 bg-background/40 overflow-hidden">
      {/* FIXED: Horizontal scroll container with proper constraint */}
      <div className="overflow-x-auto overflow-y-hidden" style={{ minWidth: 0 }}>
        <div style={{ minWidth: `${tableMinWidth}px` }}>
          {/* FIXED: Sticky header with matching grid template */}
          <div
            className="sticky top-0 z-20 grid items-center gap-2 border-b border-border/35 bg-[hsl(var(--background))]/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur-sm"
            style={{ 
              gridTemplateColumns: `${tableGridTemplate} 36px`,
              paddingRight: 14,
              minHeight: "44px",
            }}
          >
            {visibleColumns.map((column) => {
              const label = columnLookup.get(column)?.label || column;
              const activeSort = sortField === column;
              const isSymbol = column === "symbol";
              const canRemove = column !== "symbol";

              return (
                <div
                  key={column}
                  className={`flex items-center gap-1 ${
                    NUMERIC_COLUMNS.has(column) ? "justify-end" : "justify-start"
                  } ${isSymbol ? "sticky left-0 z-10 bg-[hsl(var(--background))]" : ""} min-w-0`}
                >
                  <button
                    type="button"
                    onClick={() => onSort(column)}
                    className="flex items-center gap-1 transition-colors hover:text-foreground py-1 px-1 rounded hover:bg-border/20 min-w-0"
                    title={`Sort by ${label}`}
                  >
                    <span className="truncate text-xs md:text-[11px]">{label}</span>
                    {activeSort ? (
                      sortOrder === "desc" ? (
                        <TrendingDown className="h-3 w-3 text-primary flex-shrink-0" />
                      ) : (
                        <TrendingUp className="h-3 w-3 text-primary flex-shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="h-2.5 w-2.5 text-muted-foreground/50 flex-shrink-0" />
                    )}
                  </button>

                  {/* FIXED: Add X button to remove column */}
                  {canRemove && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateSelectedColumns(visibleColumns.filter((c) => c !== column));
                      }}
                      className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-destructive/20 hover:text-destructive flex-shrink-0"
                      title={`Remove ${label} column`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add column button */}
            <div className="relative flex items-center justify-center" ref={addColumnRef}>
              <button
                type="button"
                onClick={() => setAddColumnOpen(!addColumnOpen)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/55 bg-secondary/20 text-muted-foreground/80 transition-colors hover:bg-secondary/45 hover:text-foreground"
                title="Add column"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>

              {/* Add column dropdown */}
              {addColumnOpen && (
                <div className="absolute right-0 top-full z-40 mt-1.5 w-[280px] md:w-[340px] rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl max-h-96 flex flex-col">
                  <div className="mb-2 border-b border-border/40 pb-2 flex-shrink-0">
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
                  <div className="overflow-auto pr-1 flex-1">
                    {availableAddColumnFields.map((col) => {
                      const checked = visibleColumns.includes(col.key);
                      return (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => {
                            if (col.key === "symbol" && checked) return;
                            if (checked) {
                              updateSelectedColumns(visibleColumns.filter((e) => e !== col.key));
                            } else {
                              updateSelectedColumns([...visibleColumns, col.key]);
                            }
                          }}
                          className={`mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                            checked
                              ? "bg-primary/12 text-foreground"
                              : "text-foreground/85 hover:bg-secondary/45"
                          }`}
                        >
                          <span className="truncate">{col.label}</span>
                          {checked ? (
                            <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          ) : (
                            <Plus className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* FIXED: Virtuoso list with matching grid template */}
          <Virtuoso
            data={items}
            style={{
              height: "calc(100vh - 350px)",
              minHeight: 420,
              overflowX: "hidden",
              overflowY: "auto",
            }}
            endReached={onLoadMore}
            overscan={450}
            itemContent={(index, item) => (
              // Section 2 spec (SYM-NEWTAB-001): clicking a row must open the symbol
              // page in a *new browser tab*, not SPA-navigate in-place. Using an
              // anchor with target="_blank" gives us native new-tab + middle-click +
              // Ctrl/Cmd-click semantics for free and preserves accessibility.
              <a
                key={`${item.fullSymbol}-${index}`}
                data-testid="screener-row"
                data-symbol={item.fullSymbol || item.symbol}
                href={`/symbol/${encodeURIComponent(item.fullSymbol || item.symbol)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  // If caller provided an in-page navigator (legacy), still allow it
                  // when modifier keys are NOT used, otherwise let the browser handle it.
                  if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
                  // Keep default browser behaviour (new tab via target="_blank").
                  // onNavigate kept for optional telemetry/prefetch hooks.
                  onNavigate?.(item.fullSymbol || item.symbol);
                }}
                className={`grid w-full items-center gap-2 py-2 pl-3 pr-[14px] text-left transition-colors hover:bg-secondary/30 group md:py-2.5 ${
                  index > 0 ? "border-t border-border/20" : ""
                } ${
                  flashBySymbol[item.fullSymbol || item.symbol] === "up"
                    ? "screener-flash-up"
                    : ""
                } ${
                  flashBySymbol[item.fullSymbol || item.symbol] === "down"
                    ? "screener-flash-down"
                    : ""
                }`}
                style={{ gridTemplateColumns: `${tableGridTemplate} 36px` }}
              >
                {visibleColumns.map((column) => {
                  const isSymbol = column === "symbol";
                  return (
                    <div
                      key={column}
                      className={`${
                        NUMERIC_COLUMNS.has(column) ? "text-right" : "text-left"
                      } min-w-0 ${
                        isSymbol ? "sticky left-0 z-[5] bg-[hsl(var(--background))] group-hover:bg-[hsl(var(--secondary)/0.3)]" : ""
                      }`}
                    >
                      {renderCell(item, column)}
                    </div>
                  );
                })}
                <div aria-hidden="true" />
              </a>
            )}
            components={{
              Footer: () =>
                loadingMore ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Loading more symbols...
                  </div>
                ) : null,
            }}
          />
        </div>
      </div>
    </div>
  );
}
