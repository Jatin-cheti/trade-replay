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
  layout: ChartLayout;
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

const INITIAL_ROWS = 1;
const PAGE_ROWS = 10;

export default function ScreenerChartGrid({ items, layout, chartType, period }: Props) {
  const autoColumns = useAutoColumns();
  const columns = useMemo(() => {
    if (layout.mode === "auto") return autoColumns;
    return Math.max(1, Math.min(6, layout.cols));
  }, [layout, autoColumns]);

  const cardHeight = cardHeightForCols(columns);

  // Incremental loading - expands as user scrolls to the sentinel element
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS * columns);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Reset visible count when items or columns change
    setVisibleCount(INITIAL_ROWS * columns);
  }, [items, columns]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_ROWS * columns, items.length));
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [columns, items.length]);

  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  // Fetch chart data for visible symbols
  const symbols = useMemo(() => visibleItems.map((i) => i.fullSymbol || i.symbol), [visibleItems]);
  const { data: chartDataMap } = useScreenerChartData(symbols, period);

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
                period={period}
                height={cardHeight}
              />
            );
          })}
        </div>
      ))}
      {visibleCount < items.length && (
        <div ref={sentinelRef} className="h-px" aria-hidden />
      )}
    </div>
  );
}