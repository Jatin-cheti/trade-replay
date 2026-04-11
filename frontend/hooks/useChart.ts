import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UTCTimestamp } from '@tradereplay/charts';
import type { CandleData } from '@/data/stockData';
import { createTradingChart, resizeChartSurface } from '@/services/chart/chartEngine';
import {
  activeSeriesForType,
  applySeriesData,
  applySeriesVisibility,
  createChartSeries,
  updateSeriesData,
  type ChartSeriesMap,
} from '@/services/chart/seriesManager';
import { transformChartData, type ChartType } from '@/services/chart/dataTransforms';
import { nearestCandleIndex, toTimestampFromTime } from '@/services/tools/toolEngine';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type CrosshairSnapMode = 'free' | 'time' | 'ohlc';

export function useChart(data: CandleData[], visibleCount: number, chartType: ChartType, onResize?: () => void) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createTradingChart> | null>(null);
  const seriesMapRef = useRef<ChartSeriesMap | null>(null);
  const resizeDebounceRef = useRef<number | null>(null);
  const lastLengthRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const isUserInteractingRef = useRef(false);
  const interactionResetTimerRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  const transformedData = useMemo(() => transformChartData(data, visibleCount), [data, visibleCount]);

  const getActiveSeries = useCallback(() => {
    const map = seriesMapRef.current;
    if (!map) return null;
    return activeSeriesForType(map, chartType);
  }, [chartType]);

  useEffect(() => {
    const container = chartContainerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    const chart = createTradingChart(container);
    const seriesMap = createChartSeries(chart);
    chartRef.current = chart;
    seriesMapRef.current = seriesMap;

    resizeChartSurface(chart, container, overlay);

    const markInteracting = () => {
      isUserInteractingRef.current = true;
      if (interactionResetTimerRef.current != null) {
        window.clearTimeout(interactionResetTimerRef.current);
      }
      interactionResetTimerRef.current = window.setTimeout(() => {
        const currentPosition = chartRef.current?.timeScale().scrollPosition();
        if (currentPosition != null && currentPosition <= 0.5) {
          isUserInteractingRef.current = false;
        }
      }, 1200);
    };

    container.addEventListener('wheel', markInteracting, { passive: true });
    container.addEventListener('pointerdown', markInteracting);
    container.addEventListener('touchstart', markInteracting, { passive: true });

    const observer = new ResizeObserver(() => {
      if (resizeDebounceRef.current != null) {
        window.clearTimeout(resizeDebounceRef.current);
      }
      resizeDebounceRef.current = window.setTimeout(() => {
        if (!chartRef.current || !chartContainerRef.current || !overlayRef.current) return;
        resizeChartSurface(chartRef.current, chartContainerRef.current, overlayRef.current);
        onResize?.();
      }, 90);
    });

    observer.observe(container);
    setReady(true);

    return () => {
      if (interactionResetTimerRef.current != null) {
        window.clearTimeout(interactionResetTimerRef.current);
      }
      if (resizeDebounceRef.current != null) {
        window.clearTimeout(resizeDebounceRef.current);
      }
      container.removeEventListener('wheel', markInteracting);
      container.removeEventListener('pointerdown', markInteracting);
      container.removeEventListener('touchstart', markInteracting);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesMapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = seriesMapRef.current;
    const chart = chartRef.current;
    if (!map || !chart) return;

    const timeScale = chart.timeScale();
    const previousLogicalRange = timeScale.getVisibleLogicalRange();
    const previousScrollPosition = timeScale.scrollPosition();
    const nextLength = transformedData.ohlcRows.length;
    const nextLast = nextLength > 0 ? Number(transformedData.ohlcRows[nextLength - 1].time) : null;
    const prevLength = lastLengthRef.current;
    const prevLast = lastTimeRef.current;

    const isAppend = prevLength > 0 && nextLength === prevLength + 1 && prevLast != null && nextLast != null && nextLast > prevLast;
    const isReplaceTail = prevLength > 0 && nextLength === prevLength && prevLast != null && nextLast != null && nextLast === prevLast;

    if (isAppend || isReplaceTail) {
      updateSeriesData(map, transformedData);
    } else {
      applySeriesData(map, transformedData);
      isUserInteractingRef.current = false;
    }

    if (isUserInteractingRef.current) {
      if (previousScrollPosition != null && Number.isFinite(previousScrollPosition)) {
        timeScale.applyOptions({ rightOffset: previousScrollPosition });
      }
      if (previousLogicalRange) {
        timeScale.setVisibleLogicalRange(previousLogicalRange);
      }
      if (previousScrollPosition != null && Number.isFinite(previousScrollPosition)) {
        timeScale.scrollToPosition(previousScrollPosition, false);
      }
    } else {
      timeScale.scrollToRealTime();
    }

    const postPosition = timeScale.scrollPosition();
    if (postPosition != null && postPosition <= 0.5) {
      isUserInteractingRef.current = false;
    }

    lastLengthRef.current = nextLength;
    lastTimeRef.current = nextLast;
  }, [transformedData]);

  useEffect(() => {
    const map = seriesMapRef.current;
    if (!map) return;
    applySeriesVisibility(map, chartType);
  }, [chartType]);

  const pointerToDataPoint = useCallback((clientX: number, clientY: number, snapMode: CrosshairSnapMode, magnetMode: boolean) => {
    const overlay = overlayRef.current;
    const chart = chartRef.current;
    const series = getActiveSeries();
    if (!overlay || !chart || !series) return null;

    const rect = overlay.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);

    const rawTime = chart.timeScale().coordinateToTime(x);
    const rawPrice = series.coordinateToPrice(y);

    const time = toTimestampFromTime(rawTime);
    if (time == null || rawPrice == null || Number.isNaN(rawPrice)) return null;

    const effectiveSnapMode = magnetMode ? 'ohlc' : snapMode;
    if (!transformedData.times.length || effectiveSnapMode === 'free') {
      return { time, price: rawPrice };
    }

    const idx = nearestCandleIndex(transformedData.times, time);
    if (idx < 0) return { time, price: rawPrice };
    const candle = transformedData.ohlcRows[idx];

    if (effectiveSnapMode === 'time') {
      return { time: candle.time, price: rawPrice };
    }

    const prices = [candle.open, candle.high, candle.low, candle.close];
    let snapped = prices[0];
    for (let i = 1; i < prices.length; i += 1) {
      if (Math.abs(prices[i] - rawPrice) < Math.abs(snapped - rawPrice)) snapped = prices[i];
    }

    return { time: candle.time, price: snapped };
  }, [getActiveSeries, transformedData.ohlcRows, transformedData.times]);

  const zoomToRange = useCallback((from: UTCTimestamp, to: UTCTimestamp) => {
    chartRef.current?.timeScale().setVisibleRange({ from: Math.min(from, to), to: Math.max(from, to) });
  }, []);

  return {
    ready,
    chartContainerRef,
    overlayRef,
    chartRef,
    getActiveSeries,
    transformedData,
    pointerToDataPoint,
    zoomToRange,
  };
}
