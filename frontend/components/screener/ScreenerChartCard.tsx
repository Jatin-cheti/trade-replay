import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTradingChart, resizeChartSurface } from "@/services/chart/chartEngine";
import {
  applySeriesData,
  applySeriesVisibility,
  createChartSeries,
  type ChartSeriesMap,
} from "@/services/chart/seriesManager";
import { transformChartData, type ChartType, COMING_SOON_CHART_TYPES } from "@/services/chart/dataTransforms";
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

interface HoverInfo {
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  date: string;
}

export default function ScreenerChartCard({ item, candles, chartType, height = 200 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createTradingChart> | null>(null);
  const seriesMapRef = useRef<ChartSeriesMap | null>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  const { getFlag, setFlag } = useSymbolFlags();
  const flagColor = getFlag(item.fullSymbol);

  const isPositive = (item.changePercent ?? 0) >= 0;
  const lineColor = isPositive ? "#10b981" : "#ef4444";

  const transformed = useMemo(() => transformChartData(candles, candles.length), [candles]);

  // Prev-close: first candle's close (period open price)
  const prevClose = useMemo(() => {
    if (!transformed.ohlcRows.length) return null;
    return transformed.ohlcRows[0].open ?? transformed.ohlcRows[0].close;
  }, [transformed]);

  // Observe card visibility — defer chart init until the card enters the viewport
  useEffect(() => {
    const root = containerRef.current?.closest('[data-testid="screener-chart-card"]') ?? containerRef.current;
    if (!root) { setVisible(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } },
      { rootMargin: "200px" }
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  // Chart init (once, after card is visible)
  useEffect(() => {
    if (!visible) return;
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    let chart: ReturnType<typeof createTradingChart>;
    try {
      chart = createTradingChart(container, { parityMode: false, viewMode: "normal" });
    } catch {
      return;
    }

    try {
      chart.applyOptions({
        handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: { time: false, price: false } },
        handleScroll: { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
        timeScale: {
          rightOffset: 0,
          barSpacing: 3,
          minBarSpacing: 0.5,
          fixLeftEdge: true,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: true,
        },
        rightPriceScale: {
          scaleMargins: { top: 0.08, bottom: 0.08 },
          autoScale: true,
        },
        crosshair: { mode: 1 }, // enable crosshair for hover
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

    // Crosshair move → update hover info
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setHoverInfo(null);
        return;
      }
      // Try OHLC series first
      const ohlcData = param.seriesData?.get(seriesMap.candlestick) as { open?: number; high?: number; low?: number; close?: number } | undefined;
      const lineData = param.seriesData?.get(seriesMap.area) as { value?: number } | undefined
        ?? param.seriesData?.get(seriesMap.line) as { value?: number } | undefined;

      const ts = typeof param.time === "number" ? param.time * 1000 : 0;
      const dateStr = ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

      if (ohlcData && ohlcData.close != null) {
        setHoverInfo({
          price: ohlcData.close,
          open: ohlcData.open,
          high: ohlcData.high,
          low: ohlcData.low,
          close: ohlcData.close,
          date: dateStr,
        });
      } else if (lineData && lineData.value != null) {
        setHoverInfo({ price: lineData.value, date: dateStr });
      } else {
        setHoverInfo(null);
      }
    });

    const resize = () => {
      const c = chartRef.current;
      const ct = containerRef.current;
      const ov = overlayRef.current;
      if (!c || !ct || !ov) return;
      try {
        resizeChartSurface(c, ct, ov);
        if (ct.clientWidth > 0 && ct.clientHeight > 0) {
          c.timeScale().fitContent();
        }
      } catch { /* ignore */ }
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    setReady(true);

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
  }, [visible]);

  // Data + colour effect — re-run when candles or chartType change
  useEffect(() => {
    const seriesMap = seriesMapRef.current;
    if (!ready || !seriesMap) return;

    try {
      applySeriesData(seriesMap, transformed);
      applySeriesVisibility(seriesMap, chartType);

      const areaTopColor = isPositive ? "rgba(16,185,129,0.20)" : "rgba(239,68,68,0.20)";
      const areaBotColor = isPositive ? "rgba(16,185,129,0.00)" : "rgba(239,68,68,0.00)";
      seriesMap.area.applyOptions({ lineColor, topColor: areaTopColor, bottomColor: areaBotColor });
      seriesMap.mountainArea.applyOptions({ lineColor, topColor: areaTopColor, bottomColor: areaBotColor });
      seriesMap.line.applyOptions({ color: lineColor });
      seriesMap.stepLine.applyOptions({ color: lineColor });

      // Add prev-close reference line if we have a price-axis reference
      if (prevClose != null && seriesMap.area) {
        try {
          seriesMap.area.createPriceLine({
            price: prevClose,
            color: "rgba(180,180,180,0.5)",
            lineWidth: 1,
            lineStyle: 2, // dashed
            axisLabelVisible: false,
            title: "",
          });
        } catch { /* ignore if createPriceLine not supported */ }
      }

      if (transformed.ohlcRows.length > 0) {
        chartRef.current?.timeScale().fitContent();
      }
    } catch { /* ignore data application errors */ }
  }, [chartType, isPositive, lineColor, prevClose, ready, transformed]);

  const hasData = transformed.ohlcRows.length > 1;
  const isSoon = COMING_SOON_CHART_TYPES.has(chartType);

  const symbolHref = `/symbol/${encodeURIComponent(item.fullSymbol || item.symbol)}`;

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <>
      <div
        data-testid="screener-chart-card"
        className="group relative flex flex-col rounded-xl border border-border/30 bg-card overflow-hidden hover:border-border/60 transition-colors"
        style={{ height }}
        onContextMenu={onContextMenu}
      >
        {/* Header — clicking symbol name opens symbol page in new tab */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 shrink-0">
          <a
            href={symbolHref}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <AssetAvatar
              src={item.s3Icon || item.iconUrl || null}
              label={item.symbol}
              className="h-7 w-7 rounded-full hover:ring-2 ring-primary/50 transition-all"
            />
          </a>
          <div className="min-w-0 flex-1">
            <a
              href={symbolHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-[12px] font-bold text-foreground leading-tight hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {item.symbol}
            </a>
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
          <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }} />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0" />

          {/* Skeleton overlay while waiting for candle data */}
          {candles.length === 0 && (
            <div className="absolute inset-0 animate-pulse rounded-lg bg-secondary/40" />
          )}

          {/* Coming-soon chart types: show placeholder message */}
          {isSoon && candles.length > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/80 rounded-lg">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Advanced chart</span>
              <span className="text-[9px] text-muted-foreground/40">Full view on symbol page</span>
            </div>
          )}

          {/* No-data state */}
          {candles.length > 0 && !hasData && !isSoon && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground/60">
              No data
            </div>
          )}

          {/* Hover OHLC tooltip */}
          {hoverInfo && (
            <div className="pointer-events-none absolute left-1.5 top-1 z-10 rounded-md bg-black/85 px-2 py-1 text-[9px] leading-tight shadow-lg">
              {hoverInfo.open != null ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-white/60">{hoverInfo.date}</span>
                  <div className="flex gap-2 text-[9px]">
                    <span className="text-white/70">O<span className="ml-0.5 text-white">{hoverInfo.open.toFixed(2)}</span></span>
                    <span className="text-white/70">H<span className="ml-0.5 text-emerald-400">{hoverInfo.high?.toFixed(2)}</span></span>
                    <span className="text-white/70">L<span className="ml-0.5 text-red-400">{hoverInfo.low?.toFixed(2)}</span></span>
                    <span className="text-white/70">C<span className="ml-0.5 text-white">{hoverInfo.close?.toFixed(2)}</span></span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  <span className="text-white/60">{hoverInfo.date}</span>
                  <span className="font-semibold text-white">{hoverInfo.price.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Green/red dot indicator at current price */}
          {hasData && !isSoon && (
            <div
              className={`pointer-events-none absolute right-3 bottom-3 h-2 w-2 rounded-full ${isPositive ? "bg-emerald-400" : "bg-red-400"} shadow-[0_0_4px_1px_currentColor]`}
            />
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
