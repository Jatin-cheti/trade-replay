import { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { ArrowUpDown, Check, Plus, Search, TrendingDown, TrendingUp } from "lucide-react";
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
  const tableGridTemplate = useMemo(
    () => visibleColumns.map((column) => COLUMN_WIDTHS[column] || "minmax(110px, 1fr)").join(" "),
    [visibleColumns],
  );

  const tableMinWidth = useMemo(() => {
    const minContentWidth = visibleColumns.reduce((total, column) => {
      const widthDef = COLUMN_WIDTHS[column] || "minmax(110px, 1fr)";
      const match = /minmax\((\d+)px/i.exec(widthDef);
      const minWidth = match ? Number(match[1]) : 110;
      return total + minWidth;
    }, 0);
    return Math.max(920, minContentWidth + 36);
  }, [visibleColumns]);

  return (
    <div className="rounded-xl border border-border/30 bg-background/40">
      <div style={{ overflowX: "auto", minWidth: 0 }}>
        <div style={{ minWidth: tableMinWidth }}>
          <div
            className="sticky top-0 z-20 grid items-center gap-2 border-b border-border/35 bg-[hsl(var(--background))]/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur-sm"
            style={{ gridTemplateColumns: `${tableGridTemplate} 36px`, paddingRight: 14 }}
          >
            {visibleColumns.map((column) => {
              const label = columnLookup.get(column)?.label || column;
              const activeSort = sortField === column;
              const isSymbol = column === "symbol";
              return (
                <button
                  key={column}
                  type="button"
                  onClick={() => onSort(column)}
                  className={`flex items-center gap-1 ${NUMERIC_COLUMNS.has(column) ? "justify-end" : "justify-start"} transition-colors hover:text-foreground ${isSymbol ? "sticky left-0 z-10 bg-[hsl(var(--background))]" : ""}`}
                >
                  <span>{label}</span>
                  {activeSort ? (
                    sortOrder === "desc" ? <TrendingDown className="h-3.5 w-3.5 text-primary" /> : <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/70" />
                  )}
                </button>
              );
            })}
            <div className="relative flex items-center justify-center" ref={addColumnRef}>
              <button
                type="button"
                onClick={() => setAddColumnOpen(!addColumnOpen)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/55 bg-secondary/20 text-muted-foreground/80 transition-colors hover:bg-secondary/45 hover:text-foreground"
                title="Add column"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              {addColumnOpen && (
                <div className="absolute right-0 top-full z-40 mt-1.5 w-[340px] rounded-xl border border-border/60 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
                  <div className="mb-2 border-b border-border/40 pb-2">
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
                  <div className="max-h-72 overflow-auto pr-1">
                    {availableAddColumnFields.map((col) => {
                      const checked = visibleColumns.includes(col.key);
                      return (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => {
                            if (col.key === "symbol" && checked) return;
                            if (checked) updateSelectedColumns(visibleColumns.filter((e) => e !== col.key));
                            else updateSelectedColumns([...visibleColumns, col.key]);
                          }}
                          className={`mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                            checked ? "bg-primary/12 text-foreground" : "text-foreground/85 hover:bg-secondary/45"
                          }`}
                        >
                          <span>{col.label}</span>
                          {checked ? <Check className="h-3.5 w-3.5 text-primary" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Virtuoso
            data={items}
            style={{ height: "calc(100vh - 350px)", minHeight: 420, overflowX: "hidden", scrollbarGutter: "stable" }}
            endReached={onLoadMore}
            overscan={450}
            itemContent={(index, item) => (
              <button
                key={`${item.fullSymbol}-${index}`}
                type="button"
                onClick={() => onNavigate(item.symbol)}
                className={`grid w-full items-center gap-2 py-2.5 pl-3 pr-[14px] text-left transition-colors hover:bg-secondary/30 ${
                  index > 0 ? "border-t border-border/20" : ""
                } ${flashBySymbol[item.fullSymbol || item.symbol] === "up" ? "screener-flash-up" : ""} ${flashBySymbol[item.fullSymbol || item.symbol] === "down" ? "screener-flash-down" : ""}`}
                style={{ gridTemplateColumns: `${tableGridTemplate} 36px` }}
              >
                {visibleColumns.map((column) => {
                  const isSymbol = column === "symbol";
                  return (
                    <div key={column} className={`${NUMERIC_COLUMNS.has(column) ? "text-right" : "text-left"} min-w-0 ${isSymbol ? "sticky left-0 z-[5] bg-[hsl(var(--background))]" : ""}`}>
                      {renderCell(item, column)}
                    </div>
                  );
                })}
                <div aria-hidden="true" />
              </button>
            )}
            components={{
              Footer: () => loadingMore ? (
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
