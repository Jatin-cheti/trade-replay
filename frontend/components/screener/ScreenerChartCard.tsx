import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTradingChart, resizeChartSurface } from "@/services/chart/chartEngine";
import {
  applySeriesData,
  applySeriesVisibility,
  createChartSeries,
  type ChartSeriesMap,
} from "@/services/chart/seriesManager";
import { transformChartData, type ChartType } from "@/services/chart/dataTransforms";
import type { CandleData } from "@/data/stockData";
import type { ScreenerItem } from "@/lib/screener";
import AssetAvatar from "@/components/ui/AssetAvatar";
import ScreenerRowContextMenu from "@/components/screener/ScreenerRowContextMenu";
import { useSymbolFlags } from "@/hooks/useSymbolFlags";
import { formatPriceUs } from "@/lib/numberFormat";

interface Props {
  item: ScreenerItem;
  candles: CandleData[];
  chartType: ChartType;
  period: string;
  height?: number;
}

interface ContextMenuState { x: number; y: number }

export default function ScreenerChartCard({ item, candles, chartType, height = 200 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createTradingChart> | null>(null);
  const seriesMapRef = useRef<ChartSeriesMap | null>(null);
  const [ready, setReady] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const { getFlag, setFlag } = useSymbolFlags();
  const flagColor = getFlag(item.fullSymbol);

  const isPositive = (item.changePercent ?? 0) >= 0;
  const lineColor = isPositive ? "#10b981" : "#ef4444";

  const transformed = useMemo(() => transformChartData(candles, candles.length), [candles]);

  // Chart init (once on mount)
  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    // Guard against failures in headless environments where canvas contexts may
    // be limited (e.g. many Playwright tests running in sequence).
    let chart: ReturnType<typeof createTradingChart>;
    try {
      chart = createTradingChart(container, { parityMode: false, viewMode: "normal" });
    } catch {
      return;
    }

    try {
      chart.applyOptions({
        // Mini screener cards: disable all interaction
        handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: { time: false, price: false } },
        handleScroll: { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
        // Remove right offset so data fills the full width (starts from left)
        timeScale: {
          rightOffset: 0,
          barSpacing: 3,
          minBarSpacing: 0.5,
          fixLeftEdge: true,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: true,
        },
        // Compact price axis for mini cards
        rightPriceScale: {
          scaleMargins: { top: 0.08, bottom: 0.08 },
          autoScale: true,
        },
        // Compact crosshair for mini cards
        crosshair: { mode: 0 },
      });
    } catch { /* non-fatal */ }

    let seriesMap: ReturnType<typeof createChartSeries>;
    try {
      seriesMap = createChartSeries(chart, { parityMode: false });
    } catch {
      try { chart.remove(); } catch { /* ignore */ }
      return;
    }

    chartRef.current = chart;
    seriesMapRef.current = seriesMap;

    const resize = () => {
      const c = chartRef.current;
      const ct = containerRef.current;
      const ov = overlayRef.current;
      if (!c || !ct || !ov) return;
      try {
        resizeChartSurface(c, ct, ov);
        // Re-fit content after resize so bars fill the new dimensions
        if (ct.clientWidth > 0 && ct.clientHeight > 0) {
          c.timeScale().fitContent();
        }
      } catch { /* ignore */ }
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    setReady(true);

    // Release chart on page unload so the browser GC can collect it between
    // Playwright test pages (page.close() dispatches the 'pagehide' event).
    const onPageHide = () => {
      try { chartRef.current?.remove(); } catch { /* ignore */ }
      chartRef.current = null;
      seriesMapRef.current = null;
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      resizeObserver.disconnect();
      try { chart.remove(); } catch { /* ignore */ }
      chartRef.current = null;
      seriesMapRef.current = null;
      setReady(false);
    };
  }, []);

  // Data + colour effect
  useEffect(() => {
    const seriesMap = seriesMapRef.current;
    if (!ready || !seriesMap) return;

    try {
      applySeriesData(seriesMap, transformed);
      applySeriesVisibility(seriesMap, chartType);

      seriesMap.area.applyOptions({
        lineColor,
        topColor: isPositive ? "rgba(16,185,129,0.20)" : "rgba(239,68,68,0.20)",
        bottomColor: isPositive ? "rgba(16,185,129,0.00)" : "rgba(239,68,68,0.00)",
      });
      seriesMap.mountainArea.applyOptions({
        lineColor,
        topColor: isPositive ? "rgba(16,185,129,0.20)" : "rgba(239,68,68,0.20)",
        bottomColor: isPositive ? "rgba(16,185,129,0.00)" : "rgba(239,68,68,0.00)",
      });
      seriesMap.line.applyOptions({ color: lineColor });
      seriesMap.stepLine.applyOptions({ color: lineColor });

      if (transformed.ohlcRows.length > 0) {
        // fitContent ensures all bars are visible; scrollToRealTime=false keeps left edge locked
        chartRef.current?.timeScale().fitContent();
      }
    } catch { /* ignore data application errors */ }
  }, [chartType, isPositive, lineColor, ready, transformed]);

  const hasData = transformed.ohlcRows.length > 1;

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <>
      <div
        data-testid="screener-chart-card"
        className="group relative flex flex-col rounded-xl border border-border/30 bg-card overflow-hidden cursor-default hover:border-border/60 transition-colors"
        style={{ height }}
        onContextMenu={onContextMenu}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 shrink-0">
          <AssetAvatar
            src={item.s3Icon || item.iconUrl || null}
            label={item.symbol}
            className="h-7 w-7 rounded-full"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold text-foreground leading-tight">{item.symbol}</p>
            <p className="truncate text-[10px] text-muted-foreground leading-tight">{item.name || ""}</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="rounded bg-secondary/60 px-1.5 py-0.5 text-[11px] font-semibold text-foreground tabular-nums">
              {formatPriceUs(item.price ?? 0)}
            </span>
            <p className={`mt-0.5 text-[10px] font-medium tabular-nums ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{(item.changePercent ?? 0).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Chart area */}
        <div className="relative flex-1 min-h-0 px-1 pb-1">
          {/*
            The chart container is always rendered so the init useEffect can
            attach the chart instance. Skeleton/no-data states are overlaid on top.
          */}
          <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }} />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0" />

          {/* Skeleton overlay while waiting for candle data */}
          {candles.length === 0 && (
            <div className="absolute inset-0 animate-pulse rounded-lg bg-secondary/40" />
          )}

          {/* No-data state */}
          {candles.length > 0 && !hasData && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground/60">
              No data
            </div>
          )}
        </div>
      </div>

      {contextMenu && (
        <ScreenerRowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          symbol={item.symbol}
          fullSymbol={item.fullSymbol}
          name={item.name ?? item.symbol}
          flagColor={flagColor}
          watchlists={[]}
          onClose={() => setContextMenu(null)}
          onFlag={(fs, color) => setFlag(fs, color)}
          onAddToWatchlist={(fs, wid) => {
            fetch(`/api/watchlist/${wid}/symbols`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ symbol: fs }),
            }).catch(console.error);
          }}
        />
      )}
    </>
  );
}