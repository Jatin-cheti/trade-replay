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

export function useChart(
  data: CandleData[],
  visibleCount: number,
  chartType: ChartType,
  onResize?: () => void,
  mountKey = 'default',
  parityMode = false,
  parityRoute: 'simulation' | 'live' | null = null,
) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createTradingChart> | null>(null);
  const seriesMapRef = useRef<ChartSeriesMap | null>(null);
  const resizeDebounceRef = useRef<number | null>(null);
  const lastLengthRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const isDetachedFromRealtimeRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [chartGeneration, setChartGeneration] = useState(0);

  const transformedData = useMemo(() => transformChartData(data, visibleCount, parityMode), [data, visibleCount, parityMode]);

  const getActiveSeries = useCallback(() => {
    const map = seriesMapRef.current;
    if (!map) return null;
    return activeSeriesForType(map, chartType);
  }, [chartType]);

  useEffect(() => {
    const container = chartContainerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay) return;

    const chart = createTradingChart(container, {
      parityMode,
      viewMode: mountKey === 'full' ? 'full' : 'normal',
    });
    const seriesMap = createChartSeries(chart, { parityMode });
    chartRef.current = chart;
    seriesMapRef.current = seriesMap;
    // New chart instance: force next data pass to use full setData sync.
    lastLengthRef.current = 0;
    lastTimeRef.current = null;
    isDetachedFromRealtimeRef.current = false;
    setChartGeneration((value) => value + 1);

    let disposed = false;
    const resizeRetryTimers: number[] = [];
    let lastDpr = window.devicePixelRatio || 1;

    const flushResizeTimers = () => {
      while (resizeRetryTimers.length) {
        const timer = resizeRetryTimers.pop();
        if (timer != null) {
          window.clearTimeout(timer);
        }
      }
    };

    const resizeOnce = () => {
      if (disposed) return false;
      const activeChart = chartRef.current;
      const activeContainer = chartContainerRef.current;
      const activeOverlay = overlayRef.current;
      if (!activeChart || !activeContainer || !activeOverlay) return false;

      // Full-view transitions can briefly report 0x0; retry until layout settles.
      if (activeContainer.clientWidth <= 0 || activeContainer.clientHeight <= 0) {
        return false;
      }

      resizeChartSurface(activeChart, activeContainer, activeOverlay);
      onResize?.();
      return true;
    };

    const scheduleResizeRetries = (delays = [0, 16, 64, 140, 260]) => {
      flushResizeTimers();
      for (const delay of delays) {
        const timer = window.setTimeout(() => {
          if (disposed) return;
          resizeOnce();
        }, delay);
        resizeRetryTimers.push(timer);
      }
    };

    scheduleResizeRetries();

    const syncDetachState = () => {
      const position = chart.timeScale().scrollPosition();
      isDetachedFromRealtimeRef.current = position != null && position > 0.5;
    };

    const handleViewportChange = () => {
      scheduleResizeRetries();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleResizeRetries([0, 40, 140]);
      }
    };

    chart.timeScale().subscribeVisibleTimeRangeChange(syncDetachState);
    container.addEventListener('wheel', syncDetachState, { passive: true });
    container.addEventListener('pointerup', syncDetachState);
    container.addEventListener('touchend', syncDetachState, { passive: true });
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('pageshow', handleViewportChange);
    document.addEventListener('fullscreenchange', handleViewportChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    syncDetachState();

    const observer = new ResizeObserver(() => {
      if (resizeDebounceRef.current != null) {
        window.clearTimeout(resizeDebounceRef.current);
      }
      resizeDebounceRef.current = window.setTimeout(() => {
        const currentDpr = window.devicePixelRatio || 1;
        if (Math.abs(currentDpr - lastDpr) > 0.001) {
          lastDpr = currentDpr;
        }
        if (!resizeOnce()) {
          scheduleResizeRetries([16, 60, 180]);
        }
      }, 90);
    });

    observer.observe(container);
    setReady(true);

    return () => {
      disposed = true;
      flushResizeTimers();
      if (resizeDebounceRef.current != null) {
        window.clearTimeout(resizeDebounceRef.current);
      }
      try {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(syncDetachState);
      } catch {
        // Chart may already be disposed.
      }
      container.removeEventListener('wheel', syncDetachState);
      container.removeEventListener('pointerup', syncDetachState);
      container.removeEventListener('touchend', syncDetachState);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('pageshow', handleViewportChange);
      document.removeEventListener('fullscreenchange', handleViewportChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesMapRef.current = null;
      lastLengthRef.current = 0;
      lastTimeRef.current = null;
      isDetachedFromRealtimeRef.current = false;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountKey, parityMode]);

  useEffect(() => {
    const map = seriesMapRef.current;
    const chart = chartRef.current;
    const container = chartContainerRef.current;
    if (!ready || !map || !chart) return;

    const timeScale = chart.timeScale();
    const wasDetachedFromRealtime = isDetachedFromRealtimeRef.current;
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
      if (container) container.dataset.chartSyncMode = 'tail';
    } else {
      applySeriesData(map, transformedData);
      if (container) container.dataset.chartSyncMode = 'full';
    }

    if (container) {
      container.dataset.chartDataLength = String(nextLength);
      container.dataset.chartVisibleLength = String(transformedData.ohlcRows.length);
      container.dataset.chartLastTime = nextLast == null ? '' : String(nextLast);
    }

    if (parityMode && nextLength > 0) {
      const plotWidth = Math.max(120, (container?.clientWidth ?? 0) - 68);
      // TradingView uses slightly different effective density in normal vs full layouts.
      const isFullView = mountKey === 'full';
      const barsPerPxDivisor = isFullView ? 6.14 : 6.1;
      const rightPaddingBars = !isFullView && parityRoute === 'live' ? 6.1 : 5.8;

      const targetBars = clamp(
        Math.round(plotWidth / barsPerPxDivisor),
        isFullView ? 60 : 60,
        isFullView ? 320 : 240,
      );
      const rangeTo = (nextLength - 1) + rightPaddingBars;
      const rangeFrom = Math.max(0, rangeTo - targetBars);
      timeScale.setVisibleLogicalRange({ from: rangeFrom, to: rangeTo });
      isDetachedFromRealtimeRef.current = false;
    } else if (wasDetachedFromRealtime) {
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
    isDetachedFromRealtimeRef.current = parityMode
      ? false
      : (postPosition != null && postPosition > 0.5);

    lastLengthRef.current = nextLength;
    lastTimeRef.current = nextLast;
  }, [ready, transformedData, chartGeneration, mountKey, parityMode, parityRoute]);

  useEffect(() => {
    const map = seriesMapRef.current;
    if (!ready || !map) return;
    applySeriesVisibility(map, chartType);
  }, [chartType, ready]);

  const pointerToDataPoint = useCallback((clientX: number, clientY: number, snapMode: CrosshairSnapMode, magnetMode: boolean) => {
    const overlay = overlayRef.current;
    const chart = chartRef.current;
    const series = getActiveSeries();
    if (!overlay || !chart || !series) return null;

    const rect = overlay.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    // Avoid exact edges where coordinate transforms can transiently return null during fullscreen resizes.
    const edgeEpsilon = 0.5;
    const x = clamp(clientX - rect.left, edgeEpsilon, Math.max(edgeEpsilon, rect.width - edgeEpsilon));
    const y = clamp(clientY - rect.top, edgeEpsilon, Math.max(edgeEpsilon, rect.height - edgeEpsilon));

    let rawTime = chart.timeScale().coordinateToTime(x);
    const rawPrice = series.coordinateToPrice(y);

    if (rawTime == null) {
      const fallbackTime = chart.timeScale().coordinateToTime(x - 1) ?? chart.timeScale().coordinateToTime(x + 1);
      rawTime = fallbackTime;
    }

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

    if (magnetMode) {
      const baseRange = Math.max(1e-6, candle.high - candle.low, Math.abs(candle.close - candle.open));
      const exponent = Math.floor(Math.log10(baseRange));
      const baseStep = Math.pow(10, exponent);
      const gridStep = Math.max(baseStep / 2, Math.abs(rawPrice) * 0.0001, 0.0001);
      const snappedToGrid = Math.round(rawPrice / gridStep) * gridStep;
      if (Math.abs(snappedToGrid - rawPrice) < Math.abs(snapped - rawPrice) * 0.9) {
        snapped = snappedToGrid;
      }
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
