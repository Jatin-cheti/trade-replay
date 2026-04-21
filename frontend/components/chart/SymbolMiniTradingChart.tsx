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

interface SymbolMiniTradingChartProps {
  data: CandleData[];
  height?: number | string;
  chartType: ChartType;
}

export default function SymbolMiniTradingChart({
  data,
  height = 340,
  chartType,
}: SymbolMiniTradingChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createTradingChart> | null>(null);
  const seriesMapRef = useRef<ChartSeriesMap | null>(null);
  const [ready, setReady] = useState(false);

  const transformed = useMemo(() => transformChartData(data, data.length), [data]);

  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    const chart = createTradingChart(container, { parityMode: false, viewMode: 'normal' });
    const seriesMap = createChartSeries(chart, { parityMode: false });
    chartRef.current = chart;
    seriesMapRef.current = seriesMap;

    const resize = () => {
      if (!chartRef.current || !containerRef.current || !overlayRef.current) return;
      resizeChartSurface(chartRef.current, containerRef.current, overlayRef.current);
    };

    resize();

    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(container);

    setReady(true);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesMapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const seriesMap = seriesMapRef.current;
    if (!ready || !seriesMap) return;

    applySeriesData(seriesMap, transformed);
    applySeriesVisibility(seriesMap, chartType);
    // Fit all data into the visible range so the x-axis spans the full
    // selected period instead of a narrow default window.
    const times = transformed.ohlcRows;
    if (times.length >= 2) {
      try {
        chartRef.current?.timeScale().setVisibleRange({
          from: times[0].time,
          to: times[times.length - 1].time,
        });
      } catch {
        chartRef.current?.timeScale().scrollToRealTime();
      }
    } else {
      chartRef.current?.timeScale().scrollToRealTime();
    }
  }, [chartType, ready, transformed]);

  const hasData = transformed.ohlcRows.length > 1;
  const activeSeries = ready && seriesMapRef.current
    ? activeSeriesForType(seriesMapRef.current, chartType)
    : null;

  const latest = transformed.ohlcRows[transformed.ohlcRows.length - 1] ?? null;
  const previous = transformed.ohlcRows[transformed.ohlcRows.length - 2] ?? null;
  const latestY = latest && activeSeries ? activeSeries.priceToCoordinate(latest.close) : null;
  const isDown = latest && previous ? latest.close < previous.close : true;

  return (
    <div className="relative" style={{ height }}>
      {/*
        Note: The chart library's createChart() sets `container.style.position = 'relative'`
        on the container element, which overrides Tailwind's `absolute` class. We therefore
        use explicit width/height inline styles on the container div so its dimensions are
        preserved regardless of the position override.
      */}
      <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }} />
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0" />

      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          No chart data available
        </div>
      )}

      {latest && latestY != null && (
        <div
          className="pointer-events-none absolute right-2 rounded px-2 py-0.5 text-[11px] font-semibold text-white"
          style={{
            top: Math.max(4, latestY - 10),
            backgroundColor: isDown ? "hsl(var(--destructive))" : "hsl(var(--primary))",
          }}
        >
          {formatPriceUs(latest.close)}
        </div>
      )}
    </div>
  );
}
