import { Virtuoso } from "react-virtuoso";
import AssetAvatar from "@/components/ui/AssetAvatar";
import type { ScreenerItem } from "@/lib/screener";
import { formatCompactNumber, formatPercent, formatPrice } from "@/lib/screener";

export default function ScreenerMobileList({
  items,
  loadingMore,
  onNavigate,
  onLoadMore,
}: {
  items: ScreenerItem[];
  loadingMore: boolean;
  onNavigate?: (symbol: string) => void;
  onLoadMore: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/30 bg-background/40">
      <Virtuoso
        data={items}
        style={{ height: "calc(100vh - 330px)", minHeight: 420 }}
        endReached={onLoadMore}
        overscan={300}
        itemContent={(index, item) => (
          // Section 2 spec (SYM-NEWTAB-001): new tab on row click.
          <a
            href={`/symbol/${encodeURIComponent(item.fullSymbol || item.symbol)}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="screener-row-mobile"
            data-symbol={item.fullSymbol || item.symbol}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey) return;
              onNavigate?.(item.fullSymbol || item.symbol);
            }}
            className={`flex w-full items-center gap-3 overflow-hidden px-3 py-3 text-left transition-colors hover:bg-secondary/35 ${
              index > 0 ? "border-t border-border/20" : ""
            }`}
          >
            <AssetAvatar
              src={item.s3Icon || item.iconUrl}
              label={item.symbol}
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border/40"
            />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                {(item.name && item.name.trim()) || item.symbol}
              </span>
              <p className="truncate text-[10px] leading-tight text-muted-foreground/80">
                {item.exchange ? `${item.exchange}: ${item.symbol}` : item.symbol}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm tabular-nums text-foreground">{formatPrice(item.price, item.currency)}</p>
              <p className={`text-xs font-semibold tabular-nums ${item.changePercent == null ? "text-muted-foreground" : item.changePercent > 0 ? "text-emerald-400" : item.changePercent < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                {item.changePercent == null || !Number.isFinite(item.changePercent) ? "—" : formatPercent(item.changePercent)}
              </p>
              <p className="text-[11px] tabular-nums text-muted-foreground">{item.marketCap ? formatCompactNumber(item.marketCap) : ""}</p>
            </div>
          </a>
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
  );
}
