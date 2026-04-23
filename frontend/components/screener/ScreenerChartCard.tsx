import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { createTradingChart, fitChartContent, resizeChartSurface } from "@/services/chart/chartEngine";
import {
  applySeriesData,
  applySeriesVisibility,
  chartVisibilityMap,
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
import type { UTCTimestamp } from "@tradereplay/charts";

const OHLC_CHART_TYPES = new Set<ChartType>(["candlestick", "bar", "ohlc", "heikinAshi", "hollowCandles"]);

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
  time: string;
}

export default function ScreenerChartCard({ item, candles, chartType, period, height = 200 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createTradingChart> | null>(null);
  const seriesMapRef = useRef<ChartSeriesMap | null>(null);
  const prevCloseLineRef = useRef<any>(null);
  const firstTimeRef = useRef<import('@tradereplay/charts').UTCTimestamp | null>(null);
  const lastTimeRef = useRef<import('@tradereplay/charts').UTCTimestamp | null>(null);
  const numBarsRef = useRef<number>(0);
  const isResizingRef = useRef(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [chartInitFailed, setChartInitFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  const { getFlag, setFlag } = useSymbolFlags();
  const flagColor = getFlag(item.fullSymbol);

  const transformed = useMemo(() => transformChartData(candles, candles.length), [candles]);

  // Prev-close: first candle's open (period start price)
  const prevClose = useMemo(() => {
    if (!transformed.ohlcRows.length) return null;
    return (transformed.ohlcRows[0] as any).open ?? transformed.ohlcRows[0].close;
  }, [transformed]);

  // Compute period % change from candle data (first open → last close)
  const periodChange = useMemo(() => {
    const rows = transformed.ohlcRows;
    if (rows.length < 1) return item.changePercent ?? 0;
    const firstBar = rows[0];
    const lastBar = rows[rows.length - 1];
    const startPrice = (firstBar as any).open ?? firstBar.close;
    const endPrice = lastBar.close;
    if (!startPrice || !endPrice || startPrice === 0) return item.changePercent ?? 0;
    return ((endPrice - startPrice) / startPrice) * 100;
  }, [transformed.ohlcRows, item.changePercent]);

  const isPositive = periodChange >= 0;
  const lineColor = isPositive ? "#10b981" : "#ef4444";

  // Refs updated every render so event handlers set up once always have current values
  const lineColorRef = useRef(lineColor);
  lineColorRef.current = lineColor;
  const chartTypeRef = useRef(chartType);
  chartTypeRef.current = chartType;
  const rowsRef = useRef(transformed.ohlcRows);
  rowsRef.current = transformed.ohlcRows;

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
      setChartInitFailed(true);
      return;
    }

    try {
      (chart as any).applyOptions({
        handleScale: { mouseWheel: false, pinch: false, axisPressedMouseMove: { time: false, price: false } },
        handleScroll: { mouseWheel: false, pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
        timeScale: {
          rightOffset: 0,
          barSpacing: 4,
          minBarSpacing: 0.5,
          fixLeftEdge: false,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: false,
          timeVisible: true,
          secondsVisible: false,
          borderVisible: false,
          // Use only the built-in axis labels to avoid duplicated X labels.
          visible: true,
        },
        rightPriceScale: {
          scaleMargins: { top: 0.08, bottom: 0.08 },
          autoScale: true,
        },
        crosshair: {
          mode: 1,
          vertLine: { labelVisible: false },
          // Show LWC's built-in horizontal price label on Y axis during hover
          horzLine: { labelVisible: true, style: 3, width: 1, color: 'rgba(155,160,170,0.4)' },
        },
      });
    } catch { /* non-fatal */ }

    let seriesMap: ReturnType<typeof createChartSeries>;
    try {
      seriesMap = createChartSeries(chart, { parityMode: false });
    } catch {
      setChartInitFailed(true);
      try { chart.remove(); } catch { /* ignore */ }
      return;
    }

    setChartInitFailed(false);
    chartRef.current = chart;
    seriesMapRef.current = seriesMap;

    // Crosshair move -> draw dot on active series and update tooltip.
    (chart as any).subscribeCrosshairMove((param: any) => {
      const overlay = overlayRef.current;
      const ctx = overlay?.getContext('2d');

      // Always clear first
      if (ctx && overlay) {
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, overlay.width / dpr, overlay.height / dpr);
      }

      // Suppress dot drawing for 200ms after any resize — avoids misplaced dot
      // from LWC re-firing crosshairMove after canvas layout changes.
      if (isResizingRef.current) {
        setHoverInfo(null);
        return;
      }

      if (!param.point) {
        setHoverInfo(null);
        return;
      }

      const rows = rowsRef.current;
      if (!rows.length) {
        setHoverInfo(null);
        return;
      }

      let idx = rows.length - 1;
      if (param.time != null) {
        // Use nearest-time search instead of exact findIndex. The chart's timeIndex
        // is a union of ALL series timestamps, including synthetic ones inserted by
        // stepLineTransform (time-1 points between bars). An exact match would return
        // -1 for those synthetic times, causing idx to default to the last bar.
        let minDiff = Infinity;
        const targetTime = param.time as number;
        rows.forEach((r, i) => {
          const diff = Math.abs((r.time as number) - targetTime);
          if (diff < minDiff) { minDiff = diff; idx = i; }
        });
      }
      // When param.time is null the cursor is outside the data range — idx stays at
      // rows.length - 1 (last bar), set by the initial assignment above.

      const row = rows[idx];
      const visibleKeys = chartVisibilityMap[chartTypeRef.current] ?? ['area'];
      const primaryKey = visibleKeys[0] as keyof ChartSeriesMap;
      const primarySeries = seriesMapRef.current?.[primaryKey] as any;
      // dotX: snap to the bar's centre pixel so the dot sits on the series line.
      // Falls back to param.point.x if timeToCoordinate is unavailable.
      const dotX: number = chartRef.current?.timeScale().timeToCoordinate(row.time as UTCTimestamp) ?? param.point.x;
      // dotY: exact Y of the series line at this bar's close price in canvas coords.
      // priceToCoordinate uses the same coordinate space as e.offsetX/Y (canvas pixels).
      const dotY: number | null = (primarySeries?.priceToCoordinate(row.close) as number | null | undefined) ?? null;

      // Only draw if coordinates are within the canvas bounds — prevents corner-stuck dot
      const canvasW = containerRef.current?.clientWidth ?? 0;
      const canvasH = containerRef.current?.clientHeight ?? 0;
      const inBounds = dotY !== null && Number.isFinite(dotX) && Number.isFinite(dotY)
        && dotX >= 0 && dotX <= canvasW && dotY >= 0 && dotY <= canvasH;
      if (ctx && overlay && inBounds) {
        try {
          ctx.save();
          ctx.beginPath();
          ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
          ctx.fillStyle = lineColorRef.current;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#131722';
          ctx.stroke();
          ctx.restore();
        } catch { /* ignore */ }
      }

      const dt = new Date((row.time as number) * 1000);
      const date = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

      if (OHLC_CHART_TYPES.has(chartTypeRef.current)) {
        setHoverInfo({
          price: row.close,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume,
          date,
          time,
        });
      } else {
        setHoverInfo({
          price: row.close,
          date,
          time,
        });
      }
    });

    const resize = () => {
      const c = chartRef.current;
      const ct = containerRef.current;
      const ov = overlayRef.current;
      if (!c || !ct || !ov) return;
      try {
        resizeChartSurface(c, ct, ov);
        // Suppress crosshair dot for 200ms after resize — prevents LWC from
        // re-firing subscribeCrosshairMove with stale/wrong coordinates.
        isResizingRef.current = true;
        if (resizeTimerRef.current != null) clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = setTimeout(() => { isResizingRef.current = false; }, 200);
        // Clear stale dot immediately
        try {
          const ctx = ov.getContext('2d');
          if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, ov.width / dpr, ov.height / dpr);
          }
        } catch { /* ignore */ }
        setHoverInfo(null);
        // After resize, re-fit content using stored time refs
        if (ct.clientWidth > 0 && ct.clientHeight > 0) {
          const ft = firstTimeRef.current;
          const lt = lastTimeRef.current;
          const nb = numBarsRef.current;
          if (ft != null && lt != null && nb > 0) {
            try { fitChartContent(c, ct, ft, lt, nb); } catch { /* ignore */ }
          }
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
      if (resizeTimerRef.current != null) clearTimeout(resizeTimerRef.current);
      isResizingRef.current = false;
      try { chart.remove(); } catch { /* ignore */ }
      chartRef.current = null;
      seriesMapRef.current = null;
      setReady(false);
    };
  }, [visible]);

  // Fallback renderer: draw a simple sparkline on the overlay canvas if chart init fails.
  useEffect(() => {
    if (!chartInitFailed) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const host = overlay.parentElement;
    if (!host) return;

    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width < 10 || height < 10) return;

    const dpr = window.devicePixelRatio || 1;
    overlay.width = Math.max(1, Math.round(width * dpr));
    overlay.height = Math.max(1, Math.round(height * dpr));
    overlay.style.width = `${width}px`;
    overlay.style.height = `${height}px`;

    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const rows = transformed.ohlcRows;
    if (rows.length < 2) return;

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      if (row.low < min) min = row.low;
      if (row.high > max) max = row.high;
    }
    const span = Math.max(0.000001, max - min);
    const leftPad = 8;
    const rightPad = 8;
    const topPad = 8;
    const bottomPad = 10;
    const plotW = Math.max(1, width - leftPad - rightPad);
    const plotH = Math.max(1, height - topPad - bottomPad);

    ctx.lineWidth = 2;
    ctx.strokeStyle = lineColor;
    ctx.beginPath();
    rows.forEach((row, idx) => {
      const x = leftPad + (idx / (rows.length - 1)) * plotW;
      const y = topPad + (1 - (row.close - min) / span) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [chartInitFailed, lineColor, transformed.ohlcRows]);

  // Data + colour + axis effect — re-run when candles, period, or chartType change
  useEffect(() => {
    const seriesMap = seriesMapRef.current;
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!ready || !seriesMap || !chart || !container) return;

    try {
      applySeriesData(seriesMap, transformed);
      applySeriesVisibility(seriesMap, chartType);

      const areaTopColor = isPositive ? "rgba(16,185,129,0.20)" : "rgba(239,68,68,0.20)";
      const areaBotColor = isPositive ? "rgba(16,185,129,0.00)" : "rgba(239,68,68,0.00)";
      seriesMap.area.applyOptions({ lineColor, topColor: areaTopColor, bottomColor: areaBotColor });
      seriesMap.mountainArea.applyOptions({ lineColor, topColor: areaTopColor, bottomColor: areaBotColor });
      seriesMap.equityCurve.applyOptions({ lineColor, topColor: areaTopColor, bottomColor: areaBotColor });
      seriesMap.line.applyOptions({ color: lineColor });
      seriesMap.stepLine.applyOptions({ color: lineColor });

      // Ensure current-value labels are shown on visible series.
      try {
        const visibleKeys = chartVisibilityMap[chartType] ?? ['area'];
        for (const key of visibleKeys) {
          const visibleSeries = seriesMap[key as keyof ChartSeriesMap];
          if (!visibleSeries) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (visibleSeries as any).applyOptions({ lastValueVisible: true, priceLineVisible: true });
        }
      } catch { /* ignore */ }

      // Manage prev-close reference line on the primary visible series
      try {
        const visibleKeys = chartVisibilityMap[chartType] ?? ['area'];
        const primaryKey = visibleKeys[0] as keyof ChartSeriesMap;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const primarySeries = (seriesMap[primaryKey] ?? seriesMap.area) as any;
        if (prevCloseLineRef.current) {
          try { (seriesMap.area as any).removePriceLine(prevCloseLineRef.current); } catch { /* ignore */ }
          try { primarySeries.removePriceLine(prevCloseLineRef.current); } catch { /* ignore */ }
          prevCloseLineRef.current = null;
        }
        if (prevClose != null) {
          prevCloseLineRef.current = primarySeries.createPriceLine({
            price: prevClose,
            color: 'rgba(160,160,160,0.55)',
            lineWidth: 1,
            lineStyle: 2, // dashed
            axisLabelVisible: true,
            title: 'Prev',
          });
        }
      } catch { /* createPriceLine may not be available */ }

      // Fit chart left-to-right using fitChartContent (accounts for barSpacing)
      const rows = transformed.ohlcRows;
      if (rows.length >= 2) {
        const ft = rows[0].time;
        const lt = rows[rows.length - 1].time;
        firstTimeRef.current = ft;
        lastTimeRef.current = lt;
        numBarsRef.current = rows.length;
        try { fitChartContent(chart, container, ft, lt, rows.length); } catch { /* ignore */ }

      } else if (rows.length === 1) {
        try { fitChartContent(chart, container, rows[0].time, rows[0].time, 1); } catch { /* ignore */ }
      }
    } catch { /* ignore data application errors */ }
  }, [chartType, isPositive, lineColor, period, prevClose, ready, transformed]);

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
              {isPositive ? "+" : ""}{periodChange.toFixed(2)}%
            </p>
          </div>
          {/* Full-chart button — opens chart page in new tab */}
          <a
            href={`/charts?symbol=${encodeURIComponent(item.fullSymbol || item.symbol)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 ml-0.5 rounded p-1 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/40 transition-colors"
            title="Open full chart"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Chart area — NO padding so canvas coordinates align with LWC chart coordinates */}
        <div className="relative flex-1 min-h-0">
          {/* Stable wrapper keeps chart area sized even if chart library mutates inner container classes. */}
          <div className="absolute inset-0">
            {/* LWC container — NEVER put React children inside here */}
            <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
          </div>
          {/* Canvas for hover dot + axis labels (drawn directly via canvas API) */}
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0" style={{ zIndex: 10 }} />

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
                  <span className="text-white/60">{hoverInfo.time}</span>
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
                  <span className="text-white/60">{hoverInfo.time}</span>
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
