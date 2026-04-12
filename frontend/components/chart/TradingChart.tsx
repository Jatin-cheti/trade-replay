import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { listIndicators, getGlobalPerfTelemetry } from '@tradereplay/charts';
import type { CandleData } from '@/data/stockData';
import { toTimestamp, type ChartType } from '@/services/chart/dataTransforms';
import { getToolDefinition, type CursorMode, type DrawPoint, type Drawing, type ToolCategory, type ToolVariant } from '@/services/tools/toolRegistry';
import { rgbFromHex } from '@/services/tools/toolOptions';
import { isPointOnlyVariant, nearestCandleIndex, selectNearestDrawingId } from '@/services/tools/toolEngine';
import { getParallelChannelGeometry, getPitchforkGeometry, getRaySegment, getRegressionTrendGeometry, snapTrendAngleSegment, type CanvasPoint, type PitchforkVariant } from '@/services/tools/drawingGeometry';
import { DrawingTimeIndex } from '@/services/tools/drawingTimeIndex';
import { useChart, type CrosshairSnapMode } from '@/hooks/useChart';
import { useTools } from '@/hooks/useTools';
import { useIsMobile } from '@/hooks/use-mobile';
import ChartCanvas from '@/components/chart/ChartCanvas';
import ToolRail from '@/components/chart/ToolRail';
import ChartTopBar from '@/components/chart/ChartTopBar';
import ToolOptionsPanel from '@/components/chart/ToolOptionsPanel';
import ObjectTreePanel from '@/components/chart/ObjectTreePanel';
import IndicatorsModal from '@/components/chart/IndicatorsModal';
import ChartPromptModal, { type ChartPromptRequest } from '@/components/chart/ChartPromptModal';
import type { IconPresetSelection } from '@/components/chart/IconToolPanel';

interface TradingChartProps {
  data: CandleData[];
  visibleCount: number;
  symbol: string;
  mode?: 'simulation' | 'live';
}

type TouchTooltipState = {
  point: DrawPoint;
  x: number;
  y: number;
};

const TOP_INDICATOR_IDS = ['sma', 'ema', 'vwap', 'rsi', 'macd'] as const;

const PATTERN_LABELS_BY_VARIANT: Partial<Record<ToolVariant, string[]>> = {
  xabcd: ['X', 'A', 'B', 'C', 'D'],
  cypherPattern: ['X', 'A', 'B', 'C', 'D'],
  headAndShoulders: ['LS', 'H', 'N', 'H', 'RS'],
  abcdPattern: ['A', 'B', 'C', 'D'],
  trianglePattern: ['A', 'B', 'C'],
  threeDrives: ['1', '2', '3', '4', '5', '6', '7'],
  elliottImpulse: ['1', '2', '3', '4', '5'],
  elliottCorrection: ['A', 'B', 'C'],
  elliottTriangle: ['A', 'B', 'C', 'D', 'E'],
  elliottDoubleCombo: ['W', 'X', 'Y'],
  elliottTripleCombo: ['W', 'X', 'Y', 'X', 'Z'],
};

function makeIndicatorAcronym(name: string): string {
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toLowerCase() ?? '')
    .join('');
}

function drawText(ctx: CanvasRenderingContext2D, drawing: Drawing, x: number, y: number, text: string) {
  ctx.save();
  const weight = drawing.options.bold ? '700' : '400';
  const italic = drawing.options.italic ? 'italic' : 'normal';
  ctx.font = `${italic} ${weight} ${drawing.options.textSize}px ${drawing.options.font}, sans-serif`;
  ctx.textAlign = drawing.options.align;
  const pad = drawing.options.textPadding;
  const metrics = ctx.measureText(text);
  const leftX = drawing.options.align === 'center'
    ? x - metrics.width / 2
    : drawing.options.align === 'right'
      ? x - metrics.width
      : x;

  if (drawing.options.textBackground) {
    ctx.fillStyle = 'rgba(8, 18, 30, 0.75)';
    ctx.fillRect(leftX - pad, y - drawing.options.textSize - pad, metrics.width + pad * 2, drawing.options.textSize + pad * 1.5);
    if (drawing.options.textBorder) {
      ctx.strokeStyle = `rgba(${rgbFromHex(drawing.options.color)}, 0.8)`;
      ctx.strokeRect(leftX - pad, y - drawing.options.textSize - pad, metrics.width + pad * 2, drawing.options.textSize + pad * 1.5);
    }
  }

  ctx.fillStyle = `rgba(${rgbFromHex(drawing.options.color)}, ${drawing.options.opacity})`;
  ctx.strokeStyle = 'rgba(8, 20, 37, 0.95)';
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function formatExportTimestamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}`;
}

function buildDotCursor(): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">',
    '<circle cx="9" cy="9" r="3.5" fill="#00d1ff" stroke="#ffffff" stroke-width="1.25"/>',
    '</svg>',
  ].join('');
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 9 9, crosshair`;
}

export default function TradingChart({ data, visibleCount, symbol, mode = 'simulation' }: TradingChartProps) {
  const isMobile = useIsMobile();
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [expandedCategory, setExpandedCategory] = useState<ToolCategory | null>(null);
  const [cursorMode, setCursorMode] = useState<CursorMode>('cross');
  const [valuesTooltip, setValuesTooltip] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('chart-values-tooltip') === 'true';
  });
  const [magnetMode, setMagnetMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('chart-magnet-mode') === 'true';
  });
  const [crosshairSnapMode, setCrosshairSnapMode] = useState<CrosshairSnapMode>(() => {
    if (typeof window === 'undefined') return 'free';
    const stored = window.localStorage.getItem('chart-crosshair-snap-mode');
    if (stored === 'time' || stored === 'ohlc' || stored === 'free') return stored;
    return 'free';
  });
  const [showGoLive, setShowGoLive] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [enabledIndicators, setEnabledIndicators] = useState<string[]>([]);
  const [keepDrawing, setKeepDrawing] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('chart-keep-drawing') === 'true';
  });
  const [lockAll, setLockAll] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('chart-lock-all') === 'true';
  });
  const [hideAll, setHideAll] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('chart-hide-all') === 'true';
  });
  const [treeOpen, setTreeOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(max-width: 767px)').matches;
  });
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [dragAnchor, setDragAnchor] = useState<{ drawingId: string; anchorIndex: number } | null>(null);
  const dragMoveRef = useRef<{ drawingId: string; startPoint: DrawPoint; currentPoint: DrawPoint; originalAnchors: DrawPoint[] } | null>(null);
  const dragAnchorMoveRef = useRef<{ drawingId: string; anchorIndex: number; currentPoint: DrawPoint; originalAnchors: DrawPoint[] } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<DrawPoint | null>(null);
  const [touchMode, setTouchMode] = useState<'idle' | 'pan' | 'axis-zoom' | 'scroll' | 'pinch'>('idle');
  const touchStartRef = useRef<{ x: number; y: number; zone: 'left' | 'center' | 'right' } | null>(null);
  const touchRafRef = useRef<number | null>(null);
  const drawingIndexRef = useRef(new DrawingTimeIndex());

  /* ─ Prompt modal for text/emoji tools ─ */
  const [promptRequest, setPromptRequest] = useState<ChartPromptRequest | null>(null);
  const [selectedIconPreset, setSelectedIconPreset] = useState<IconPresetSelection | null>(null);
  const [touchTooltip, setTouchTooltip] = useState<TouchTooltipState | null>(null);
  const pendingTextPointRef = useRef<DrawPoint | null>(null);
  const pendingTextVariantRef = useRef<Exclude<ToolVariant, 'none'> | null>(null);
  const draftPointerStartRef = useRef<{ x: number; y: number; variant: Exclude<ToolVariant, 'none'> } | null>(null);
  const touchTooltipTimerRef = useRef<number | null>(null);
  const touchTooltipStartRef = useRef<{ x: number; y: number } | null>(null);

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
    updateAllDrawings,
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
  const builtinIds = useMemo(
    () => new Set(indicatorCatalog.map((indicator) => indicator.id)),
    [indicatorCatalog]
  );

  useEffect(() => {
    if (toolState.variant === 'emoji' || toolState.variant === 'sticker' || toolState.variant === 'iconTool') return;
    setSelectedIconPreset(null);
  }, [toolState.variant]);

  const addIndicator = useCallback((indicatorId: string) => {
    setEnabledIndicators((prev) => {
      if (prev.includes(indicatorId)) return prev;
      return [...prev, indicatorId];
    });
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

  const clearPromptState = useCallback(() => {
    setPromptRequest(null);
    pendingTextPointRef.current = null;
    pendingTextVariantRef.current = null;
    draftPointerStartRef.current = null;
  }, []);

  const exitDrawingModeIfNeeded = useCallback((variant: Exclude<ToolVariant, 'none'> | null) => {
    if (keepDrawing || !variant) return;
    const definition = getToolDefinition(variant);
    setVariant(variant, definition?.category ?? 'lines');
  }, [keepDrawing, setVariant]);

  const handleCursorModeSelect = useCallback((mode: CursorMode) => {
    clearPromptState();
    setVariant('none', 'none');
    setCursorMode(mode);
  }, [clearPromptState, setCursorMode, setVariant]);

  const handleVariantSelect = useCallback((group: ToolCategory, variant: ToolVariant) => {
    clearPromptState();
    if (variant !== 'none') {
      setCursorMode((prev) => (prev === 'eraser' ? 'cross' : prev));
    }
    setVariant(variant, group);
  }, [clearPromptState, setVariant]);

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

  const resolvePointerSnapMode = useCallback((): CrosshairSnapMode => {
    if (toolState.variant === 'none') return crosshairSnapMode;
    switch (toolState.options.snapMode) {
      case 'off':
        return 'free';
      case 'candle':
        return 'time';
      default:
        return 'ohlc';
    }
  }, [crosshairSnapMode, toolState.options.snapMode, toolState.variant]);

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
    const point = pointerToDataPoint(clientX, clientY, resolvePointerSnapMode(), false) ?? fallbackPoint();
    setHoverPoint((prev) => {
      if (!point) return null;
      if (!prev) return point;
      const unchangedTime = Math.abs(Number(prev.time) - Number(point.time)) < 1;
      const unchangedPrice = Math.abs(prev.price - point.price) < Math.max(0.01, Math.abs(point.price) * 0.0002);
      return unchangedTime && unchangedPrice ? prev : point;
    });
  }, [fallbackPoint, pointerToDataPoint, resolvePointerSnapMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem('chart-crosshair-snap-mode', crosshairSnapMode);
    } catch {
      // Ignore restricted storage environments.
    }
  }, [crosshairSnapMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem('chart-values-tooltip', String(valuesTooltip));
    } catch {
      // Ignore restricted storage environments.
    }
  }, [valuesTooltip]);

  useEffect(() => {
    try {
      window.localStorage.setItem('chart-magnet-mode', String(magnetMode));
    } catch {
      // Ignore restricted storage environments.
    }
  }, [magnetMode]);

  useEffect(() => {
    if (valuesTooltip) return;
    if (touchTooltipTimerRef.current != null) {
      window.clearTimeout(touchTooltipTimerRef.current);
      touchTooltipTimerRef.current = null;
    }
    touchTooltipStartRef.current = null;
    setTouchTooltip(null);
  }, [valuesTooltip]);

  useEffect(() => {
    setHoverPoint(null);
    if (touchTooltipTimerRef.current != null) {
      window.clearTimeout(touchTooltipTimerRef.current);
      touchTooltipTimerRef.current = null;
    }
    touchTooltipStartRef.current = null;
    setTouchTooltip(null);
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

      const buildRegressionSample = (startPoint: DrawPoint, endPoint: DrawPoint): CanvasPoint[] => {
        const startIndex = nearestCandleIndex(transformedData.times, startPoint.time);
        const endIndex = nearestCandleIndex(transformedData.times, endPoint.time);
        if (startIndex < 0 || endIndex < 0) return [];

        const from = Math.max(0, Math.min(startIndex, endIndex));
        const to = Math.min(transformedData.ohlcRows.length - 1, Math.max(startIndex, endIndex));
        const sample: CanvasPoint[] = [];

        for (let index = from; index <= to; index += 1) {
          const row = transformedData.ohlcRows[index];
          const x = chartRef.current?.timeScale().timeToCoordinate(row.time);
          const y = series.priceToCoordinate(row.close);
          if (x == null || y == null) continue;
          sample.push({ x, y });
        }

        return sample;
      };

      const moveState = dragMoveRef.current;
      const anchorMoveState = dragAnchorMoveRef.current;

      const drawTool = (drawing: Drawing, draft = false) => {
        const activeDrawing = moveState?.drawingId === drawing.id
          ? { ...drawing, anchors: translateAnchors(moveState.originalAnchors, moveState.startPoint, moveState.currentPoint) }
          : anchorMoveState?.drawingId === drawing.id
            ? {
                ...drawing,
                anchors: (() => {
                  const nextAnchors = anchorMoveState.originalAnchors.map((anchor) => ({ ...anchor }));
                  nextAnchors[anchorMoveState.anchorIndex] = anchorMoveState.currentPoint;
                  return nextAnchors;
                })(),
              }
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

        /* ── Variant-specific rendering ─────────────────────── */
        const v = activeDrawing.variant;
        const drawSegment = (segment: [CanvasPoint, CanvasPoint]) => {
          ctx.beginPath();
          ctx.moveTo(segment[0].x, segment[0].y);
          ctx.lineTo(segment[1].x, segment[1].y);
          ctx.stroke();
        };

        if (v === 'hline' && points.length >= 1) {
          ctx.beginPath();
          ctx.moveTo(0, points[0].y);
          ctx.lineTo(cssWidth, points[0].y);
          ctx.stroke();
        } else if (v === 'vline' && points.length >= 1) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, 0);
          ctx.lineTo(points[0].x, cssHeight);
          ctx.stroke();
        } else if (v === 'horizontalRay' && points.length >= 1) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(cssWidth, points[0].y);
          ctx.stroke();
        } else if (v === 'crossLine' && points.length >= 1) {
          const p = points[0];
          ctx.beginPath();
          ctx.moveTo(0, p.y);
          ctx.lineTo(cssWidth, p.y);
          ctx.moveTo(p.x, 0);
          ctx.lineTo(p.x, cssHeight);
          ctx.stroke();
        } else if (v === 'ray' && points.length >= 2) {
          drawSegment(getRaySegment(points[0], points[1], cssWidth, cssHeight));
        } else if (v === 'infoLine' && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          const a1 = activeDrawing.anchors[0];
          const a2 = activeDrawing.anchors[1];
          const dp = a2.price - a1.price;
          const pct = a1.price !== 0 ? ((dp / a1.price) * 100).toFixed(2) : '0.00';
          const bars = Math.abs(Math.round((a2.time - a1.time) / 86400));
          const info = `${dp >= 0 ? '+' : ''}${dp.toFixed(2)} (${pct}%) ${bars}b`;
          drawText(ctx, activeDrawing, (p1.x + p2.x) / 2 + 4, (p1.y + p2.y) / 2 - 8, info);
        } else if (v === 'trendAngle' && points.length >= 2) {
          const [p1, p2] = snapTrendAngleSegment(points[0], points[1]);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          const angle = Math.atan2(-(p2.y - p1.y), p2.x - p1.x) * (180 / Math.PI);
          drawText(ctx, activeDrawing, p2.x + 6, p2.y - 8, `${angle.toFixed(1)}°`);
        } else if (v === 'flatTopBottom' && points.length >= 2) {
          const minY = Math.min(points[0].y, points[1].y);
          const maxY = Math.max(points[0].y, points[1].y);
          ctx.fillRect(0, minY, cssWidth, maxY - minY);
          ctx.beginPath();
          ctx.moveTo(0, points[0].y);
          ctx.lineTo(cssWidth, points[0].y);
          ctx.moveTo(0, points[1].y);
          ctx.lineTo(cssWidth, points[1].y);
          ctx.stroke();
        } else if (v === 'disjointChannel' && points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          if (points.length >= 4) {
            ctx.moveTo(points[2].x, points[2].y);
            ctx.lineTo(points[3].x, points[3].y);
          }
          ctx.stroke();
          if (points.length >= 4) {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.lineTo(points[3].x, points[3].y);
            ctx.lineTo(points[2].x, points[2].y);
            ctx.closePath();
            ctx.fill();
          }
        } else if (v === 'regressionTrend' && points.length >= 2) {
          const geometry = getRegressionTrendGeometry(buildRegressionSample(activeDrawing.anchors[0], activeDrawing.anchors[1]));
          if (geometry) {
            ctx.save();
            ctx.globalAlpha = Math.max(0.08, activeDrawing.options.opacity * 0.12);
            ctx.beginPath();
            ctx.moveTo(geometry.fill[0].x, geometry.fill[0].y);
            for (let index = 1; index < geometry.fill.length; index += 1) {
              ctx.lineTo(geometry.fill[index].x, geometry.fill[index].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            drawSegment(geometry.upper);
            drawSegment(geometry.median);
            drawSegment(geometry.lower);
          } else {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.stroke();
          }
        } else if (v === 'timeCycles' && points.length >= 2) {
          const interval = Math.abs(points[1].x - points[0].x);
          if (interval > 2) {
            ctx.beginPath();
            let x = points[0].x;
            while (x <= cssWidth) { ctx.moveTo(x, 0); ctx.lineTo(x, cssHeight); x += interval; }
            x = points[0].x - interval;
            while (x >= 0) { ctx.moveTo(x, 0); ctx.lineTo(x, cssHeight); x -= interval; }
            ctx.stroke();
          }
        } else if (v === 'sineLine' && points.length >= 2) {
          const halfW = Math.abs(points[1].x - points[0].x);
          const amp = points[1].y - points[0].y;
          if (halfW > 2) {
            ctx.beginPath();
            const lo = Math.max(0, points[0].x - halfW * 10);
            const hi = Math.min(cssWidth, points[0].x + halfW * 10);
            let first = true;
            for (let x = lo; x <= hi; x += 2) {
              const phase = ((x - points[0].x) / halfW) * Math.PI;
              const y = points[0].y + amp * Math.sin(phase);
              if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        } else if (v === 'fibSpeedResistArcs' && points.length >= 2) {
          const dist = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
          const levels = def.behaviors?.fibLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          for (const level of levels) {
            if (level === 0) continue;
            const r = dist * level;
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, r, 0, Math.PI * 2);
            ctx.stroke();
            if (activeDrawing.options.priceLabel) drawText(ctx, activeDrawing, points[0].x + r + 4, points[0].y - 4, `${(level * 100).toFixed(1)}%`);
          }
        } else if (v === 'pitchfan' && points.length >= 2) {
          const levels = def.behaviors?.fibLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const p1 = points[0];
          const p2 = points[1];
          const p3 = points[2] ?? p2;
          ctx.beginPath();
          for (const level of levels) {
            const tx = p2.x + (p3.x - p2.x) * level;
            const ty = p2.y + (p3.y - p2.y) * level;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(tx, ty);
          }
          ctx.stroke();
        } else if ((v === 'pitchfork' || v === 'schiffPitchfork' || v === 'modifiedSchiffPitchfork' || v === 'insidePitchfork') && points.length >= 3) {
          const geometry = getPitchforkGeometry([points[0], points[1], points[2]], v as PitchforkVariant, cssWidth, cssHeight);
          drawSegment(geometry.median);
          drawSegment(geometry.upper);
          drawSegment(geometry.lower);
        } else if (v === 'channel' && points.length >= 2) {
          const geometry = getParallelChannelGeometry([points[0], points[1]], cssWidth, cssHeight);
          ctx.save();
          ctx.globalAlpha = Math.max(0.08, activeDrawing.options.opacity * 0.12);
          ctx.beginPath();
          ctx.moveTo(geometry.fill[0].x, geometry.fill[0].y);
          for (let index = 1; index < geometry.fill.length; index += 1) {
            ctx.lineTo(geometry.fill[index].x, geometry.fill[index].y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          drawSegment(geometry.upper);
          drawSegment(geometry.center);
          drawSegment(geometry.lower);
        } else if (v === 'cyclicLines' && points.length >= 2) {
          const spacing = Math.abs(points[1].x - points[0].x);
          if (spacing > 4) {
            let cycle = 1;
            ctx.beginPath();
            for (let x = points[0].x; x <= cssWidth; x += spacing) {
              ctx.moveTo(x, 0);
              ctx.lineTo(x, cssHeight);
              cycle += 1;
            }
            for (let x = points[0].x - spacing; x >= 0; x -= spacing) {
              ctx.moveTo(x, 0);
              ctx.lineTo(x, cssHeight);
              cycle += 1;
            }
            ctx.stroke();
            drawText(ctx, activeDrawing, points[0].x + 6, points[0].y - 6, `cycle ${Math.max(1, cycle - 1)}`);
          }
        } else if (v === 'fibSpeedResistFan' && points.length >= 2) {
          const levels = def.behaviors?.fibLevels || [0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const start = points[0];
          const end = points[1];
          ctx.beginPath();
          for (const level of levels) {
            const target = {
              x: end.x,
              y: start.y + (end.y - start.y) * level,
            };
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(target.x, target.y);
          }
          ctx.stroke();
        } else if (v === 'fibTimeZone' && points.length >= 2) {
          const base = points[0];
          const spacing = Math.abs(points[1].x - points[0].x);
          if (spacing > 2) {
            const sequence = [1, 2, 3, 5, 8, 13, 21];
            ctx.beginPath();
            for (const n of sequence) {
              const x = base.x + spacing * n;
              if (x > cssWidth) break;
              ctx.moveTo(x, 0);
              ctx.lineTo(x, cssHeight);
            }
            ctx.stroke();
          }
        } else if (v === 'fibTrendTime' && points.length >= 2) {
          const start = points[0];
          const end = points[1];
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          const spacing = Math.abs(end.x - start.x);
          if (spacing > 2) {
            const sequence = [1, 2, 3, 5, 8];
            ctx.beginPath();
            for (const n of sequence) {
              const x = end.x + spacing * n;
              if (x > cssWidth) break;
              ctx.moveTo(x, 0);
              ctx.lineTo(x, cssHeight);
            }
            ctx.stroke();
          }
        } else if (v === 'fibCircles' && points.length >= 2) {
          const levels = def.behaviors?.fibLevels || [0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const radiusBase = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
          for (const level of levels) {
            const radius = Math.max(1, radiusBase * level);
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (v === 'fibSpiral' && points.length >= 2) {
          const radiusBase = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
          const center = points[0];
          ctx.beginPath();
          for (let t = 0; t <= Math.PI * 5; t += 0.08) {
            const growth = 0.14 + t / (Math.PI * 5);
            const r = radiusBase * growth;
            const x = center.x + Math.cos(t) * r;
            const y = center.y + Math.sin(t) * r;
            if (t === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else if (v === 'fibWedge' && points.length >= 2) {
          const start = points[0];
          const end = points[1];
          const mirror = { x: end.x, y: start.y - (end.y - start.y) };
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(mirror.x, mirror.y);
          for (const level of [0.236, 0.382, 0.5, 0.618, 0.786]) {
            const left = {
              x: start.x + (end.x - start.x) * level,
              y: start.y + (end.y - start.y) * level,
            };
            const right = {
              x: start.x + (mirror.x - start.x) * level,
              y: start.y + (mirror.y - start.y) * level,
            };
            ctx.moveTo(left.x, left.y);
            ctx.lineTo(right.x, right.y);
          }
          ctx.stroke();
        } else if (v === 'fibChannel' && points.length >= 2) {
          const levels = def.behaviors?.fibLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          const start = points[0];
          const end = points[1];
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const length = Math.hypot(dx, dy) || 1;
          const normal = { x: -dy / length, y: dx / length };
          const channelSpan = length * 0.35;
          for (const level of levels) {
            const offset = channelSpan * level;
            drawSegment([
              { x: start.x + normal.x * offset, y: start.y + normal.y * offset },
              { x: end.x + normal.x * offset, y: end.y + normal.y * offset },
            ]);
          }
        } else if (v === 'gannFan' && points.length >= 2) {
          const start = points[0];
          const end = points[1];
          const spanX = end.x - start.x;
          const spanY = end.y - start.y;
          const ratios = [0.125, 0.25, 0.333, 0.5, 1, 2, 3, 4, 8];
          ctx.beginPath();
          for (const ratio of ratios) {
            const target = {
              x: start.x + spanX,
              y: start.y + spanY * ratio,
            };
            const segment = getRaySegment(start, target, cssWidth, cssHeight);
            ctx.moveTo(segment[0].x, segment[0].y);
            ctx.lineTo(segment[1].x, segment[1].y);
          }
          ctx.stroke();
        } else if ((v === 'gannBox' || v === 'gannSquare' || v === 'gannSquareFixed') && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          const x = Math.min(p1.x, p2.x);
          const y = Math.min(p1.y, p2.y);
          let w = Math.abs(p2.x - p1.x);
          let h = Math.abs(p2.y - p1.y);
          if (v !== 'gannBox') {
            const size = Math.min(w, h);
            w = size;
            h = size;
          }

          ctx.save();
          ctx.globalAlpha = Math.max(0.08, activeDrawing.options.opacity * 0.12);
          ctx.fillRect(x, y, w, h);
          ctx.restore();
          ctx.strokeRect(x, y, w, h);

          ctx.beginPath();
          for (let i = 1; i < 8; i += 1) {
            const tx = x + (w * i) / 8;
            const ty = y + (h * i) / 8;
            ctx.moveTo(tx, y);
            ctx.lineTo(tx, y + h);
            ctx.moveTo(x, ty);
            ctx.lineTo(x + w, ty);
          }
          ctx.moveTo(x, y);
          ctx.lineTo(x + w, y + h);
          ctx.moveTo(x + w, y);
          ctx.lineTo(x, y + h);
          ctx.stroke();
        } else if (v === 'anchoredVwap' && points.length >= 1) {
          const startIndex = nearestCandleIndex(transformedData.times, activeDrawing.anchors[0].time);
          if (startIndex >= 0) {
            let cumulativePV = 0;
            let cumulativeVolume = 0;
            let started = false;
            let lastX = points[0].x;
            let lastY = points[0].y;
            ctx.beginPath();
            for (let i = startIndex; i < transformedData.ohlcRows.length; i += 1) {
              const row = transformedData.ohlcRows[i];
              const x = chartRef.current?.timeScale().timeToCoordinate(row.time);
              if (x == null) continue;
              const volume = Math.max(1, row.volume || 1);
              const typical = (row.high + row.low + row.close) / 3;
              cumulativePV += typical * volume;
              cumulativeVolume += volume;
              const vwap = cumulativePV / cumulativeVolume;
              const y = series.priceToCoordinate(vwap);
              if (y == null) continue;
              if (!started) {
                ctx.moveTo(x, y);
                started = true;
              } else {
                ctx.lineTo(x, y);
              }
              lastX = x;
              lastY = y;
            }
            if (started) {
              ctx.stroke();
              drawText(ctx, activeDrawing, lastX + 6, lastY - 8, 'VWAP');
            }
          }
        } else if ((v === 'priceRange' || v === 'dateRange' || v === 'dateAndPriceRange' || v === 'measure') && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          const x = Math.min(p1.x, p2.x);
          const y = Math.min(p1.y, p2.y);
          const w = Math.abs(p2.x - p1.x);
          const h = Math.abs(p2.y - p1.y);
          ctx.save();
          ctx.globalAlpha = Math.max(0.08, activeDrawing.options.opacity * 0.12);
          ctx.fillRect(x, y, w, h);
          ctx.restore();
          ctx.strokeRect(x, y, w, h);

          const a1 = activeDrawing.anchors[0];
          const a2 = activeDrawing.anchors[1];
          const dp = a2.price - a1.price;
          const pct = a1.price !== 0 ? ((dp / a1.price) * 100).toFixed(2) : '0.00';
          const bars = Math.abs(Math.round((a2.time - a1.time) / 86400));
          const info = v === 'dateRange' ? `${bars} bars` : `${dp >= 0 ? '+' : ''}${dp.toFixed(2)} (${pct}%) ${bars}b`;
          drawText(ctx, activeDrawing, x + 4, y - 8, info);
        } else if (v === 'fixedRangeVolumeProfile' && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          const left = Math.min(p1.x, p2.x);
          const right = Math.max(p1.x, p2.x);
          const top = Math.min(p1.y, p2.y);
          const bottom = Math.max(p1.y, p2.y);
          ctx.save();
          ctx.globalAlpha = Math.max(0.08, activeDrawing.options.opacity * 0.1);
          ctx.fillRect(left, top, right - left, bottom - top);
          ctx.restore();
          ctx.strokeRect(left, top, right - left, bottom - top);

          const startIdx = nearestCandleIndex(transformedData.times, activeDrawing.anchors[0].time);
          const endIdx = nearestCandleIndex(transformedData.times, activeDrawing.anchors[1].time);
          if (startIdx >= 0 && endIdx >= 0) {
            const from = Math.max(0, Math.min(startIdx, endIdx));
            const to = Math.min(transformedData.ohlcRows.length - 1, Math.max(startIdx, endIdx));
            const rows = transformedData.ohlcRows.slice(from, to + 1);
            const maxVolume = Math.max(1, ...rows.map((row) => row.volume || 0));
            const sampleCount = Math.min(20, rows.length);
            for (let i = 0; i < sampleCount; i += 1) {
              const row = rows[Math.floor((i / sampleCount) * rows.length)] || rows[rows.length - 1];
              if (!row) continue;
              const y = top + ((bottom - top) * i) / sampleCount;
              const h = Math.max(2, (bottom - top) / sampleCount - 1);
              const w = Math.max(2, ((right - left) * (row.volume || 0)) / maxVolume);
              ctx.fillRect(right - w, y, w, h);
            }
          }
        } else if (v === 'anchoredVolumeProfile' && points.length >= 1) {
          const anchor = points[0];
          const profileWidth = Math.max(36, cssWidth * 0.08);
          const profileHeight = Math.max(120, cssHeight * 0.36);
          const left = Math.min(cssWidth - profileWidth - 4, anchor.x + 16);
          const top = Math.max(4, anchor.y - profileHeight / 2);
          const bins = 14;
          ctx.save();
          ctx.globalAlpha = Math.max(0.08, activeDrawing.options.opacity * 0.12);
          ctx.fillRect(left, top, profileWidth, profileHeight);
          ctx.restore();
          ctx.strokeRect(left, top, profileWidth, profileHeight);
          for (let i = 0; i < bins; i += 1) {
            const ratio = Math.abs(Math.sin((i / bins) * Math.PI * 1.8));
            const barW = Math.max(3, profileWidth * ratio);
            const y = top + (profileHeight * i) / bins;
            const h = Math.max(2, profileHeight / bins - 1);
            ctx.fillRect(left + profileWidth - barW, y, barW, h);
          }
          drawText(ctx, activeDrawing, left, top - 8, 'Vol profile');
        } else if ((v === 'longPosition' || v === 'shortPosition' || v === 'positionForecast') && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          const left = Math.min(p1.x, p2.x);
          const right = Math.max(p1.x, p2.x);
          const isShort = v === 'shortPosition';
          const entryY = p1.y;
          const targetY = isShort ? Math.max(p1.y, p2.y) : Math.min(p1.y, p2.y);
          const stopY = isShort ? Math.min(p1.y, p2.y) : Math.max(p1.y, p2.y);

          const reward = Math.abs(targetY - entryY);
          const risk = Math.abs(stopY - entryY);
          const rr = risk > 0 ? reward / risk : 0;

          const takeTop = Math.min(entryY, targetY);
          const takeHeight = Math.abs(targetY - entryY);
          const riskTop = Math.min(entryY, stopY);
          const riskHeight = Math.abs(stopY - entryY);

          if (v !== 'positionForecast') {
            ctx.save();
            ctx.fillStyle = isShort ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.16)';
            ctx.fillRect(left, takeTop, right - left, takeHeight);
            ctx.fillStyle = isShort ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.24)';
            ctx.fillRect(left, riskTop, right - left, riskHeight);
            ctx.restore();
          } else {
            ctx.save();
            ctx.globalAlpha = Math.max(0.08, activeDrawing.options.opacity * 0.12);
            ctx.fillRect(left, Math.min(targetY, stopY), right - left, Math.abs(stopY - targetY));
            ctx.restore();
          }

          ctx.beginPath();
          ctx.moveTo(left, entryY);
          ctx.lineTo(right, entryY);
          ctx.moveTo(left, targetY);
          ctx.lineTo(right, targetY);
          ctx.moveTo(left, stopY);
          ctx.lineTo(right, stopY);
          ctx.stroke();

          const label = v === 'positionForecast' ? 'Forecast' : isShort ? 'Short' : 'Long';
          drawText(ctx, activeDrawing, right + 6, entryY - 8, `${label} RR ${rr.toFixed(2)}x`);
        } else if (v === 'barPattern' && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          const width = Math.abs(p2.x - p1.x);
          const dir = p2.y >= p1.y ? 1 : -1;
          for (let i = 0; i < 6; i += 1) {
            const x = p1.x + (width * i) / 6;
            const h = 8 + (i % 3) * 5;
            ctx.strokeRect(x - 2, p1.y - (h * dir), 4, h * dir);
          }
        } else if (v === 'ghostFeed' && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          for (let t = 0; t <= 1.4; t += 0.04) {
            const x = p1.x + dx * t;
            const y = p1.y + dy * t + Math.sin(t * Math.PI * 6) * 7;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else if (def.family === 'pattern') {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i += 1) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();

          const labels = PATTERN_LABELS_BY_VARIANT[v] || [];
          for (let i = 0; i < Math.min(labels.length, points.length); i += 1) {
            drawText(ctx, activeDrawing, points[i].x + 4, points[i].y - 6, labels[i]);
          }
        } else if (def.family === 'text') {
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
          if (activeDrawing.options.rayMode && points.length >= 2) {
            drawSegment(getRaySegment(points[0], points[1], cssWidth, cssHeight));
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
  }, [chartRef, drawingsRef, draftRef, getActiveSeries, getVisibleTimeRange, overlayRef, selectedDrawingId, translateAnchors, transformedData]);

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
      getHistoryLength: () => toolState.history.length,
      getDrawings: () => drawingsRef.current,
      getMagnetMode: () => magnetMode,
      pointerToDataPoint: (clientX: number, clientY: number, snap: boolean) =>
        pointerToDataPoint(clientX, clientY, crosshairSnapMode, snap),
    };
    (window as unknown as Record<string, unknown>).__chartDebug = debug;
    return () => {
      delete (window as unknown as Record<string, unknown>).__chartDebug;
    };
  }, [crosshairSnapMode, drawingsRef, magnetMode, pointerToDataPoint, toolState.history.length]);

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
      if (!drawingActiveRef.current && !dragMoveRef.current && !dragAnchorMoveRef.current && !dragAnchor) return;
      cancelDraft();
      dragMoveRef.current = null;
      dragAnchorMoveRef.current = null;
      draftPointerStartRef.current = null;
      setDragAnchor(null);
      renderOverlay();
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [cancelDraft, dragAnchor, drawingActiveRef, renderOverlay]);

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

  const clearTouchTooltip = useCallback(() => {
    if (touchTooltipTimerRef.current != null) {
      window.clearTimeout(touchTooltipTimerRef.current);
      touchTooltipTimerRef.current = null;
    }
    touchTooltipStartRef.current = null;
    setTouchTooltip(null);
  }, []);

  const scheduleTouchTooltip = useCallback((currentTarget: HTMLDivElement, clientX: number, clientY: number) => {
    if (!valuesTooltip) return;
    const bounds = currentTarget.getBoundingClientRect();
    const localX = Math.min(bounds.width, Math.max(0, clientX - bounds.left));
    const localY = Math.min(bounds.height, Math.max(0, clientY - bounds.top));

    if (touchTooltipTimerRef.current != null) {
      window.clearTimeout(touchTooltipTimerRef.current);
    }

    touchTooltipStartRef.current = { x: clientX, y: clientY };
    touchTooltipTimerRef.current = window.setTimeout(() => {
      const point = pointerToDataPoint(clientX, clientY, resolvePointerSnapMode(), magnetMode) ?? fallbackPoint();
      if (!point) return;
      setTouchTooltip({ point, x: localX, y: localY });
      touchTooltipTimerRef.current = null;
    }, 450);
  }, [fallbackPoint, magnetMode, pointerToDataPoint, resolvePointerSnapMode, valuesTooltip]);

  const onChartTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length >= 2) {
      clearTouchTooltip();
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
    scheduleTouchTooltip(event.currentTarget, touch.clientX, touch.clientY);
    setTouchMode(zone === 'center' ? 'scroll' : 'idle');
    applyTouchMode(zone === 'center' ? 'scroll' : 'idle');
  };

  const onChartTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
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

    if (touchTooltipStartRef.current && Math.hypot(dx, dy) > 12) {
      clearTouchTooltip();
    }

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
    touchStartRef.current = null;
    clearTouchTooltip();
    setTouchMode('scroll');
    applyTouchMode('scroll');
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    clearTouchTooltip();
    draftPointerStartRef.current = null;
    dragAnchorMoveRef.current = null;
    const freePoint = pointerToDataPoint(event.clientX, event.clientY, 'free', false) || fallbackPoint();

    if (cursorMode === 'eraser' && toolState.variant === 'none') {
      if (!freePoint) return;

      const visibleRange = getVisibleTimeRange();
      const visibleIds = visibleRange ? new Set(drawingIndexRef.current.query(visibleRange)) : null;
      const candidates = visibleIds ? drawingsRef.current.filter((drawing) => visibleIds.has(drawing.id)) : drawingsRef.current;
      const targetId = selectNearestDrawingId(candidates, freePoint);
      if (targetId) {
        removeDrawing(targetId);
        if (selectedDrawingId === targetId) {
          setSelectedDrawingId(null);
        }
      }
      renderOverlay();
      return;
    }

    if (toolState.variant === 'none') {
      if (!freePoint) return;
      const visibleRange = getVisibleTimeRange();
      const visibleIds = visibleRange
        ? new Set(drawingIndexRef.current.query(visibleRange))
        : null;
      const candidates = visibleIds
        ? drawingsRef.current.filter((drawing) => visibleIds.has(drawing.id))
        : drawingsRef.current;

      const selected = selectNearestDrawingId(candidates, freePoint);
      setSelectedDrawingId(selected);
      if (selected) {
        const drawing = drawingsRef.current.find((item) => item.id === selected);
        if (drawing && !drawing.locked) {
          const idx = drawing.anchors.findIndex((a) => Math.abs(a.time - freePoint.time) < 86400 && Math.abs(a.price - freePoint.price) < Math.max(0.2, freePoint.price * 0.02));
          if (idx >= 0) {
            setDragAnchor({ drawingId: selected, anchorIndex: idx });
            dragAnchorMoveRef.current = {
              drawingId: selected,
              anchorIndex: idx,
              currentPoint: freePoint,
              originalAnchors: drawing.anchors.map((anchor) => ({ ...anchor })),
            };
          } else {
            dragMoveRef.current = { drawingId: selected, startPoint: freePoint, currentPoint: freePoint, originalAnchors: drawing.anchors.map((anchor) => ({ ...anchor })) };
          }
        }
      }
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      renderOverlay();
      return;
    }

    const point = pointerToDataPoint(event.clientX, event.clientY, resolvePointerSnapMode(), magnetMode) || fallbackPoint();
    if (!point) return;

    const needsText = activeDefinition?.family === 'text' && activeDefinition.capabilities.supportsText && toolState.variant !== 'priceLabel';
    if (needsText) {
      pendingTextPointRef.current = point;
      const variant = toolState.variant as Exclude<typeof toolState.variant, 'none'>;
      pendingTextVariantRef.current = variant;
      const iconPreset = selectedIconPreset && selectedIconPreset.variant === variant ? selectedIconPreset : null;
      setPromptRequest(
        iconPreset
          ? { title: iconPreset.title, label: iconPreset.label, defaultValue: iconPreset.defaultValue, preview: iconPreset.preview ?? true }
          : variant === 'emoji'
            ? { title: 'Emoji', label: 'Enter emoji', defaultValue: '🚀', preview: true }
            : variant === 'sticker'
              ? { title: 'Sticker', label: 'Enter sticker text', defaultValue: 'WAGMI', preview: true }
              : { title: 'Icon', label: 'Enter symbol', defaultValue: '★', preview: true },
      );
      return;
    }

    const text = activeDefinition?.family === 'text' && activeDefinition.capabilities.supportsText ? '' : undefined;
    const activeVariant = toolState.variant as Exclude<ToolVariant, 'none'>;
    if (!isPointOnlyVariant(activeVariant)) {
      draftPointerStartRef.current = { x: event.clientX, y: event.clientY, variant: activeVariant };
    }
    const result = startDraft(point, text);
    if (result.kind === 'finalized') {
      draftPointerStartRef.current = null;
      const d = drawingsRef.current[drawingsRef.current.length - 1];
      if (d) {
        setSelectedDrawingId(d.id);
        exitDrawingModeIfNeeded(d.variant);
      }
    }
    renderOverlay();
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    updateHoverPoint(event.clientX, event.clientY);

    const shouldUseFreePointer = Boolean(dragMoveRef.current || dragAnchor);
    const point = pointerToDataPoint(
      event.clientX,
      event.clientY,
      shouldUseFreePointer ? 'free' : resolvePointerSnapMode(),
      shouldUseFreePointer ? false : magnetMode,
    ) || fallbackPoint();
    if (!point) return;

    if (dragMoveRef.current) {
      dragMoveRef.current = { ...dragMoveRef.current, currentPoint: point };
      renderOverlay();
      return;
    }

    if (dragAnchor) {
      const move = dragAnchorMoveRef.current;
      if (move && move.drawingId === dragAnchor.drawingId && move.anchorIndex === dragAnchor.anchorIndex) {
        dragAnchorMoveRef.current = { ...move, currentPoint: point };
      }
      renderOverlay();
      return;
    }

    if (!drawingActiveRef.current) return;
    updateDraft(point);
    renderOverlay();
  };

  const onChartContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const point = pointerToDataPoint(event.clientX, event.clientY, 'free', false) || fallbackPoint();
    if (!point) return;

    const visibleRange = getVisibleTimeRange();
    const visibleIds = visibleRange ? new Set(drawingIndexRef.current.query(visibleRange)) : null;
    const candidates = visibleIds ? drawingsRef.current.filter((drawing) => visibleIds.has(drawing.id)) : drawingsRef.current;
    const selected = selectNearestDrawingId(candidates, point);
    if (!selected) return;

    setSelectedDrawingId(selected);
    const drawing = drawingsRef.current.find((item) => item.id === selected);
    if (!drawing) {
      renderOverlay();
      return;
    }

    const definition = getToolDefinition(drawing.variant);
    handleVariantSelect(definition?.category ?? 'lines', drawing.variant);
    setOptions({ ...drawing.options });
    setOptionsOpen(true);
    setExpandedCategory(null);
    renderOverlay();
  };

  const cursorCssByMode: Record<CursorMode, string> = {
    cross: 'crosshair',
    dot: buildDotCursor(),
    arrow: 'default',
    demo: 'pointer',
    eraser: 'not-allowed',
  };
  const overlayInteractive = toolState.variant !== 'none' || cursorMode === 'eraser';
  const overlayCursor = toolState.variant !== 'none' ? undefined : cursorCssByMode[cursorMode];

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
      dragAnchorMoveRef.current = null;
      draftPointerStartRef.current = null;
      renderOverlay();
      return;
    }

    if (dragAnchor) {
      const move = dragAnchorMoveRef.current;
      if (move && move.drawingId === dragAnchor.drawingId && move.anchorIndex === dragAnchor.anchorIndex) {
        updateDrawing(move.drawingId, (drawing) => {
          const next = move.originalAnchors.map((anchor) => ({ ...anchor }));
          next[move.anchorIndex] = move.currentPoint;
          const changed = next.some((anchor, index) => {
            const current = drawing.anchors[index];
            return !current || current.time !== anchor.time || current.price !== anchor.price;
          });
          return changed ? { ...drawing, anchors: next } : drawing;
        });
      }
      dragAnchorMoveRef.current = null;
      setDragAnchor(null);
      draftPointerStartRef.current = null;
      renderOverlay();
      return;
    }

    const committed = finalizeDraft();
    const start = draftPointerStartRef.current;
    draftPointerStartRef.current = null;
    if (committed && start && committed.variant === start.variant) {
      const pointerDistance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (pointerDistance < 3) {
        removeDrawing(committed.id);
        setSelectedDrawingId(null);
        renderOverlay();
        return;
      }
    }
    if (toolState.variant === 'zoom' && committed?.anchors[1]) {
      zoomToRange(committed.anchors[0].time, committed.anchors[1].time);
      removeDrawing(committed.id);
      exitDrawingModeIfNeeded(committed.variant);
    } else if (committed) {
      setSelectedDrawingId(committed.id);
      exitDrawingModeIfNeeded(committed.variant);
    }
    renderOverlay();
  };

  const currentLegendSourcePoint = touchTooltip?.point ?? hoverPoint ?? null;
  const currentLegendRow = resolveLegendRow(currentLegendSourcePoint);
  const currentLegendPoint = currentLegendSourcePoint ?? (currentLegendRow ? { time: currentLegendRow.time, price: currentLegendRow.close } : null);
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

  /* ── Standalone rail tool callbacks ───────────────────────── */
  const handleToggleMagnet = useCallback(() => {
    setMagnetMode((prev) => !prev);
  }, []);

  const handleToggleKeepDrawing = useCallback(() => {
    setKeepDrawing((prev) => {
      const next = !prev;
      window.localStorage.setItem('chart-keep-drawing', String(next));
      return next;
    });
  }, []);

  const handleToggleLockAll = useCallback(() => {
    setLockAll((prev) => {
      const next = !prev;
      window.localStorage.setItem('chart-lock-all', String(next));
      setOptions({ locked: next });
      updateAllDrawings((drawings) => drawings.map((drawing) => ({ ...drawing, locked: next, options: { ...drawing.options, locked: next } })));
      return next;
    });
  }, [setOptions, updateAllDrawings]);

  const handleToggleHideAll = useCallback(() => {
    setHideAll((prev) => {
      const next = !prev;
      window.localStorage.setItem('chart-hide-all', String(next));
      setOptions({ visible: !next });
      updateAllDrawings((drawings) => drawings.map((drawing) => ({ ...drawing, visible: !next, options: { ...drawing.options, visible: !next } })));
      renderOverlay();
      return next;
    });
  }, [renderOverlay, setOptions, updateAllDrawings]);

  const handleZoomIn = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const mid = (range.from + range.to) / 2;
    const span = (range.to - range.from) * 0.4;
    chart.timeScale().setVisibleLogicalRange({ from: mid - span, to: mid + span });
  }, [chartRef]);

  const handleZoomOut = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    const mid = (range.from + range.to) / 2;
    const span = (range.to - range.from) * 0.75;
    chart.timeScale().setVisibleLogicalRange({ from: mid - span, to: mid + span });
  }, [chartRef]);

  const handleMeasure = useCallback(() => {
    handleVariantSelect('forecasting', 'priceRange');
  }, [handleVariantSelect]);

  const handleDelete = useCallback(() => {
    if (selectedDrawingId) {
      removeDrawing(selectedDrawingId);
      setSelectedDrawingId(null);
    }
  }, [removeDrawing, selectedDrawingId]);

  return (
    <div className="relative flex h-full max-h-[calc(100vh-100px)] w-full min-h-[340px] flex-col">
      {/* Top bar + rail + chart in a flex layout */}
      <ChartTopBar chartType={chartType} setChartType={setChartType} magnetMode={magnetMode} setMagnetMode={setMagnetMode} crosshairSnapMode={crosshairSnapMode} setCrosshairSnapMode={setCrosshairSnapMode} onUndo={undo} onRedo={redo} onClear={clearDrawings} onExportPng={onExportPng} optionsOpen={optionsOpen} setOptionsOpen={setOptionsOpen} indicatorsOpen={indicatorsOpen} setIndicatorsOpen={setIndicatorsOpen} activeIndicatorsCount={enabledIndicators.length} treeOpen={treeOpen} setTreeOpen={setTreeOpen} selectedDrawingVariant={selectedDrawing?.variant ?? null} isMobile={isMobile} />

      <div className="flex min-h-0 flex-1">
        {/* Tool Rail — thin left icon bar */}
        <ToolRail
          toolState={toolState}
          expandedCategory={expandedCategory}
          setExpandedCategory={setExpandedCategory}
          onVariant={handleVariantSelect}
          selectedIconPreset={selectedIconPreset}
          onIconPresetSelect={setSelectedIconPreset}
          cursorMode={cursorMode}
          onCursorModeSelect={handleCursorModeSelect}
          valuesTooltip={valuesTooltip}
          setValuesTooltip={setValuesTooltip}
          isMobile={isMobile}
          magnetMode={magnetMode}
          onToggleMagnet={handleToggleMagnet}
          keepDrawing={keepDrawing}
          onToggleKeepDrawing={handleToggleKeepDrawing}
          lockAll={lockAll}
          onToggleLockAll={handleToggleLockAll}
          hideAll={hideAll}
          onToggleHideAll={handleToggleHideAll}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onMeasure={handleMeasure}
          onDelete={handleDelete}
        />

        {/* Chart area — maximized */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            data-testid="chart-interaction-surface"
            className="relative min-h-0 flex-1 overflow-hidden"
            onContextMenu={onChartContextMenu}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
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
              <ChartCanvas chartContainerRef={chartContainerRef} overlayRef={overlayRef} activeVariant={toolState.variant} overlayInteractive={overlayInteractive} overlayCursor={overlayCursor} containerCursor={overlayCursor} />
            </div>

            {valuesTooltip && touchTooltip && currentLegendRow ? (
              <div
                data-testid="values-tooltip"
                className="pointer-events-none absolute z-40 rounded-xl border border-primary/25 bg-slate-950/90 px-3 py-2 text-[11px] text-foreground shadow-2xl shadow-black/50 backdrop-blur-md"
                style={{
                  left: `${Math.min(chartContainerRef.current?.clientWidth ?? 0, Math.max(0, touchTooltip.x + 12))}px`,
                  top: `${Math.min(chartContainerRef.current?.clientHeight ?? 0, Math.max(0, touchTooltip.y - 12))}px`,
                  transform: 'translateY(-100%)',
                }}
              >
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/80">Long press values</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] tabular-nums">
                  <span>O {currentLegendRow.open.toFixed(2)}</span>
                  <span>H {currentLegendRow.high.toFixed(2)}</span>
                  <span>L {currentLegendRow.low.toFixed(2)}</span>
                  <span>C {currentLegendRow.close.toFixed(2)}</span>
                  <span className="col-span-2 text-muted-foreground">{currentLegendPoint ? new Date(Number(currentLegendPoint.time) * 1000).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: '2-digit', timeZone: 'UTC' }) : ''}</span>
                </div>
              </div>
            ) : null}

            <ToolOptionsPanel open={optionsOpen} options={toolState.options} optionsSchema={activeDefinition?.optionsSchema || []} onChange={setOptions} />

            <IndicatorsModal open={indicatorsOpen} onOpenChange={setIndicatorsOpen} enabledIndicators={enabledIndicators} onAddIndicator={addIndicator} onRemoveIndicator={removeEnabledIndicator} builtinIds={builtinIds} />

            <ChartPromptModal
              request={promptRequest}
              onConfirm={(val) => {
                const pt = pendingTextPointRef.current;
                const pendingVariant = pendingTextVariantRef.current;
                pendingTextPointRef.current = null;
                pendingTextVariantRef.current = null;
                setPromptRequest(null);
                if (pt && pendingVariant && toolState.variant === pendingVariant) {
                  const result = startDraft(pt, val);
                  if (result.kind === 'finalized') {
                    const d = drawingsRef.current[drawingsRef.current.length - 1];
                    if (d) {
                      setSelectedDrawingId(d.id);
                      exitDrawingModeIfNeeded(d.variant);
                    }
                  }
                  renderOverlay();
                }
              }}
              onCancel={() => {
                clearPromptState();
              }}
            />

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

