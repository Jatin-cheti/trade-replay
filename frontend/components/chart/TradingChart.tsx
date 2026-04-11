import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { listIndicators, getGlobalPerfTelemetry } from '@tradereplay/charts';
import type { CandleData } from '@/data/stockData';
import { toTimestamp, type ChartType } from '@/services/chart/dataTransforms';
import { getToolDefinition, type DrawPoint, type Drawing, type ToolCategory } from '@/services/tools/toolRegistry';
import { rgbFromHex } from '@/services/tools/toolOptions';
import { nearestCandleIndex, selectNearestDrawingId } from '@/services/tools/toolEngine';
import { DrawingTimeIndex } from '@/services/tools/drawingTimeIndex';
import { useChart, type CrosshairSnapMode } from '@/hooks/useChart';
import { useTools } from '@/hooks/useTools';
import { useIsMobile } from '@/hooks/use-mobile';
import ChartCanvas from '@/components/chart/ChartCanvas';
import ToolRail from '@/components/chart/ToolRail';
import ChartTopBar from '@/components/chart/ChartTopBar';
import ToolOptionsPanel from '@/components/chart/ToolOptionsPanel';
import ObjectTreePanel from '@/components/chart/ObjectTreePanel';

interface TradingChartProps {
  data: CandleData[];
  visibleCount: number;
  symbol: string;
  mode?: 'simulation' | 'live';
}

const TOP_INDICATOR_IDS = ['sma', 'ema', 'vwap', 'rsi', 'macd'] as const;

function makeIndicatorAcronym(name: string): string {
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toLowerCase() ?? '')
    .join('');
}

function drawText(ctx: CanvasRenderingContext2D, drawing: Drawing, x: number, y: number, text: string) {
  const weight = drawing.options.bold ? '700' : '400';
  const italic = drawing.options.italic ? 'italic' : 'normal';
  ctx.font = `${italic} ${weight} ${drawing.options.textSize}px ${drawing.options.font}, sans-serif`;
  const pad = drawing.options.textPadding;

  if (drawing.options.textBackground) {
    const m = ctx.measureText(text);
    ctx.fillStyle = 'rgba(8, 18, 30, 0.75)';
    ctx.fillRect(x - pad, y - drawing.options.textSize - pad, m.width + pad * 2, drawing.options.textSize + pad * 1.5);
    if (drawing.options.textBorder) {
      ctx.strokeStyle = `rgba(${rgbFromHex(drawing.options.color)}, 0.8)`;
      ctx.strokeRect(x - pad, y - drawing.options.textSize - pad, m.width + pad * 2, drawing.options.textSize + pad * 1.5);
    }
  }

  ctx.fillStyle = `rgba(${rgbFromHex(drawing.options.color)}, ${drawing.options.opacity})`;
  ctx.strokeStyle = 'rgba(8, 20, 37, 0.95)';
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function formatExportTimestamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}`;
}

export default function TradingChart({ data, visibleCount, symbol, mode = 'simulation' }: TradingChartProps) {
  const isMobile = useIsMobile();
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [expandedCategory, setExpandedCategory] = useState<ToolCategory | null>('trend');
  const [magnetMode, setMagnetMode] = useState(false);
  const [crosshairSnapMode, setCrosshairSnapMode] = useState<CrosshairSnapMode>(() => {
    if (typeof window === 'undefined') return 'free';
    const stored = window.localStorage.getItem('chart-crosshair-snap-mode');
    if (stored === 'time' || stored === 'ohlc' || stored === 'free') return stored;
    return 'free';
  });
  const [showGoLive, setShowGoLive] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [indicatorSearch, setIndicatorSearch] = useState('');
  const [highlightedResultIndex, setHighlightedResultIndex] = useState(0);
  const [enabledIndicators, setEnabledIndicators] = useState<string[]>([]);
  const [treeOpen, setTreeOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(max-width: 767px)').matches;
  });
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [dragAnchor, setDragAnchor] = useState<{ drawingId: string; anchorIndex: number } | null>(null);
  const dragMoveRef = useRef<{ drawingId: string; startPoint: DrawPoint; currentPoint: DrawPoint; originalAnchors: DrawPoint[] } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<DrawPoint | null>(null);
  const [touchMode, setTouchMode] = useState<'idle' | 'pan' | 'axis-zoom' | 'scroll' | 'pinch'>('idle');
  const touchStartRef = useRef<{ x: number; y: number; zone: 'left' | 'center' | 'right' } | null>(null);
  const touchRafRef = useRef<number | null>(null);
  const indicatorSearchInputRef = useRef<HTMLInputElement | null>(null);
  const drawingIndexRef = useRef(new DrawingTimeIndex());

  const {
    toolState,
    drawingsRef,
    draftRef,
    drawingActiveRef,
    setVariant,
    setOptions,
    startDraft,
    updateDraft,
    finalizeDraft,
    cancelDraft,
    updateDrawing,
    removeDrawing,
    clearDrawings,
    undo,
    redo,
    resetForSymbol,
  } = useTools();

  const resizeCallbackRef = useRef<(() => void) | null>(null);
  const { ready, chartContainerRef, overlayRef, chartRef, getActiveSeries, pointerToDataPoint, zoomToRange, transformedData } = useChart(data, visibleCount, chartType, () => resizeCallbackRef.current?.());
  const indicatorInstancesRef = useRef<Record<string, string>>({});
  const indicatorCatalog = useMemo(() => {
    return listIndicators()
      .map((indicator) => {
        const id = indicator.id.trim();
        const normalizedName = indicator.name.trim();
        const aliasSet = new Set<string>([id.toLowerCase(), normalizedName.toLowerCase(), makeIndicatorAcronym(normalizedName)]);
        return {
          id,
          name: normalizedName,
          aliases: Array.from(aliasSet),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const indicatorById = useMemo(
    () => new Map(indicatorCatalog.map((indicator) => [indicator.id, indicator])),
    [indicatorCatalog]
  );
  const topIndicatorIds = useMemo(() => {
    const available = new Set(indicatorCatalog.map((indicator) => indicator.id));
    return TOP_INDICATOR_IDS.filter((id) => available.has(id));
  }, [indicatorCatalog]);
  const topIndicators = useMemo(
    () => topIndicatorIds.map((id) => indicatorById.get(id)).filter(Boolean) as Array<{ id: string; name: string; aliases: string[] }>,
    [indicatorById, topIndicatorIds]
  );
  const filteredIndicators = useMemo(() => {
    const query = indicatorSearch.trim().toLowerCase();
    if (!query) return [] as Array<{ id: string; name: string; aliases: string[] }>;
    return indicatorCatalog.filter((indicator) => {
      if (indicator.id.toLowerCase().includes(query)) return true;
      if (indicator.name.toLowerCase().includes(query)) return true;
      return indicator.aliases.some((alias) => alias.includes(query));
    });
  }, [indicatorCatalog, indicatorSearch]);

  const addIndicator = useCallback((indicatorId: string) => {
    let added = false;
    setEnabledIndicators((prev) => {
      if (prev.includes(indicatorId)) return prev;
      added = true;
      return [...prev, indicatorId];
    });
    if (added) {
      setIndicatorSearch('');
      setHighlightedResultIndex(0);
    }
    return added;
  }, []);

  const removeEnabledIndicator = useCallback((indicatorId: string) => {
    setEnabledIndicators((prev) => prev.filter((id) => id !== indicatorId));
  }, []);

  const applyTouchMode = useCallback((mode: 'idle' | 'pan' | 'axis-zoom' | 'scroll' | 'pinch') => {
    const chart = chartRef.current;
    if (!chart) return;

    if (touchRafRef.current != null) {
      window.cancelAnimationFrame(touchRafRef.current);
      touchRafRef.current = null;
    }

    touchRafRef.current = window.requestAnimationFrame(() => {
      touchRafRef.current = null;
      if (!chartRef.current) return;
      switch (mode) {
        case 'pan':
          chartRef.current.applyOptions({
            handleScroll: { horzTouchDrag: true, vertTouchDrag: false },
            handleScale: { pinch: true, axisPressedMouseMove: { time: true, price: true } },
          });
          break;
        case 'axis-zoom':
          chartRef.current.applyOptions({
            handleScroll: { horzTouchDrag: false, vertTouchDrag: false },
            handleScale: { pinch: true, axisPressedMouseMove: { time: true, price: true } },
          });
          break;
        case 'scroll':
          chartRef.current.applyOptions({
            handleScroll: { horzTouchDrag: false, vertTouchDrag: false },
            handleScale: { pinch: true, axisPressedMouseMove: { time: true, price: true } },
          });
          break;
        case 'pinch':
          chartRef.current.applyOptions({
            handleScroll: { horzTouchDrag: false, vertTouchDrag: false },
            handleScale: { pinch: true, axisPressedMouseMove: { time: true, price: true } },
          });
          break;
        default:
          chartRef.current.applyOptions({
            handleScroll: { horzTouchDrag: true, vertTouchDrag: false },
            handleScale: { pinch: true, axisPressedMouseMove: { time: true, price: true } },
          });
      }
    });
  }, [chartRef]);

  const activeDefinition = useMemo(() => getToolDefinition(toolState.variant), [toolState.variant]);
  const selectedDrawing = useMemo(
    () => drawingsRef.current.find((drawing) => drawing.id === selectedDrawingId) || null,
    [drawingsRef, selectedDrawingId, toolState.drawings]
  );

  const translateAnchors = useCallback((anchors: DrawPoint[], from: DrawPoint, to: DrawPoint) => {
    const deltaTime = to.time - from.time;
    const deltaPrice = to.price - from.price;
    return anchors.map((anchor) => ({
      time: (anchor.time + deltaTime) as DrawPoint['time'],
      price: anchor.price + deltaPrice,
    }));
  }, []);

  const fallbackPoint = useCallback((): DrawPoint | null => {
    if (!data.length) return null;
    const idx = Math.max(0, Math.min(visibleCount - 1, data.length - 1));
    return { time: toTimestamp(data[idx].time), price: data[idx].close };
  }, [data, visibleCount]);

  const resolveLegendRow = useCallback((point: DrawPoint | null) => {
    if (!transformedData.ohlcRows.length) return null;
    if (!point) return transformedData.ohlcRows[transformedData.ohlcRows.length - 1] ?? null;
    const idx = nearestCandleIndex(transformedData.times, point.time);
    if (idx < 0) return transformedData.ohlcRows[transformedData.ohlcRows.length - 1] ?? null;
    return transformedData.ohlcRows[idx] ?? transformedData.ohlcRows[transformedData.ohlcRows.length - 1] ?? null;
  }, [transformedData.ohlcRows, transformedData.times]);

  const getVisibleTimeRange = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !transformedData.times.length) return null;
    const logical = chart.timeScale().getVisibleLogicalRange();
    if (!logical) return null;

    const startIndex = Math.max(0, Math.min(transformedData.times.length - 1, Math.floor(logical.from)));
    const endIndex = Math.max(startIndex, Math.min(transformedData.times.length - 1, Math.ceil(logical.to)));
    return {
      from: transformedData.times[startIndex],
      to: transformedData.times[endIndex],
    };
  }, [chartRef, transformedData.times]);

  const updateHoverPoint = useCallback((clientX: number, clientY: number) => {
    const point = pointerToDataPoint(clientX, clientY, crosshairSnapMode, false) ?? fallbackPoint();
    setHoverPoint(point);
  }, [crosshairSnapMode, fallbackPoint, pointerToDataPoint, transformedData.times]);

  useEffect(() => {
    try {
      window.localStorage.setItem('chart-crosshair-snap-mode', crosshairSnapMode);
    } catch {
      // Ignore restricted storage environments.
    }
  }, [crosshairSnapMode]);

  useEffect(() => {
    setHoverPoint(null);
  }, [symbol, transformedData]);

  useEffect(() => {
    const availableIds = new Set(indicatorCatalog.map((indicator) => indicator.id));
    setEnabledIndicators((prev) => prev.filter((id) => availableIds.has(id)));
  }, [indicatorCatalog]);

  useEffect(() => {
    if (!indicatorCatalog.length) {
      setIndicatorsOpen(false);
    }
  }, [indicatorCatalog]);

  useEffect(() => {
    if (!indicatorsOpen) {
      setIndicatorSearch('');
      setHighlightedResultIndex(0);
      return;
    }
    window.requestAnimationFrame(() => {
      indicatorSearchInputRef.current?.focus();
    });
  }, [indicatorsOpen]);

  useEffect(() => {
    setHighlightedResultIndex((prev) => {
      if (!filteredIndicators.length) return 0;
      return Math.min(prev, filteredIndicators.length - 1);
    });
  }, [filteredIndicators]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const currentInstances = indicatorInstancesRef.current;
    const enabledSet = new Set(enabledIndicators);

    for (const [indicatorId, instanceId] of Object.entries(currentInstances)) {
      if (enabledSet.has(indicatorId)) continue;
      try {
        chart.removeIndicator(instanceId);
      } catch {
        // Ignore indicator cleanup failures during rapid chart transitions.
      }
      delete currentInstances[indicatorId];
    }

    for (const indicatorId of enabledIndicators) {
      if (currentInstances[indicatorId]) continue;
      try {
        const instanceId = chart.addIndicator(indicatorId);
        currentInstances[indicatorId] = instanceId;
      } catch {
        // Ignore unknown/unsupported indicators and continue applying the rest.
      }
    }
  }, [chartRef, enabledIndicators, ready]);

  useEffect(() => {
    drawingIndexRef.current.rebuild(toolState.drawings);
  }, [toolState.drawings]);

  const rafRef = useRef<number | null>(null);
  const renderOverlay = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const overlayStart = performance.now();
      const overlay = overlayRef.current;
      const series = getActiveSeries();
      if (!overlay || !series) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      const cssWidth = overlay.clientWidth || 1;
      const cssHeight = overlay.clientHeight || 1;
      const dpr = overlay.width > 0 ? overlay.width / cssWidth : 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const toXY = (point: DrawPoint) => {
        const x = chartRef.current?.timeScale().timeToCoordinate(point.time);
        const y = series.priceToCoordinate(point.price);
        if (x == null || y == null) return null;
        return { x, y };
      };

      const moveState = dragMoveRef.current;

      const drawTool = (drawing: Drawing, draft = false) => {
        const activeDrawing = moveState?.drawingId === drawing.id
          ? { ...drawing, anchors: translateAnchors(moveState.originalAnchors, moveState.startPoint, moveState.currentPoint) }
          : drawing;

        if (!activeDrawing.visible || !activeDrawing.options.visible || !activeDrawing.anchors.length) return;
        const def = getToolDefinition(activeDrawing.variant);
        if (!def) return;

        const points = activeDrawing.anchors.map(toXY).filter(Boolean) as Array<{ x: number; y: number }>;
        if (!points.length) return;

        ctx.strokeStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, ${activeDrawing.options.opacity})`;
        ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.12)`;
        ctx.lineWidth = activeDrawing.options.thickness;
        ctx.setLineDash(draft ? [6, 4] : activeDrawing.options.style === 'dashed' ? [6, 4] : activeDrawing.options.style === 'dotted' ? [2, 4] : []);

        if (def.family === 'text') {
          const text = activeDrawing.text || activeDrawing.variant;
          drawText(ctx, activeDrawing, points[0].x + 4, points[0].y - 4, text);
        } else if (def.family === 'shape') {
          const p1 = points[0];
          const p2 = points[1] || p1;
          if (def.behaviors?.shapeKind === 'circle') {
            const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            ctx.beginPath();
            ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else if (def.behaviors?.shapeKind === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(p1.x, p2.y);
            ctx.lineTo((p1.x + p2.x) / 2, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else {
            const x = Math.min(p1.x, p2.x);
            const y = Math.min(p1.y, p2.y);
            const w = Math.abs(p2.x - p1.x);
            const h = Math.abs(p2.y - p1.y);
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
          }
        } else if (def.family === 'fib') {
          const p1 = points[0];
          const p2 = points[1] || p1;
          const levels = def.behaviors?.fibLevels || [0, 0.236, 0.382, 0.5, 0.618, 1];
          for (const level of levels) {
            const y = p1.y + (p2.y - p1.y) * level;
            ctx.beginPath();
            ctx.moveTo(Math.min(p1.x, p2.x), y);
            ctx.lineTo(Math.max(p1.x, p2.x), y);
            ctx.stroke();
            if (activeDrawing.options.priceLabel) drawText(ctx, activeDrawing, Math.max(p1.x, p2.x) + 4, y + 2, `${(level * 100).toFixed(1)}%`);
          }
        } else {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
          if (activeDrawing.options.extendLeft && points.length >= 2) {
            const p1 = points[0];
            const p2 = points[1];
            const m = (p2.y - p1.y) / ((p2.x - p1.x) || 1);
            ctx.moveTo(0, p1.y - m * p1.x);
            ctx.lineTo(p1.x, p1.y);
          }
          if (activeDrawing.options.extendRight && points.length >= 2) {
            const p1 = points[points.length - 2];
            const p2 = points[points.length - 1];
            const m = (p2.y - p1.y) / ((p2.x - p1.x) || 1);
            const w = cssWidth;
            ctx.moveTo(p2.x, p2.y);
            ctx.lineTo(w, p2.y + m * (w - p2.x));
          }
          ctx.stroke();
        }

        if (selectedDrawingId === activeDrawing.id) {
          for (const anchor of points) {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      };

      const visibleRange = getVisibleTimeRange();
      const visibleIds = visibleRange
        ? new Set(drawingIndexRef.current.query(visibleRange))
        : new Set(drawingsRef.current.map((drawing) => drawing.id));

      for (const drawing of drawingsRef.current) {
        if (!visibleIds.has(drawing.id) && drawing.id !== selectedDrawingId) continue;
        drawTool(drawing);
      }

      if (draftRef.current) drawTool(draftRef.current, true);

      getGlobalPerfTelemetry()?.record('overlay', performance.now() - overlayStart);
    });
  }, [chartRef, drawingsRef, draftRef, getActiveSeries, getVisibleTimeRange, overlayRef, selectedDrawingId, translateAnchors]);

  resizeCallbackRef.current = renderOverlay;

  const lastRenderAtRef = useRef(0);
  const lastDrawCommitAtRef = useRef(0);

  useEffect(() => {
    lastRenderAtRef.current = Date.now();
  });

  useEffect(() => {
    lastDrawCommitAtRef.current = Date.now();
  }, [toolState.drawings]);

  useEffect(() => {
    const debug = {
      getDrawingsCount: () => drawingsRef.current.length,
      getLastRenderAt: () => lastRenderAtRef.current,
      getLastDrawCommitAt: () => lastDrawCommitAtRef.current,
      getDrawings: () => drawingsRef.current,
      getMagnetMode: () => magnetMode,
      pointerToDataPoint: (clientX: number, clientY: number, snap: boolean) =>
        pointerToDataPoint(clientX, clientY, crosshairSnapMode, snap),
    };
    (window as unknown as Record<string, unknown>).__chartDebug = debug;
    return () => {
      delete (window as unknown as Record<string, unknown>).__chartDebug;
    };
  }, [crosshairSnapMode, drawingsRef, magnetMode, pointerToDataPoint]);

  useEffect(() => {
    renderOverlay();
  }, [renderOverlay, toolState.drawings, chartType, selectedDrawingId]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const requestOverlayRender = () => renderOverlay();
    container.addEventListener('wheel', requestOverlayRender, { passive: true });
    container.addEventListener('pointermove', requestOverlayRender, { passive: true });
    container.addEventListener('pointerup', requestOverlayRender);
    container.addEventListener('pointerleave', requestOverlayRender);

    return () => {
      container.removeEventListener('wheel', requestOverlayRender);
      container.removeEventListener('pointermove', requestOverlayRender);
      container.removeEventListener('pointerup', requestOverlayRender);
      container.removeEventListener('pointerleave', requestOverlayRender);
    };
  }, [chartContainerRef, renderOverlay]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const repaint = () => renderOverlay();
    chart.timeScale().subscribeVisibleTimeRangeChange(repaint);
    return () => {
      try {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(repaint);
      } catch {
        // Chart may have been removed.
      }
    };
  }, [chartRef, renderOverlay, ready]);

  useEffect(() => {
    resetForSymbol();
    setSelectedDrawingId(null);
  }, [resetForSymbol, symbol]);

  useEffect(() => {
    let pointerStartX: number | null = null;

    const readScrollOffset = () => {
      const position = chartRef.current?.timeScale().scrollPosition();
      setShowGoLive((position ?? 0) > 0.1);
    };

    const onPointerDown = (event: PointerEvent) => {
      pointerStartX = event.clientX;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerStartX != null && Math.abs(event.clientX - pointerStartX) > 28) {
        setShowGoLive(true);
      }
      pointerStartX = null;
      readScrollOffset();
    };

    const container = chartContainerRef.current;
    if (!container) return;
    readScrollOffset();

    container.addEventListener('wheel', readScrollOffset, { passive: true });
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointermove', readScrollOffset, { passive: true });
    const interval = window.setInterval(readScrollOffset, 300);

    return () => {
      window.clearInterval(interval);
      container.removeEventListener('wheel', readScrollOffset);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointermove', readScrollOffset);
    };
  }, [chartContainerRef, chartRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedDrawingId) {
        const d = drawingsRef.current.find((item) => item.id === selectedDrawingId);
        if (d?.locked) return;
        removeDrawing(selectedDrawingId);
        setSelectedDrawingId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawingsRef, removeDrawing, selectedDrawingId]);

  useEffect(() => {
    if (!isMobile) {
      setTreeOpen(true);
      applyTouchMode('idle');
      setTouchMode('idle');
      return;
    }

    setTreeOpen(false);
    applyTouchMode('scroll');
    setTouchMode('scroll');
  }, [applyTouchMode, isMobile]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!drawingActiveRef.current && !dragMoveRef.current) return;
      cancelDraft();
      dragMoveRef.current = null;
      setDragAnchor(null);
      renderOverlay();
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [cancelDraft, drawingActiveRef, renderOverlay]);

  useEffect(() => {
    return () => {
      if (touchRafRef.current != null) {
        window.cancelAnimationFrame(touchRafRef.current);
      }
    };
  }, []);

  const detectTouchZone = useCallback((clientX: number, width: number): 'left' | 'center' | 'right' => {
    if (clientX > width * 0.85) return 'right';
    if (clientX < width * 0.65) return 'left';
    return 'center';
  }, []);

  const onChartTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    if (event.touches.length >= 2) {
      setTouchMode('pinch');
      applyTouchMode('pinch');
      touchStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = touch.clientX - bounds.left;
    const zone = detectTouchZone(localX, bounds.width);
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, zone };
    setTouchMode(zone === 'center' ? 'scroll' : 'idle');
    applyTouchMode(zone === 'center' ? 'scroll' : 'idle');
  };

  const onChartTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    if (event.touches.length >= 2) {
      if (touchMode !== 'pinch') {
        setTouchMode('pinch');
        applyTouchMode('pinch');
      }
      return;
    }

    const start = touchStartRef.current;
    if (!start) return;
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (start.zone === 'center') {
      if (touchMode !== 'scroll') {
        setTouchMode('scroll');
        applyTouchMode('scroll');
      }
      return;
    }

    if (start.zone === 'right') {
      const shouldZoom = Math.abs(dy) >= Math.abs(dx);
      const next = shouldZoom ? 'axis-zoom' : 'scroll';
      if (touchMode !== next) {
        setTouchMode(next);
        applyTouchMode(next);
      }
      if (shouldZoom) {
        event.preventDefault();
      }
      return;
    }

    const shouldPan = Math.abs(dx) > Math.abs(dy);
    const next = shouldPan ? 'pan' : 'scroll';
    if (touchMode !== next) {
      setTouchMode(next);
      applyTouchMode(next);
    }
    if (shouldPan) {
      event.preventDefault();
    }
  };

  const onChartTouchEnd = () => {
    if (!isMobile) return;
    touchStartRef.current = null;
    setTouchMode('scroll');
    applyTouchMode('scroll');
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.focus({ preventScroll: true });
    const point = pointerToDataPoint(event.clientX, event.clientY, crosshairSnapMode, magnetMode) || fallbackPoint();
    if (!point) return;

    if (toolState.variant === 'none') {
      const visibleRange = getVisibleTimeRange();
      const visibleIds = visibleRange
        ? new Set(drawingIndexRef.current.query(visibleRange))
        : null;
      const candidates = visibleIds
        ? drawingsRef.current.filter((drawing) => visibleIds.has(drawing.id))
        : drawingsRef.current;

      const selected = selectNearestDrawingId(candidates, point);
      setSelectedDrawingId(selected);
      if (selected) {
        const drawing = drawingsRef.current.find((item) => item.id === selected);
        if (drawing && !drawing.locked) {
          const idx = drawing.anchors.findIndex((a) => Math.abs(a.time - point.time) < 86400 && Math.abs(a.price - point.price) < Math.max(0.2, point.price * 0.02));
          if (idx >= 0) {
            setDragAnchor({ drawingId: selected, anchorIndex: idx });
          } else {
            dragMoveRef.current = { drawingId: selected, startPoint: point, currentPoint: point, originalAnchors: drawing.anchors.map((anchor) => ({ ...anchor })) };
          }
        }
      }
      overlayRef.current?.setPointerCapture(event.pointerId);
      renderOverlay();
      return;
    }

    const text = activeDefinition?.capabilities.supportsText ? promptForVariantText(toolState.variant as Exclude<typeof toolState.variant, 'none'>) : undefined;
    const result = startDraft(point, text);
    if (result.kind === 'finalized') {
      const d = drawingsRef.current[drawingsRef.current.length - 1];
      if (d) setSelectedDrawingId(d.id);
    }
    renderOverlay();
    overlayRef.current?.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateHoverPoint(event.clientX, event.clientY);
    
    const point = pointerToDataPoint(event.clientX, event.clientY, crosshairSnapMode, magnetMode) || fallbackPoint();
    if (!point) return;

    if (dragMoveRef.current) {
      dragMoveRef.current = { ...dragMoveRef.current, currentPoint: point };
      renderOverlay();
      return;
    }

    if (dragAnchor) {
      updateDrawing(dragAnchor.drawingId, (drawing) => {
        const next = [...drawing.anchors];
        next[dragAnchor.anchorIndex] = point;
        return { ...drawing, anchors: next };
      });
      renderOverlay();
      return;
    }

    if (!drawingActiveRef.current) return;
    updateDraft(point);
    renderOverlay();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (overlayRef.current?.hasPointerCapture(event.pointerId)) overlayRef.current.releasePointerCapture(event.pointerId);
    if (dragMoveRef.current) {
      const move = dragMoveRef.current;
      const moved = drawingsRef.current.find((drawing) => drawing.id === move.drawingId);
      if (moved && !moved.locked) {
        const translated = translateAnchors(move.originalAnchors, move.startPoint, move.currentPoint);
        if (translated.some((anchor, index) => anchor.time !== moved.anchors[index]?.time || anchor.price !== moved.anchors[index]?.price)) {
          updateDrawing(move.drawingId, (drawing) => ({ ...drawing, anchors: translated }));
        }
      }
      dragMoveRef.current = null;
      renderOverlay();
      return;
    }

    if (dragAnchor) {
      setDragAnchor(null);
      renderOverlay();
      return;
    }

    const committed = finalizeDraft();
    if (toolState.variant === 'zoom' && committed?.anchors[1]) {
      zoomToRange(committed.anchors[0].time, committed.anchors[1].time);
      removeDrawing(committed.id);
    } else if (committed) {
      setSelectedDrawingId(committed.id);
    }
    renderOverlay();
  };

  const currentLegendRow = resolveLegendRow(hoverPoint);
  const currentLegendPoint = hoverPoint ?? (currentLegendRow ? { time: currentLegendRow.time, price: currentLegendRow.close } : null);
  const legendChangePct = currentLegendRow
    ? currentLegendRow.open !== 0
      ? ((currentLegendRow.close - currentLegendRow.open) / currentLegendRow.open) * 100
      : 0
    : 0;
  const legendChangeClass = legendChangePct >= 0 ? 'text-emerald-300' : 'text-rose-300';

  const onExportPng = useCallback(() => {
    const chartContainer = chartContainerRef.current;
    if (!chartContainer) return;

    const canvases = Array.from(chartContainer.querySelectorAll('canvas'));
    const overlay = overlayRef.current;
    if (overlay && !canvases.includes(overlay)) {
      canvases.push(overlay);
    }
    if (!canvases.length) return;

    const width = Math.max(1, chartContainer.clientWidth);
    const height = Math.max(1, chartContainer.clientHeight);
    const dpr = canvases.reduce((max, canvas) => {
      const local = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
      return Math.max(max, Number.isFinite(local) && local > 0 ? local : 1);
    }, 1);

    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(width * dpr));
    output.height = Math.max(1, Math.round(height * dpr));
    const ctx = output.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    for (const canvas of canvases) {
      ctx.drawImage(canvas, 0, 0, width, height);
    }

    const safeSymbol = symbol.replace(/[^A-Za-z0-9_-]+/g, '_');
    const timeframe = '1m';
    const filename = `${safeSymbol}-${timeframe}-${formatExportTimestamp(new Date())}.png`;

    const triggerDownload = (url: string) => {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    output.toBlob((blob) => {
      if (!blob) {
        triggerDownload(output.toDataURL('image/png'));
        return;
      }

      const url = URL.createObjectURL(blob);
      triggerDownload(url);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }, [chartContainerRef, overlayRef, symbol]);

  return (
    <div className="relative flex h-full w-full min-h-[340px] flex-col">
      {/* Top bar + rail + chart in a flex layout */}
      <ChartTopBar chartType={chartType} setChartType={setChartType} magnetMode={magnetMode} setMagnetMode={setMagnetMode} crosshairSnapMode={crosshairSnapMode} setCrosshairSnapMode={setCrosshairSnapMode} onUndo={undo} onRedo={redo} onClear={clearDrawings} onExportPng={onExportPng} optionsOpen={optionsOpen} setOptionsOpen={setOptionsOpen} indicatorsOpen={indicatorsOpen} setIndicatorsOpen={setIndicatorsOpen} activeIndicatorsCount={enabledIndicators.length} treeOpen={treeOpen} setTreeOpen={setTreeOpen} selectedDrawingVariant={selectedDrawing?.variant ?? null} isMobile={isMobile} />

      <div className="flex min-h-0 flex-1">
        {/* Tool Rail — thin left icon bar */}
        <ToolRail toolState={toolState} expandedCategory={expandedCategory} setExpandedCategory={setExpandedCategory} onVariant={(group, variant) => setVariant(variant, group)} isMobile={isMobile} />

        {/* Chart area — maximized */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="relative min-h-0 flex-1 overflow-hidden"
            onTouchStart={onChartTouchStart}
            onTouchMove={onChartTouchMove}
            onTouchEnd={onChartTouchEnd}
            onTouchCancel={onChartTouchEnd}
            onMouseMove={(event) => updateHoverPoint(event.clientX, event.clientY)}
            onMouseLeave={() => {
              setHoverPoint(null);
            }}
          >
            <div className="chart-wrapper h-full w-full touch-pan-y">
              <ChartCanvas chartContainerRef={chartContainerRef} overlayRef={overlayRef} activeVariant={toolState.variant} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onContextMenu={(e) => e.preventDefault()} />
            </div>

            <ToolOptionsPanel open={optionsOpen} options={toolState.options} optionsSchema={activeDefinition?.optionsSchema || []} onChange={setOptions} />

            {indicatorsOpen ? (
              <div data-testid="indicators-panel" className="absolute right-3 top-2 z-40 w-[320px] rounded-xl border border-primary/25 bg-background/90 p-2.5 backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Indicators</span>
                  <button
                    type="button"
                    onClick={() => setIndicatorsOpen(false)}
                    className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-2">
                  <div data-testid="indicators-top5" className="rounded-md border border-border/60 bg-background/60 p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Top 5</div>
                    <div className="flex flex-wrap gap-1.5">
                      {topIndicators.map((indicator) => {
                        const isActive = enabledIndicators.includes(indicator.id);
                        return (
                          <button
                            key={indicator.id}
                            type="button"
                            data-testid={`indicator-top5-${indicator.id}`}
                            onClick={() => {
                              addIndicator(indicator.id);
                              indicatorSearchInputRef.current?.focus();
                            }}
                            className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${isActive ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300' : 'border-border/70 bg-background/80 text-foreground hover:border-primary/40 hover:bg-primary/10'}`}
                          >
                            {indicator.id.toUpperCase()} {isActive ? 'Added' : 'Add'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <input
                      ref={indicatorSearchInputRef}
                      data-testid="indicators-search"
                      value={indicatorSearch}
                      onChange={(event) => {
                        setIndicatorSearch(event.target.value);
                        setHighlightedResultIndex(0);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setIndicatorsOpen(false);
                          return;
                        }
                        if (!filteredIndicators.length) return;
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          setHighlightedResultIndex((prev) => (prev + 1) % filteredIndicators.length);
                          return;
                        }
                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          setHighlightedResultIndex((prev) => (prev - 1 + filteredIndicators.length) % filteredIndicators.length);
                          return;
                        }
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          const selected = filteredIndicators[highlightedResultIndex];
                          if (selected) addIndicator(selected.id);
                        }
                      }}
                      placeholder="Search indicators"
                      className="w-full rounded-md border border-border/70 bg-background/70 px-2.5 py-2 text-[12px] text-foreground outline-none focus:border-primary/40"
                    />
                  </div>

                  <div data-testid="indicators-dropdown" className="rounded-md border border-border/60 bg-background/60 p-1.5">
                    {!indicatorSearch.trim() ? (
                      <div className="px-1 py-1 text-[11px] text-muted-foreground">All indicators (type to search)</div>
                    ) : null}
                    <div data-testid="indicators-results" className="max-h-44 space-y-1 overflow-y-auto">
                      {indicatorSearch.trim() ? (
                        filteredIndicators.length ? filteredIndicators.map((indicator, index) => {
                          const isHighlighted = index === highlightedResultIndex;
                          const isActive = enabledIndicators.includes(indicator.id);
                          return (
                            <button
                              key={indicator.id}
                              type="button"
                              data-testid={`indicator-option-${indicator.id}`}
                              onMouseEnter={() => setHighlightedResultIndex(index)}
                              onClick={() => addIndicator(indicator.id)}
                              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] ${isHighlighted ? 'bg-primary/20 text-foreground' : 'text-foreground hover:bg-primary/10'} ${isActive ? 'opacity-80' : ''}`}
                            >
                              <span className="truncate">{indicator.name}</span>
                              <span className={`ml-2 text-[10px] uppercase tracking-[0.08em] ${isActive ? 'text-emerald-300' : 'text-muted-foreground'}`}>{isActive ? 'Added' : indicator.id}</span>
                            </button>
                          );
                        }) : (
                          <div className="px-1 py-1 text-[11px] text-muted-foreground">No matching indicators.</div>
                        )
                      ) : null}
                    </div>
                  </div>

                  <div data-testid="indicators-active" className="rounded-md border border-border/60 bg-background/60 p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Active</div>
                    {enabledIndicators.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {enabledIndicators.map((indicatorId) => {
                          const indicator = indicatorById.get(indicatorId);
                          const label = indicator?.name ?? indicatorId.toUpperCase();
                          return (
                            <div key={indicatorId} className="inline-flex items-center gap-1 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
                              <span className="max-w-[170px] truncate">{label}</span>
                              <button
                                type="button"
                                data-testid={`indicator-remove-${indicatorId}`}
                                onClick={() => removeEnabledIndicator(indicatorId)}
                                className="rounded px-1 text-[10px] uppercase tracking-[0.08em] text-emerald-100 hover:bg-emerald-500/20"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">No active indicators yet.</div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {showGoLive ? (
              <button
                type="button"
                data-testid="chart-go-live"
                onClick={() => {
                  chartRef.current?.timeScale().scrollToRealTime();
                  setShowGoLive(false);
                  renderOverlay();
                }}
                className="absolute bottom-4 right-4 z-40 rounded-full border border-primary/55 bg-background/90 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-lg shadow-primary/10 transition hover:bg-primary/15"
              >
                Go to live
              </button>
            ) : null}
          </div>

          {/* OHLC status bar */}
          <div data-testid="ohlc-status" className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-primary/15 bg-background/60 px-3 py-1 backdrop-blur-xl">
            <div data-testid="chart-ohlc-legend" className="contents">
            {currentLegendRow ? (
              <>
                <div className="inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-foreground">O</span>
                  <span className="text-[11px] font-bold text-foreground tabular-nums">{currentLegendRow.open.toFixed(2)}</span>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-foreground">H</span>
                  <span className="text-[11px] font-bold text-foreground tabular-nums">{currentLegendRow.high.toFixed(2)}</span>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-foreground">L</span>
                  <span className="text-[11px] font-bold text-foreground tabular-nums">{currentLegendRow.low.toFixed(2)}</span>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-foreground">C</span>
                  <span className="text-[11px] font-bold text-foreground tabular-nums">{currentLegendRow.close.toFixed(2)}</span>
                </div>
                <span className={`text-[11px] font-bold tabular-nums ${legendChangeClass}`}>{legendChangePct >= 0 ? '+' : ''}{legendChangePct.toFixed(2)}%</span>
                <span className="mx-1 h-3 w-px bg-border/60" />
                <span className="text-[10px] tabular-nums uppercase tracking-wider text-muted-foreground">{currentLegendPoint ? new Date(Number(currentLegendPoint.time) * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ''}</span>
                <span className="mx-1 h-3 w-px bg-border/60" />
                <span className="text-[10px] tabular-nums text-muted-foreground">Cursor {currentLegendPoint ? currentLegendPoint.price.toFixed(2) : '--'}</span>
                <span className="mx-1 h-3 w-px bg-border/60" />
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary/80">{crosshairSnapMode}</span>
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground">No data</span>
            )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <ObjectTreePanel open={treeOpen} isMobile={isMobile} drawings={toolState.drawings} selectedDrawingId={selectedDrawingId} onSelect={setSelectedDrawingId} onToggleVisible={(id) => updateDrawing(id, (d) => ({ ...d, visible: !d.visible, options: { ...d.options, visible: !d.options.visible } }))} onToggleLocked={(id) => updateDrawing(id, (d) => ({ ...d, locked: !d.locked, options: { ...d.options, locked: !d.options.locked } }))} onDelete={removeDrawing} onTogglePanel={() => setTreeOpen((prev) => !prev)} />
      </div>

      <div data-testid="drawing-badge" className="mt-1 rounded-lg border border-primary/20 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur-xl">
        {symbol} · {mode} · {chartType} · {toolState.drawings.length} drawing{toolState.drawings.length === 1 ? '' : 's'} · tool: {toolState.variant} · magnet: {magnetMode ? 'on' : 'off'}
      </div>
    </div>
  );
}

function promptForVariantText(variant: Exclude<import('@/services/tools/toolRegistry').ToolVariant, 'none'>) {
  if (variant === 'emoji') return window.prompt('Emoji', '🚀') || '🚀';
  if (variant === 'priceLabel') return '';
  return window.prompt('Text', 'Label') || 'Label';
}
