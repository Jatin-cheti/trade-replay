import { useEffect, useMemo, useRef, useState } from "react";
import type { ScreenerItem } from "@/lib/screener";
import type { ChartType } from "@/services/chart/dataTransforms";
import ScreenerChartCard from "./ScreenerChartCard";
import { useScreenerChartData } from "@/hooks/useScreenerChartData";

export type ChartLayout = { mode: "auto" } | { mode: "custom"; cols: number };

interface Props {
  items: ScreenerItem[];
  chartType: ChartType;
  period: string;
  customRange?: { from: Date; to: Date } | null;
  layout: ChartLayout;
  /** Called to fetch the next page of screener items from the backend. */
  onLoadMore?: () => void;
  /** Whether more items are available to load from the backend. */
  hasMore?: boolean;
  /** Whether a backend load is already in-flight. */
  loadingMore?: boolean;
}

function useAutoColumns(): number {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  if (width < 640) return 1;
  if (width < 1024) return 2;
  if (width < 1280) return 3;
  if (width < 1536) return 4;
  return 5;
}

function cardHeightForCols(cols: number): number {
  if (cols === 1) return 180;
  if (cols === 2) return 200;
  if (cols <= 4) return 220;
  return 240;
}

/** Derive an effective period from a custom date range so the axis formatter
 *  uses the right granularity (e.g. a 3-day custom range → "5D" formatter). */
function effectivePeriod(period: string, customRange?: { from: Date; to: Date } | null): string {
  if (!customRange) return period;
  const days = (customRange.to.getTime() - customRange.from.getTime()) / 86_400_000;
  if (days <= 2) return '1D';
  if (days <= 10) return '5D';
  if (days <= 60) return '1M';
  if (days <= 180) return '6M';
  if (days <= 400) return '1Y';
  return '5Y';
}

const INITIAL_COUNT = 50;
const PAGE_SIZE = 50;

export default function ScreenerChartGrid({
  items,
  layout,
  chartType,
  period,
  customRange,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}: Props) {
  const autoColumns = useAutoColumns();
  const columns = useMemo(() => {
    if (layout.mode === "auto") return autoColumns;
    return Math.max(1, Math.min(6, layout.cols));
  }, [layout, autoColumns]);

  const cardHeight = cardHeightForCols(columns);

  // --- Lazy visible count: mount chart instances progressively for perf ---
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  // Reset when items array changes (filter/search change)
  useEffect(() => {
    setVisibleCount(INITIAL_COUNT);
  }, [items]);

  // Keep refs fresh so the observer callback never captures stale closures
  const itemsLengthRef = useRef(items.length);
  itemsLengthRef.current = items.length;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const loadingMoreRef = useRef(loadingMore);
  loadingMoreRef.current = loadingMore;
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;
  const visibleCountRef = useRef(visibleCount);
  visibleCountRef.current = visibleCount;

  // Single always-present sentinel observed by IntersectionObserver.
  // Re-attach whenever items.length changes so new items are detected.
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const currentVisible = visibleCountRef.current;
        const totalLoaded = itemsLengthRef.current;
        if (currentVisible < totalLoaded) {
          // Reveal more already-loaded items
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, totalLoaded));
        } else if (hasMoreRef.current && !loadingMoreRef.current) {
          // All loaded items shown → fetch next page from backend
          onLoadMoreRef.current?.();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  // Fetch chart data for visible symbols
  const symbols = useMemo(() => visibleItems.map((i) => i.fullSymbol || i.symbol), [visibleItems]);
  const { data: chartDataMap } = useScreenerChartData(symbols, period, customRange ?? undefined);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <div className="text-3xl" aria-hidden>&#x1F4CA;</div>
        <p className="text-sm font-medium text-foreground">No results to chart</p>
        <p className="max-w-xs text-xs text-muted-foreground">Adjust your filters to see chart results.</p>
      </div>
    );
  }

  const rows: ScreenerItem[][] = [];
  for (let i = 0; i < visibleItems.length; i += columns) {
    rows.push(visibleItems.slice(i, i + columns));
  }

  return (
    <div data-testid="screener-chart-grid" className="w-full px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10">
      {rows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className="mb-3 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {row.map((item) => {
            const key = item.fullSymbol || item.symbol;
            const symbolData = chartDataMap[key];
            return (
              <ScreenerChartCard
                key={key}
                item={item}
                candles={symbolData?.candles ?? []}
                chartType={chartType}
                period={effectivePeriod(period, customRange)}
                height={cardHeight}
              />
            );
          })}
        </div>
      ))}
      {/* Sentinel: always present so IntersectionObserver can fire when user nears the bottom */}
      <div ref={sentinelRef} aria-hidden>
        {loadingMore && visibleCount >= items.length && (
          <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading more charts…
          </div>
        )}
      </div>
    </div>
  );
}