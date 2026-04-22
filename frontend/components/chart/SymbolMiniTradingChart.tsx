import { useEffect, useMemo, useRef, useState } from 'react';
import type { CandleData } from '@/data/stockData';
import { createTradingChart, resizeChartSurface } from '@/services/chart/chartEngine';
import {
  activeSeriesForType,
  applySeriesData,
  applySeriesVisibility,
  createChartSeries,
  type ChartSeriesMap,
} from '@/services/chart/seriesManager';
import { transformChartData, type ChartType } from '@/services/chart/dataTransforms';
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

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    price: number;
    time: UTCTimestamp;
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

    const observer = new ResizeObserver(() => resize());
    observer.observe(container);

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

      let snapTime: UTCTimestamp;
      let snapPrice: number;

      if (p.time != null && p.price != null) {
        // Mouse is over an actual data bar — use it directly.
        snapTime  = p.time;
        snapPrice = p.price;
      } else {
        // Mouse is in empty space (before first bar or after last bar).
        // Snap to the nearest row using the x fraction across the container.
        const containerWidth = containerRef.current?.clientWidth ?? 800;
        const fraction = Math.max(0, Math.min(1, p.point.x / containerWidth));
        const nearestIndex = Math.round(fraction * (rows.length - 1));
        const clamped = Math.max(0, Math.min(rows.length - 1, nearestIndex));
        const nearestRow = rows[clamped];
        snapTime  = nearestRow.time as UTCTimestamp;
        snapPrice = nearestRow.close;
      }

      setTooltip({ x: p.point.x, y: p.point.y, price: snapPrice, time: snapTime });
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
      const toTs = times[times.length - 1].time;

      // Compute bar spacing so all bars fill the container width exactly.
      const containerWidth = containerRef.current?.clientWidth ?? 800;
      const idealBarSpacing = Math.max(0.5, Math.min((containerWidth - 60) / times.length, 8));
      chartRef.current?.timeScale().applyOptions({
        barSpacing: idealBarSpacing,
        rightOffset: 0,
        fixLeftEdge: true,
        fixRightEdge: true,
      });

      // Set exact visible range so all bars span the full container width.
      try {
        chartRef.current?.timeScale().setVisibleRange({ from: fromTs, to: toTs });
      } catch {
        chartRef.current?.timeScale().scrollToRealTime();
      }
    } else {
      chartRef.current?.timeScale().scrollToRealTime();
    }
  }, [chartType, ready, transformed, isUp, timePeriod]);

  useEffect(() => {
    const series = prevCloseSeriesRef.current;
    const rows = transformed.ohlcRows;
    if (!series || !ready) return;
    if (prevClose == null || !Number.isFinite(prevClose) || rows.length < 2) {
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
  }, [prevClose, ready, transformed]);

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

      {!hasData && (
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
              const tooltipW = 140;
              if (tooltip.x > containerW / 2) {
                return Math.max(4, tooltip.x - tooltipW - 16);
              } else {
                return Math.min(containerW - tooltipW - 4, tooltip.x + 16);
              }
            })(),
            top: (() => {
              const containerH = containerRef.current?.clientHeight ?? 400;
              const tooltipH = 60;
              if (tooltip.y > containerH / 2) {
                return Math.max(4, tooltip.y - tooltipH - 8);
              } else {
                return Math.min(containerH - tooltipH - 4, tooltip.y + 8);
              }
            })(),
            zIndex: 5,
          }}
        >
          <div className="font-semibold tabular-nums text-foreground">{tooltipBits.price}</div>
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
