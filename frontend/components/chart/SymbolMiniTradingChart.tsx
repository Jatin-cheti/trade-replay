import { useEffect, useMemo, useRef, useState } from 'react';
import type { CandleData } from '@/data/stockData';
import { createTradingChart, resizeChartSurface, fitChartContent } from '@/services/chart/chartEngine';
import {
  activeSeriesForType,
  applySeriesData,
  applySeriesVisibility,
  createChartSeries,
  type ChartSeriesMap,
} from '@/services/chart/seriesManager';
import { transformChartData, type ChartType, COMING_SOON_CHART_TYPES, chartTypeLabels } from '@/services/chart/dataTransforms';
import { formatPriceUs } from '@/lib/numberFormat';
import type { ISeriesApi, UTCTimestamp } from '@tradereplay/charts';

interface SymbolMiniTradingChartProps {
  data: CandleData[];
  height?: number | string;
  chartType: ChartType;
  /** Previous trading day's close — drawn as a dashed horizontal reference line. */
  prevClose?: number | null;
  /**
   * Period return used to pick the area/line direction colour.
   * >= 0 -> green, < 0 -> red. If omitted, falls back to last-vs-first close.
   */
  periodReturn?: number | null;
  /** Active time-period key (1d, 5d, 1m, 6m, ytd, 1y, 5y, 10y, all). Used for x-axis clamping. */
  timePeriod?: string;
}

const GREEN_LINE   = '#10b981';
const GREEN_TOP    = 'rgba(16, 185, 129, 0.20)';  // line+fill mode: visible gradient top
const GREEN_BOTTOM = 'rgba(16, 185, 129, 0.00)';
const RED_LINE     = '#ef4444';
const RED_TOP      = 'rgba(239, 68, 68, 0.20)';
const RED_BOTTOM   = 'rgba(239, 68, 68, 0.00)';

const PREV_CLOSE_COLOR = 'rgba(156, 163, 175, 0.85)';

export default function SymbolMiniTradingChart({
  data,
  height = 340,
  chartType,
  prevClose = null,
  periodReturn = null,
  timePeriod,
}: SymbolMiniTradingChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createTradingChart> | null>(null);
  const seriesMapRef = useRef<ChartSeriesMap | null>(null);
  const prevCloseSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const [ready, setReady] = useState(false);

  const transformed = useMemo(() => transformChartData(data, data.length), [data]);
  // Ref that always holds the latest ohlcRows — readable from the (once-mounted) crosshair handler.
  const rowsRef = useRef<typeof transformed.ohlcRows>([]);
  // Ref for current chart type so onCross (defined once) can read the live value.
  const chartTypeRef = useRef<ChartType>(chartType);
  // Ref to the current fit function — called by ResizeObserver to refit after container resize.
  const refitFnRef = useRef<(() => void) | null>(null);

  const isUp = useMemo(() => {
    if (periodReturn != null) return periodReturn >= 0;
    const rows = transformed.ohlcRows;
    if (rows.length < 2) return true;
    return rows[rows.length - 1].close >= rows[0].close;
  }, [periodReturn, transformed]);

  // Keep rowsRef in sync so the crosshair handler can always access the latest rows.
  useEffect(() => {
    rowsRef.current = transformed.ohlcRows;
  }, [transformed]);
  // Keep chartTypeRef in sync so onCross can read the live chart type.
  useEffect(() => {
    chartTypeRef.current = chartType;
  }, [chartType]);

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    price: number;
    time: UTCTimestamp;
    /** Present for OHLC-style chart types (candlestick, bar, ohlc, heikinAshi, hollowCandles). */
    ohlc?: { open: number; high: number; low: number; close: number };
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    const chart = createTradingChart(container, {
      parityMode: false,
      viewMode: 'normal',
      passive: true,
    });
    const seriesMap = createChartSeries(chart, { parityMode: false });
    const prevCloseSeries = chart.addSeries('Line', {
      color: PREV_CLOSE_COLOR,
      lineWidth: 1,
      visible: false,
      excludeFromTimeIndex: true,
    });
    chartRef.current = chart;
    seriesMapRef.current = seriesMap;
    prevCloseSeriesRef.current = prevCloseSeries;

    const resize = () => {
      if (!chartRef.current || !containerRef.current || !overlayRef.current) return;
      resizeChartSurface(chartRef.current, containerRef.current, overlayRef.current);
    };

    resize();

    const observer = new ResizeObserver(() => {
      resize();
      // Re-fit bars to fill the new container width.
      refitFnRef.current?.();
    });
    observer.observe(container);

    const OHLC_CHART_TYPES = new Set(['candlestick', 'ohlc', 'bar', 'heikinAshi', 'hollowCandles']);
    const onCross = (param: unknown) => {
      const p = param as {
        point: { x: number; y: number } | null;
        time: UTCTimestamp | null;
        price: number | null;
        source?: string;
      };
      // Hide tooltip only when mouse leaves the chart area entirely.
      if (!p?.point || p.source === 'leave') {
        setTooltip(null);
        return;
      }
      const rows = rowsRef.current;
      if (!rows.length) { setTooltip(null); return; }

      const isOhlcChart = OHLC_CHART_TYPES.has(chartTypeRef.current);
      let snapTime: UTCTimestamp;
      let snapPrice: number;
      let snapOhlc: { open: number; high: number; low: number; close: number } | undefined;

      if (p.time != null) {
        // Mouse is over a data bar — look up the exact row for OHLC data.
        snapTime = p.time;
        const matchRow = rows.find(r => r.time === snapTime);
        if (matchRow) {
          snapPrice = matchRow.close;
          if (isOhlcChart) {
            snapOhlc = { open: matchRow.open, high: matchRow.high, low: matchRow.low, close: matchRow.close };
          }
        } else {
          snapPrice = p.price ?? rows[rows.length - 1]?.close ?? 0;
        }
      } else {
        // Mouse is in empty space — snap to the nearest row by x fraction.
        const containerWidth = containerRef.current?.clientWidth ?? 800;
        const fraction = Math.max(0, Math.min(1, p.point.x / containerWidth));
        const idx = Math.max(0, Math.min(rows.length - 1, Math.round(fraction * (rows.length - 1))));
        const nearestRow = rows[idx];
        snapTime  = nearestRow.time as UTCTimestamp;
        snapPrice = nearestRow.close;
        if (isOhlcChart) {
          snapOhlc = { open: nearestRow.open, high: nearestRow.high, low: nearestRow.low, close: nearestRow.close };
        }
      }

      setTooltip({ x: p.point.x, y: p.point.y, price: snapPrice, time: snapTime, ohlc: snapOhlc });
    };
    chart.subscribeCrosshairMove(onCross);

    setReady(true);

    return () => {
      chart.unsubscribeCrosshairMove(onCross);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesMapRef.current = null;
      prevCloseSeriesRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const seriesMap = seriesMapRef.current;
    if (!ready || !seriesMap) return;

    applySeriesData(seriesMap, transformed);
    applySeriesVisibility(seriesMap, chartType);

    const lineColor = isUp ? GREEN_LINE : RED_LINE;
    const topColor = isUp ? GREEN_TOP : RED_TOP;
    const bottomColor = isUp ? GREEN_BOTTOM : RED_BOTTOM;

    seriesMap.area.applyOptions({ lineColor, topColor, bottomColor });
    seriesMap.mountainArea.applyOptions({ lineColor, topColor, bottomColor });
    seriesMap.line.applyOptions({ color: lineColor });
    seriesMap.stepLine.applyOptions({ color: lineColor });

    // Clear any previously forced ticks — let the chart auto-generate appropriate
    // time labels for the current data range and resolution.
    chartRef.current?.applyOptions({ forcedTimeTicks: undefined });

    const times = transformed.ohlcRows;
    if (times.length >= 2) {
      const fromTs = times[0].time;
      const toTs   = times[times.length - 1].time;

      // Build a refit closure and store it so ResizeObserver can call it too.
      const doFit = () => {
        if (!chartRef.current || !containerRef.current) return;
        fitChartContent(chartRef.current, containerRef.current, fromTs, toTs, times.length);
      };
      refitFnRef.current = doFit;

      // Fit immediately, then again on the next animation frame so the
      // browser has had a chance to settle the container's final layout width.
      doFit();
      requestAnimationFrame(doFit);
    } else {
      refitFnRef.current = null;
      chartRef.current?.timeScale().scrollToRealTime();
    }
  }, [chartType, ready, transformed, isUp, timePeriod]);

  // Baseline: update baseValue price to the reference price so the chart
  // splits green/red at the correct level (prevClose or first bar's close).
  useEffect(() => {
    const seriesMap = seriesMapRef.current;
    if (!ready || !seriesMap || chartType !== 'baseline') return;
    const rows = transformed.ohlcRows;
    const basePrice =
      prevClose != null && Number.isFinite(prevClose)
        ? prevClose
        : (rows[0]?.close ?? 0);
    seriesMap.baseline.applyOptions({
      baseValue: { type: 'price', price: basePrice },
    });
    // Re-set the data after updating the baseValue so the chart engine
    // recalculates the price-scale range with the correct baseline reference.
    const closeRows = transformed.closeRows;
    if (closeRows.length > 0) {
      seriesMap.baseline.setData(closeRows);
    }
    // Trigger price-scale auto-scale via the series' own price scale API.
    // This causes the chart to recalculate visible range based on the new baseValue.
    try {
      const ps = seriesMap.baseline.priceScale();
      ps.applyOptions({ autoScale: false });
      ps.applyOptions({ autoScale: true });
    } catch { /* API may not be available in this chart build */ }
    // Re-fit the time range as a fallback — triggers price auto-scale recalculation.
    if (rows.length >= 2 && chartRef.current && containerRef.current) {
      const fromTs = rows[0].time;
      const toTs = rows[rows.length - 1].time;
      fitChartContent(chartRef.current, containerRef.current, fromTs, toTs, rows.length);
    }
  }, [chartType, ready, prevClose, transformed]);

  useEffect(() => {
    const series = prevCloseSeriesRef.current;
    const rows = transformed.ohlcRows;
    if (!series || !ready) return;
    // Histogram: prevClose line forces price scale to 0-1400, dwarfing ±50 bars.
    // Baseline: chart itself draws the reference line via baseValue — no duplicate.
    // priceChange: data is close - close[0] (0-50 range), prevClose is ~1400 — incompatible scales.
    // Coming-soon types: no chart is rendered, so prevClose is irrelevant.
    const hideForType = chartType === 'histogram' || chartType === 'baseline'
      || chartType === 'priceChange' || COMING_SOON_CHART_TYPES.has(chartType);
    if (hideForType || prevClose == null || !Number.isFinite(prevClose) || rows.length < 2) {
      series.applyOptions({ visible: false });
      series.setData([]);
      return;
    }
    const first = rows[0].time;
    const last = rows[rows.length - 1].time;
    series.setData([
      { time: first, value: prevClose },
      { time: last, value: prevClose },
    ]);
    series.applyOptions({ visible: true });
  }, [chartType, prevClose, ready, transformed]);

  const hasData = transformed.ohlcRows.length > 1;
  const activeSeries = ready && seriesMapRef.current
    ? activeSeriesForType(seriesMapRef.current, chartType)
    : null;

  const latest = transformed.ohlcRows[transformed.ohlcRows.length - 1] ?? null;
  const latestY = latest && activeSeries ? activeSeries.priceToCoordinate(latest.close) : null;
  const pillDown = prevClose != null && latest ? latest.close < prevClose : !isUp;

  // Draw crosshair dot on the overlay canvas whenever tooltip position changes.
  // The dot is a filled circle at the series value (not raw mouse y) for accuracy.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // Re-apply the DPR transform (canvas size assignment resets context state)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, overlay.width / dpr, overlay.height / dpr);

    if (!tooltip || !activeSeries) return;

    // Snap dot to the bar's price coordinate (not raw mouse Y) and the
    // bar's time coordinate (not raw mouse X) — keeps dot exactly on the line.
    const dotY = activeSeries.priceToCoordinate(tooltip.price);
    if (dotY == null || !Number.isFinite(dotY)) return;

    const dotX = chartRef.current?.timeScale().timeToCoordinate(tooltip.time);
    if (dotX == null || !Number.isFinite(dotX)) return;

    const lineColor = isUp ? GREEN_LINE : RED_LINE;
    ctx.save();
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#131722'; // chart background — creates a halo effect
    ctx.stroke();
    ctx.restore();
  }, [tooltip, isUp, activeSeries]);

  // Prev-close label Y coordinate (computed on active series, which shares the price scale).
  const prevCloseY = prevClose != null && activeSeries
    ? activeSeries.priceToCoordinate(prevClose)
    : null;

  const tooltipBits = useMemo(() => {
    if (!tooltip) return null;
    // Use UTC getters — timestamps use the fake-UTC IST trick so UTCHours == IST hours
    const d = new Date(tooltip.time * 1000);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const yr = String(d.getUTCFullYear()).slice(2);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return {
      price: formatPriceUs(tooltip.price),
      date: `${day} ${mon} '${yr}`,
      time: `${hh}:${mm}`,
    };
  }, [tooltip]);

  return (
    <div className="relative" style={{ height }}>
      <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }} />
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0" />

      {/* Coming-soon overlay — rendered over the empty chart canvas */}
      {COMING_SOON_CHART_TYPES.has(chartType) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-background/70 backdrop-blur-sm rounded-xl">
          <svg viewBox="0 0 48 48" className="h-10 w-10 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="4" y="4" width="40" height="40" rx="6" />
            <path d="M14 34 L20 24 L26 28 L34 16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground/80">{chartTypeLabels[chartType]}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Coming soon — stay tuned!</p>
          </div>
        </div>
      )}

      {!hasData && !COMING_SOON_CHART_TYPES.has(chartType) && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          No chart data available
        </div>
      )}

      {tooltip && tooltipBits && (
        <div
          data-testid="chart-tooltip"
          className="pointer-events-none absolute rounded-md border border-border/40 bg-popover/95 px-2 py-1 text-[11px] leading-tight shadow-md backdrop-blur-sm"
          style={{
            // Smart quadrant positioning: tooltip moves away from whichever edge cursor is near.
            left: (() => {
              const containerW = containerRef.current?.clientWidth ?? 800;
              const tooltipW = tooltip.ohlc ? 180 : 140;
              if (tooltip.x > containerW / 2) {
                return Math.max(4, tooltip.x - tooltipW - 16);
              } else {
                return Math.min(containerW - tooltipW - 4, tooltip.x + 16);
              }
            })(),
            top: (() => {
              const containerH = containerRef.current?.clientHeight ?? 400;
              const tooltipH = tooltip.ohlc ? 76 : 60;
              if (tooltip.y > containerH / 2) {
                return Math.max(4, tooltip.y - tooltipH - 8);
              } else {
                return Math.min(containerH - tooltipH - 4, tooltip.y + 8);
              }
            })(),
            zIndex: 5,
          }}
        >
          {tooltip.ohlc ? (
            <div className="tabular-nums text-[10px] leading-relaxed">
              <div className="grid grid-cols-2 gap-x-2">
                <span><span className="text-muted-foreground">O </span><span className="text-foreground font-medium">{formatPriceUs(tooltip.ohlc.open)}</span></span>
                <span><span className="text-muted-foreground">H </span><span className="text-emerald-400 font-medium">{formatPriceUs(tooltip.ohlc.high)}</span></span>
                <span><span className="text-muted-foreground">L </span><span className="text-red-400 font-medium">{formatPriceUs(tooltip.ohlc.low)}</span></span>
                <span><span className="text-muted-foreground">C </span><span className="text-foreground font-medium">{formatPriceUs(tooltip.ohlc.close)}</span></span>
              </div>
            </div>
          ) : (
            <div className="font-semibold tabular-nums text-foreground">{tooltipBits.price}</div>
          )}
          <div className="text-muted-foreground">{tooltipBits.date}</div>
          <div className="text-muted-foreground">{tooltipBits.time} UTC+5:30</div>
        </div>
      )}

      {/* Prev close label on right axis */}
      {prevClose != null && prevCloseY != null && Number.isFinite(prevCloseY) && (
        <div
          data-testid="prev-close-label"
          className="pointer-events-none absolute right-2 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
          style={{
            top: Math.max(2, prevCloseY - 8),
            backgroundColor: 'rgba(107, 114, 128, 0.9)',
            zIndex: 3,
          }}
        >
          Prev close {formatPriceUs(prevClose)}
        </div>
      )}

      {latest && latestY != null && (
        <div
          className="pointer-events-none absolute right-2 rounded px-2 py-0.5 text-[11px] font-semibold text-white"
          style={{
            top: Math.max(4, latestY - 10),
            backgroundColor: pillDown ? RED_LINE : GREEN_LINE,
            zIndex: 4,
          }}
        >
          {formatPriceUs(latest.close)}
        </div>
      )}
    </div>
  );
}
