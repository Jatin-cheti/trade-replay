// TV-parity build: toolVariantRef + force-exit + overlay-interactive fix
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { listIndicators, getGlobalPerfTelemetry, resolutionToSeconds, isIntradayResolution, formatCountdown, type CrosshairMoveEvent, type IChartApi } from '@tradereplay/charts';
import type { CandleData } from '@/data/stockData';
import { toTimestamp, type ChartType } from '@/services/chart/dataTransforms';
import type { ChartSyncBus, SyncedLogicalRange } from '@/services/chart/chartSyncBus';
import { buildToolOptions, getToolDefinition, type CursorMode, type DrawPoint, type Drawing, type ToolCategory, type ToolVariant } from '@/services/tools/toolRegistry';
import { rgbFromHex } from '@/services/tools/toolOptions';
import {
  compareDrawingRenderOrder,
  createDrawing,
  DrawingSpatialIndex,
  getHitTestTelemetrySnapshot,
  isClickClickVariant,
  isPointOnlyVariant,
  isWizardVariant,
  nearestCandleIndex,
  normalizeDrawings,
  resetHitTestTelemetry,
  resolveNearestDrawingHit,
  setHitTestTelemetryEnabled,
} from '@/services/tools/toolEngine';
import { catmullRomSmooth, getArrowheadPoints, getParallelChannelGeometry, getPitchforkGeometry, getRaySegment, getRegressionTrendGeometry, snapTrendAngleSegment, type CanvasPoint, type PitchforkVariant } from '@/services/tools/drawingGeometry';
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
import FloatingDrawingToolbar, { type FloatingToolbarAnchor } from '@/components/chart/FloatingDrawingToolbar';
import type { IconPresetSelection } from '@/components/chart/IconToolPanel';
import { toast } from 'sonner';

interface TradingChartProps {
  data: CandleData[];
  visibleCount: number;
  symbol: string;
  /** Active chart resolution string (e.g. "1", "5", "30", "60", "120", "D", "W", "M").
   * Used to compute the countdown timer for the next candle on the X-axis. */
  resolution?: string;
  mode?: 'simulation' | 'live';
  syncBus?: ChartSyncBus;
  syncId?: string;
  parityMode?: boolean;
  /** Optional overlay rendered inside chart-interaction-surface at top-left (over canvas, not over tool rail) */
  ohlcLegend?: React.ReactNode;
  /** Called when user clicks "Add alert" in the crosshair Y-axis menu */
  onAddAlert?: (price: number) => void;
}

// resolutionToSeconds, isIntradayResolution, formatCountdown are imported from @tradereplay/charts above.

type TouchTooltipState = {
  point: DrawPoint;
  x: number;
  y: number;
};

type PatternWizardHintState = {
  toolLabel: string;
  pointLabel: string;
  step: number;
  total: number;
};

type InteractionMetric = 'pointerdown' | 'pointermove' | 'pointerup' | 'hover';

type InteractionMetricBucket = {
  count: number;
  totalMs: number;
  maxMs: number;
};

type InteractionLatencyStore = {
  pointerdown: InteractionMetricBucket;
  pointermove: InteractionMetricBucket;
  pointerup: InteractionMetricBucket;
  hover: InteractionMetricBucket;
};

type InteractionLatencySnapshot = {
  pointerdown: InteractionMetricBucket & { avgMs: number };
  pointermove: InteractionMetricBucket & { avgMs: number };
  pointerup: InteractionMetricBucket & { avgMs: number };
  hover: InteractionMetricBucket & { avgMs: number };
};

const HOVER_SWITCH_MARGIN = 0.28;
const PRICE_AXIS_WIDTH_PX = 68;

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

function makeMetricBucket(): InteractionMetricBucket {
  return {
    count: 0,
    totalMs: 0,
    maxMs: 0,
  };
}

function makeInteractionLatencyStore(): InteractionLatencyStore {
  return {
    pointerdown: makeMetricBucket(),
    pointermove: makeMetricBucket(),
    pointerup: makeMetricBucket(),
    hover: makeMetricBucket(),
  };
}

function bucketSnapshot(bucket: InteractionMetricBucket): InteractionMetricBucket & { avgMs: number } {
  return {
    count: bucket.count,
    totalMs: bucket.totalMs,
    maxMs: bucket.maxMs,
    avgMs: bucket.count > 0 ? bucket.totalMs / bucket.count : 0,
  };
}

function getInteractionLatencySnapshot(store: InteractionLatencyStore): InteractionLatencySnapshot {
  return {
    pointerdown: bucketSnapshot(store.pointerdown),
    pointermove: bucketSnapshot(store.pointermove),
    pointerup: bucketSnapshot(store.pointerup),
    hover: bucketSnapshot(store.hover),
  };
}

function makeIndicatorAcronym(name: string): string {
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toLowerCase() ?? '')
    .join('');
}

/**
 * Compute info-line metrics from two anchors and their screen positions.
 * TV-parity: shows price delta / pct / ticks, bar count / day count / pixel
 * distance, and angle in degrees. Tick size heuristic: 0.05 for INR equities.
 */
export function computeInfoLineMetrics(
  a1: { time: number; price: number },
  a2: { time: number; price: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  const dp = a2.price - a1.price;
  const pct = a1.price !== 0 ? (dp / a1.price) * 100 : 0;
  const bars = Math.round((a2.time - a1.time) / 86400);
  const days = bars;
  const distPx = Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y));
  const angleDeg = Math.atan2(-(p2.y - p1.y), p2.x - p1.x) * (180 / Math.PI);
  const tickSize = a1.price > 1 ? 0.05 : 0.0001;
  const ticks = Math.round(dp / tickSize);
  const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '\u2212' : '');
  const fmt = (n: number, d = 2) => `${sign(n)}${Math.abs(n).toFixed(d)}`;
  const fmtInt = (n: number) => `${sign(n)}${Math.abs(n).toLocaleString('en-US')}`;
  const arrow = dp > 0 ? '\u25B2' : dp < 0 ? '\u25BC' : '\u25C6';
  return {
    dp,
    pct,
    bars,
    days,
    distPx,
    angleDeg,
    ticks,
    tickSize,
    line1: `${arrow} ${fmt(dp, 2)} (${fmt(pct, 2)}%), ${fmtInt(ticks)}`,
    line2: `\u2194 ${fmtInt(bars)} bars (${fmtInt(days)}d), distance: ${distPx} px`,
    line3: `\u2220 ${fmt(angleDeg, 2)}\u00B0`,
  };
}

function drawText(ctx: CanvasRenderingContext2D, drawing: Drawing, x: number, y: number, text: string) {
  ctx.save();
  const weight = drawing.options.bold ? '700' : '400';
  const italic = drawing.options.italic ? 'italic' : 'normal';
  ctx.font = `${italic} ${weight} ${drawing.options.textSize}px ${drawing.options.font}, sans-serif`;
  ctx.textAlign = drawing.options.align;
  const pad = drawing.options.textPadding;
  const maxWidth = Math.max(80, Number(drawing.options.textMaxWidth) || 240);

  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  if (!words.length) {
    lines.push(text);
  } else {
    let current = words[0];
    for (let index = 1; index < words.length; index += 1) {
      const candidate = `${current} ${words[index]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[index];
      }
    }
    lines.push(current);
  }

  const lineHeight = Math.max(drawing.options.textSize + 2, drawing.options.textSize * 1.2);
  const metrics = lines.map((line) => ctx.measureText(line));
  const widest = metrics.reduce((max, m) => Math.max(max, m.width), 0);
  const leftX = drawing.options.align === 'center'
    ? x - widest / 2
    : drawing.options.align === 'right'
      ? x - widest
      : x;

  const textTop = y - (lines.length - 1) * lineHeight - drawing.options.textSize;
  const textBottom = textTop + lines.length * lineHeight;

  if (drawing.options.textBackground) {
    ctx.fillStyle = 'rgba(8, 18, 30, 0.75)';
    ctx.fillRect(leftX - pad, textTop - pad, widest + pad * 2, textBottom - textTop + pad * 1.6);
    if (drawing.options.textBorder) {
      ctx.strokeStyle = `rgba(${rgbFromHex(drawing.options.color)}, 0.8)`;
      ctx.strokeRect(leftX - pad, textTop - pad, widest + pad * 2, textBottom - textTop + pad * 1.6);
    }
  }

  ctx.fillStyle = `rgba(${rgbFromHex(drawing.options.color)}, ${drawing.options.opacity})`;
  ctx.strokeStyle = 'rgba(8, 20, 37, 0.95)';
  ctx.lineWidth = 3;
  lines.forEach((line, index) => {
    const lineY = y - (lines.length - 1 - index) * lineHeight;
    ctx.strokeText(line, x, lineY);
    ctx.fillText(line, x, lineY);
  });
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

function logicalRangeEquals(
  left: SyncedLogicalRange | null | undefined,
  right: SyncedLogicalRange | null | undefined,
  epsilon = 0.01,
): boolean {
  if (!left || !right) return false;
  return Math.abs(left.from - right.from) <= epsilon && Math.abs(left.to - right.to) <= epsilon;
}

function buildDotCursor(): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">',
    '<circle cx="9" cy="9" r="3.5" fill="#00d1ff" stroke="#ffffff" stroke-width="1.25"/>',
    '</svg>',
  ].join('');
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 9 9, crosshair`;
}

function buildEraserCursor(): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">',
    '<path d="M4.2 13.7L11.9 6a1.7 1.7 0 0 1 2.4 0l3.7 3.7a1.7 1.7 0 0 1 0 2.4l-6.2 6.2H7.3L4.2 15.2a1.1 1.1 0 0 1 0-1.5Z" fill="#f7f7f7" stroke="#1f2937" stroke-width="1.25"/>',
    '<path d="M6.8 16.8h9.3" stroke="#1f2937" stroke-width="1.25" stroke-linecap="round"/>',
    '<path d="M12.7 6.9l4.3 4.3" stroke="#93c5fd" stroke-width="1.25" stroke-linecap="round"/>',
    '</svg>',
  ].join('');
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 4 18, crosshair`;
}

export default function TradingChart({
  data,
  visibleCount,
  symbol,
  resolution,
  mode = 'simulation',
  syncBus,
  syncId,
  parityMode = false,
  ohlcLegend,
  onAddAlert,
}: TradingChartProps) {
  const isMobile = useIsMobile();
  const [chartType, setChartType] = useState<ChartType>(() => (parityMode ? 'volumeCandles' : 'candlestick'));
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
    const stored = window.localStorage.getItem('chart-keep-drawing');
    // TV default: one-shot drawing unless user explicitly enables keep-drawing.
    return stored === null ? false : stored === 'true';
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
  const [fullView, setFullView] = useState(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
  // Ref mirror so renderOverlay's RAF callback can read hoveredDrawingId
  // without stale-closure issues (updated synchronously in every setter call).
  const hoveredDrawingIdRef = useRef<string | null>(null);
  hoveredDrawingIdRef.current = hoveredDrawingId;
  // Ref mirror for toolState.variant is initialized BELOW the useTools() destructuring
  // (see toolVariantRef declaration). Declaring it here caused a TDZ because
  // `toolState` is declared later — minifier exposed the bug in prod bundles.
  const [dragAnchor, setDragAnchor] = useState<{ drawingId: string; anchorIndex: number } | null>(null);

  useEffect(() => {
    if (!parityMode) return;
    setChartType((current) => (current === 'volumeCandles' ? current : 'volumeCandles'));
  }, [parityMode]);
  const dragMoveRef = useRef<{ drawingId: string; startPoint: DrawPoint; currentPoint: DrawPoint; originalAnchors: DrawPoint[] } | null>(null);
  const dragAnchorMoveRef = useRef<{ drawingId: string; anchorIndex: number; currentPoint: DrawPoint; originalAnchors: DrawPoint[] } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<DrawPoint | null>(null);
  const [touchMode, setTouchMode] = useState<'idle' | 'pan' | 'axis-zoom' | 'scroll' | 'pinch'>('idle');
  const touchStartRef = useRef<{ x: number; y: number; zone: 'left' | 'center' | 'right' } | null>(null);
  const touchRafRef = useRef<number | null>(null);
  const drawingIndexRef = useRef(new DrawingTimeIndex());
  const drawingSpatialIndexRef = useRef(new DrawingSpatialIndex());
  const orderedDrawingsRef = useRef<Drawing[]>([]);
  const interactionLatencyRef = useRef<InteractionLatencyStore>(makeInteractionLatencyStore());
  const syncedCrosshairRef = useRef<{ time: number; price: number | null } | null>(null);
  const applyingSyncedRangeRef = useRef(false);
  const lastEmittedSyncedRangeRef = useRef<SyncedLogicalRange | null>(null);

  /* ─ Prompt modal for text/emoji tools ─ */
  const [promptRequest, setPromptRequest] = useState<ChartPromptRequest | null>(null);
  const [selectedIconPreset, setSelectedIconPreset] = useState<IconPresetSelection | null>(null);
  const [touchTooltip, setTouchTooltip] = useState<TouchTooltipState | null>(null);
  const [patternWizardHint, setPatternWizardHint] = useState<PatternWizardHintState | null>(null);
  const pendingTextPointRef = useRef<DrawPoint | null>(null);
  const pendingTextVariantRef = useRef<Exclude<ToolVariant, 'none'> | null>(null);
  // When true, the next prompt-confirm should create the pending-text drawing
  // regardless of `toolState.variant` (used by the floating toolbar's "Add text"
  // action which fires while the user is in cursor mode).
  const forceTextCreateRef = useRef(false);
  const editingDrawingIdRef = useRef<string | null>(null);
  const draftPointerStartRef = useRef<{ x: number; y: number; variant: Exclude<ToolVariant, 'none'> } | null>(null);
  // TV-parity click-click draw phase. 0 = idle/first-click, 1 = awaiting
  // second click to finalize a 2-anchor line. Reset on tool change, Escape,
  // or commit.
  const clickClickPhaseRef = useRef(0);
  // Position of the first click (client coords) for click-click drawing, used
  // to decide if a pointerup is a drag-commit vs a click-release-stay-in-draft.
  const clickClickStartRef = useRef<{ x: number; y: number } | null>(null);
  // Floating drawing toolbar projected bbox (client coords).
  const toolbarAnchorRef = useRef<FloatingToolbarAnchor>(null);
  const touchTooltipTimerRef = useRef<number | null>(null);
  const touchTooltipStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPointerDownDebugRef = useRef<{
    source: 'capture' | 'overlay';
    variant: ToolVariant;
    clientX: number;
    clientY: number;
    localX: number | null;
    chartWidth: number | null;
    axisWidth: number;
    clickedPriceAxis: boolean;
    targetTag: string | null;
    targetTestId: string | null;
  } | null>(null);

  const {
    toolState,
    drawingsRef,
    draftRef,
    draftProgressRef,
    drawingActiveRef,
    setVariant,
    setOptions,
    startDraft,
    startDraftForVariant,
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

  // Ref mirror for toolState.variant so __chartDebug.getActiveVariant() is always
  // fresh — reads this ref rather than a stale useEffect closure value.
  // Must be declared AFTER useTools() destructuring to avoid TDZ in minified bundles.
  const toolVariantRef = useRef<ToolVariant>(toolState.variant);
  toolVariantRef.current = toolState.variant;

  const resizeCallbackRef = useRef<(() => void) | null>(null);
  const { ready, chartContainerRef, overlayRef, chartRef, getActiveSeries, pointerToDataPoint, zoomToRange, transformedData } = useChart(
    data,
    visibleCount,
    chartType,
    () => resizeCallbackRef.current?.(),
    fullView ? 'full' : 'normal',
    parityMode,
    mode ?? null,
  );
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

  // Reset click-click draw phase whenever the active tool changes.
  useEffect(() => {
    clickClickPhaseRef.current = 0;
    clickClickStartRef.current = null;
  }, [toolState.variant]);

  // Disable chart's built-in click-drag panning while a drawing tool is active so
  // that pointer events routed to our overlay don't leave the chart library in a
  // stuck "pressed-mouse-move" state (cursor would otherwise pan the chart after
  // a line is committed). Re-enable when tool returns to 'none'.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const drawingActive = toolState.variant !== 'none';
    chart.applyOptions({
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: !drawingActive,
        horzTouchDrag: !drawingActive,
        vertTouchDrag: false,
      },
    });
  }, [toolState.variant]);

  // Last price sticky badge — positioned via priceToCoordinate (createPriceLine not available)
  const [lastPriceBadge, setLastPriceBadge] = useState<{ y: number; price: number; isUp: boolean } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const series = getActiveSeries();
    if (!series) return;
    const rows = transformedData.ohlcRows;
    if (rows.length < 1) { setLastPriceBadge(null); return; }
    const last = rows[rows.length - 1] as { close?: number; value?: number };
    const lastPrice = last.close ?? last.value;
    if (lastPrice == null || !Number.isFinite(lastPrice)) { setLastPriceBadge(null); return; }
    const prev = rows.length >= 2 ? (rows[rows.length - 2] as typeof last) : null;
    const prevPrice = prev ? (prev.close ?? prev.value) : null;
    const isUp = prevPrice == null || lastPrice >= prevPrice;
    const y = series.priceToCoordinate(lastPrice);
    if (y == null) { setLastPriceBadge(null); return; }
    setLastPriceBadge({ y, price: lastPrice, isUp });
  }, [ready, transformedData, getActiveSeries]);

  // Crosshair overlay — DOM refs for zero-flicker direct updates
  const crosshairYLabelRef = useRef<HTMLDivElement>(null);
  const crosshairYPriceTextRef = useRef<HTMLSpanElement>(null);
  const crosshairXLabelRef = useRef<HTMLDivElement>(null);
  const hoveredCloseBadgeRef = useRef<HTMLDivElement>(null);
  const hoveredClosePriceTextRef = useRef<HTMLSpanElement>(null);
  const crosshairHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "+" menu — state is fine since it only changes on click (not every frame)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const plusMenuOpenRef = useRef(false); // ref copy so timers/callbacks can read current value
  const [plusMenuPrice, setPlusMenuPrice] = useState<number | null>(null);
  const [plusMenuTime, setPlusMenuTime] = useState<number | null>(null);
  const [plusMenuY, setPlusMenuY] = useState(0);

  // Demo mode (TradingView "Demonstration" cursor)
  const [demoAltActive, setDemoAltActive] = useState(false);
  const demoAltActiveRef = useRef(false);
  const [showDemoHint, setShowDemoHint] = useState(true);
  const demoCursorDivRef = useRef<HTMLDivElement>(null);
  // Tracks the last non-'none' variant used, so Alt+Click in demo mode can temporarily draw
  const lastDrawingVariantRef = useRef<Exclude<ToolVariant, 'none'>>('trend');
  // Global Alt-key tracker (works in every cursor mode, not just 'demo').
  // TradingView parity: Alt+drag anywhere on the chart draws a demo-cursor
  // brush regardless of the active tool, and releasing Alt stops the brush.
  const altHeldRef = useRef(false);
  const [altHeld, setAltHeld] = useState(false);

  // ── Countdown timer to next candle on X-axis (ref-based, no re-renders) ─
  const countdownDivRef = useRef<HTMLDivElement>(null);
  const lastCandleTimeRef = useRef<number | null>(null);
  // Track latest crosshair price for the "+" click handler
  const crosshairPriceRef = useRef<number | null>(null);
  const crosshairTimeRef = useRef<number | null>(null);

  const cancelHide = useCallback(() => {
    if (crosshairHideTimerRef.current != null) {
      clearTimeout(crosshairHideTimerRef.current);
      crosshairHideTimerRef.current = null;
    }
  }, []);

  // Sync plusMenuOpen into a ref so timers/callbacks can read current value
  useEffect(() => { plusMenuOpenRef.current = plusMenuOpen; }, [plusMenuOpen]);

  const hideCrosshairOverlay = useCallback(() => {
    const yLabel = crosshairYLabelRef.current;
    const xLabel = crosshairXLabelRef.current;
    const hovBadge = hoveredCloseBadgeRef.current;
    if (yLabel) yLabel.style.display = 'none';
    if (xLabel) xLabel.style.display = 'none';
    if (hovBadge) hovBadge.style.display = 'none';
    crosshairPriceRef.current = null;
    crosshairTimeRef.current = null;
    setPlusMenuOpen(false);
    plusMenuOpenRef.current = false;
  }, []);

  // Timerized hide — used on Y-label/menu mouseLeave so mouse can traverse the gap
  const scheduleHide = useCallback(() => {
    if (crosshairHideTimerRef.current != null) clearTimeout(crosshairHideTimerRef.current);
    crosshairHideTimerRef.current = setTimeout(hideCrosshairOverlay, 200);
  }, [hideCrosshairOverlay]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready) return;
    const series = getActiveSeries();

    function handleCrosshairMove(param: unknown) {
      const ev = param as CrosshairMoveEvent;
      const yLabel = crosshairYLabelRef.current;
      const yPriceText = crosshairYPriceTextRef.current;
      const xLabel = crosshairXLabelRef.current;
      const hovBadge = hoveredCloseBadgeRef.current;
      const hovText = hoveredClosePriceTextRef.current;

      if (!ev || ev.source === 'leave' || !ev.point) {
        // Delay hide so cursor can move onto the "+" button or menu before disappearing
        if (crosshairHideTimerRef.current != null) clearTimeout(crosshairHideTimerRef.current);
        crosshairHideTimerRef.current = setTimeout(() => {
          // Don't hide Y-label while plus-menu is open — user may be hovering the menu
          if (plusMenuOpenRef.current) return;
          if (yLabel) yLabel.style.display = 'none';
          if (xLabel) xLabel.style.display = 'none';
          if (hovBadge) hovBadge.style.display = 'none';
          crosshairPriceRef.current = null;
          crosshairTimeRef.current = null;
        }, 180);
        return;
      }

      // Cancel any pending hide
      if (crosshairHideTimerRef.current != null) {
        clearTimeout(crosshairHideTimerRef.current);
        crosshairHideTimerRef.current = null;
      }

      const { x, y } = ev.point;
      const price = ev.price;
      const time = ev.time;
      const isMainPane = ev.paneId === 'main';

      crosshairPriceRef.current = isMainPane ? price : null;
      crosshairTimeRef.current = isMainPane && time != null ? Number(time) : null;

      // Update Y-axis price label
      if (yLabel && yPriceText && isMainPane && price != null) {
        yLabel.style.top = `${Math.max(0, y - 12)}px`;
        yLabel.style.display = 'flex';
        yPriceText.textContent = price.toFixed(2);
      } else if (yLabel) {
        yLabel.style.display = 'none';
        setPlusMenuOpen(false);
      }

      // Update X-axis time label
      if (xLabel && time != null) {
        const d = new Date(Number(time) * 1000);
        const pad = (n: number) => String(n).padStart(2, '0');
        const h = d.getUTCHours(), m = d.getUTCMinutes();
        const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        const dom = pad(d.getUTCDate());
        const yr2 = `'${d.getUTCFullYear().toString().slice(2)}`;
        const isIntraday = h !== 0 || m !== 0;
        const tLabel = isIntraday
          ? `${dom} ${mon} ${pad(h)}:${pad(m)}`
          : `${dom} ${mon} ${yr2}`;
        xLabel.style.left = `${x}px`;
        xLabel.textContent = tLabel;
        xLabel.style.display = 'block';
      } else if (xLabel) {
        xLabel.style.display = 'none';
      }

      // Hovered candle close badge
      if (hovBadge && hovText && time != null && series) {
        const rows = transformedData.ohlcRows;
        const t = Number(time);
        const candle = rows.find((r) => Number(r.time) === t) as ({ close?: number; open?: number; value?: number }) | undefined;
        const hovClose = candle ? (candle.close ?? candle.value ?? null) : null;
        const hovOpen = candle ? ((candle as { open?: number }).open ?? null) : null;
        const closeY = hovClose != null ? (series.priceToCoordinate(hovClose) ?? null) : null;
        const lastY = lastPriceBadge?.y ?? null;
        const tooClose = lastY != null && closeY != null && Math.abs(closeY - lastY) < 20;
        if (hovClose != null && closeY != null && !tooClose) {
          const bullish = hovOpen == null || hovClose >= hovOpen;
          hovBadge.style.top = `${Math.max(0, closeY - 12)}px`;
          hovBadge.style.display = 'flex';
          hovBadge.style.backgroundColor = bullish ? '#26a69a' : '#ef5350';
          hovText.textContent = hovClose.toFixed(2);
        } else {
          hovBadge.style.display = 'none';
        }
      } else if (hovBadge) {
        hovBadge.style.display = 'none';
      }
    }

    chart.subscribeCrosshairMove(handleCrosshairMove);
    return () => {
      try { chart.unsubscribeCrosshairMove(handleCrosshairMove); } catch { /* ignore */ }
      hideCrosshairOverlay();
      if (crosshairHideTimerRef.current != null) clearTimeout(crosshairHideTimerRef.current);
    };
  // lastPriceBadge intentionally excluded — ref callback reads it at call time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartRef, ready, getActiveSeries, transformedData, hideCrosshairOverlay]);

  const addIndicator = useCallback((indicatorId: string) => {
    setEnabledIndicators((prev) => {
      if (prev.includes(indicatorId)) return prev;
      return [...prev, indicatorId];
    });
  }, []);

  const removeEnabledIndicator = useCallback((indicatorId: string) => {
    setEnabledIndicators((prev) => prev.filter((id) => id !== indicatorId));
  }, []);

  // ── Countdown timer to next candle ────────────────────────────────────────
  // Keep the latest candle timestamp in a ref (updated on data change, no interval restart needed).
  useEffect(() => {
    const times = transformedData.times;
    lastCandleTimeRef.current = times.length > 0 ? Number(times[times.length - 1]) : null;
  }, [transformedData.times]);

  // Stable interval: only restarts when ready/resolution changes, NOT on every data update.
  useEffect(() => {
    if (!ready) return;
    const candleSec = resolutionToSeconds(resolution);
    const forceHours = candleSec >= 3600;
    const intraday = isIntradayResolution(resolution);

    const tick = () => {
      const el = countdownDivRef.current;
      const chart = chartRef.current;
      const lastTime = lastCandleTimeRef.current;
      if (!el || !chart || lastTime == null) {
        if (el) el.style.display = 'none';
        return;
      }

      // Intraday candles in ChartsPage are shifted to IST pseudo-UTC time, so
      // match that clock for countdown math to avoid session-gap artifacts.
      const nowSecRaw = Math.floor(Date.now() / 1000);
      const nowSec = intraday ? nowSecRaw + 19800 : nowSecRaw;
      const elapsed = Math.max(0, nowSec - lastTime);
      let remaining = candleSec - (elapsed % candleSec);
      if (remaining === candleSec) remaining = 0;

      // X pixel coordinate of the last data bar
      const x = chart.timeScale().timeToCoordinate(lastTime as import('@tradereplay/charts').UTCTimestamp);
      const containerW = chartContainerRef.current?.clientWidth ?? 0;
      const containerH = chartContainerRef.current?.clientHeight ?? 0;
      // Only show if the last bar is visible and not in the price-axis zone
      if (x == null || !Number.isFinite(x) || x < 0 || x > containerW - 68 || containerH === 0) {
        el.style.display = 'none';
        return;
      }

      el.style.display = 'block';
      el.style.left = `${x}px`;
      el.textContent = formatCountdown(remaining, forceHours);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [ready, resolution, chartRef, chartContainerRef]);

  // ── Custom wheel/zoom handler ─────────────────────────────────────────────
  // TradingView-accurate behavior:
  //  • Normal scroll on chart     → time-scale zoom, right edge stays fixed
  //  • Ctrl+scroll on chart       → time-scale zoom anchored at cursor X
  //  • Scroll on Y-axis area      → price-scale zoom anchored at cursor Y
  //  • Min visible bars: 2 (full zoom-in)
  //  • Max visible bars: all available data
  //  • Zoom speed: ~11% change per standard scroll notch (120 delta units)
  // Attached to the chart-interaction-surface ancestor (capture phase) so the
  // handler fires even when the cursor is over the Y-axis HTML overlay elements
  // (price label + "+" button) that live outside chartContainerRef.
  useEffect(() => {
    const container = chartContainerRef.current;
    const chart = chartRef.current as (IChartApi & { zoomPriceScale?: (d: number, y: number) => void; resetPriceScale?: (y: number) => void }) | null;
    if (!container || !chart || !ready) return;

    // Attach wheel to the chart-interaction-surface ancestor so that events
    // targeting HTML overlays (price label, + button) are also captured.
    const surface = container.closest<HTMLDivElement>('[data-testid="chart-interaction-surface"]') ?? container;

    // Width of the right price-axis panel (must match chart engine constant)
    const PRICE_AXIS_W = 68;
    const MIN_BARS = 2;

    let isCtrlHeld = false;
    let accumTimeScale = 0;
    let accumTimeCtrl = false; // ctrl state at last time-scale event
    let accumPriceScale = 0;
    let rafTimeId: number | null = null;
    let rafPriceId: number | null = null;
    let lastCursorX = 0;
    let lastCursorY = 0;

    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Control') isCtrlHeld = true; };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Control') isCtrlHeld = false; };

    // Track cursor so RAF uses the up-to-date position
    const onMouseMove = (e: MouseEvent) => {
      const rect = surface.getBoundingClientRect();
      lastCursorX = e.clientX - rect.left;
      lastCursorY = e.clientY - rect.top;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = surface.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      lastCursorX = cx;
      lastCursorY = cy;

      const containerW = surface.clientWidth || 1;
      // Y-axis area = rightmost PRICE_AXIS_W pixels → price-scale zoom only,
      // unless Ctrl is held, where TradingView uses time zoom around cursor.
      const onYAxis = cx > containerW - PRICE_AXIS_W;
      const ctrlActive = isCtrlHeld || e.metaKey;

      const deltaScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1;
      const scaled = e.deltaY * deltaScale;

      if (onYAxis && !ctrlActive) {
        // ── Price-scale zoom (hover on Y-axis) ───────────────────────────
        accumPriceScale += scaled;
        if (rafPriceId != null) return;
        rafPriceId = requestAnimationFrame(() => {
          rafPriceId = null;
          const d = accumPriceScale;
          accumPriceScale = 0;
          if (Math.abs(d) < 0.5) return;
          chart.zoomPriceScale?.(d, Math.max(0, lastCursorY));
        });
      } else {
        // ── Time-scale zoom ───────────────────────────────────────────────
        // Ctrl+scroll: anchor at cursor X (zoom around mouse pointer)
        // Normal scroll: anchor at right edge (last visible bar stays fixed)
        const useCtrl = isCtrlHeld || e.ctrlKey || e.metaKey;
        accumTimeScale += scaled;
        accumTimeCtrl = useCtrl;
        if (rafTimeId != null) return;
        rafTimeId = requestAnimationFrame(() => {
          rafTimeId = null;
          const d = accumTimeScale;
          const useCtrlAnchor = accumTimeCtrl;
          accumTimeScale = 0;
          accumTimeCtrl = false;
          if (Math.abs(d) < 0.5) return;

          const currentChart = chartRef.current;
          if (!currentChart) return;
          const timeScale = currentChart.timeScale();
          const range = timeScale.getVisibleLogicalRange();
          if (!range) return;
          const currentBars = Math.max(1, range.to - range.from + 1);
          if (!Number.isFinite(currentBars) || currentBars <= 0) return;

          // TV zoom speed: ~11% per notch
          const zoomFactor = Math.exp(-d * 0.001);
          const totalBars = Math.max(1, transformedData.ohlcRows.length);
          const maxBars = Math.max(MIN_BARS, totalBars);
          const newBars = Math.max(MIN_BARS, Math.min(maxBars, currentBars / zoomFactor));
          const barSpan = Math.max(1, newBars - 1);

          if (useCtrlAnchor) {
            // Ctrl: anchor at cursor X position
            const f = Math.max(0, Math.min(1, lastCursorX / containerW));
            const cursorBar = range.from + f * currentBars;
            const newFrom = Math.max(0, cursorBar - f * barSpan);
            timeScale.setVisibleLogicalRange({ from: newFrom, to: newFrom + barSpan });
          } else {
            // Normal scroll (TV default): keep right edge fixed, zoom from left
            const newTo = range.to;
            const newFrom = Math.max(0, newTo - barSpan);
            timeScale.setVisibleLogicalRange({ from: newFrom, to: newTo });
          }
        });
      }
    };

    const onDblClick = (e: MouseEvent) => {
      const rect = surface.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const containerW = surface.clientWidth || 1;
      // Only handle double-click in the Y-axis price area (rightmost 68px)
      if (cx > containerW - PRICE_AXIS_W) {
        // cy must be relative to the canvas element, not the surface.
        // Use the canvas (inside container) bounding rect for accuracy.
        const canvasEl = container.querySelector('canvas');
        const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : rect;
        const cy = e.clientY - canvasRect.top;
        chart.resetPriceScale?.(cy);
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: true });
    window.addEventListener('keyup', onKeyUp, { passive: true });
    surface.addEventListener('wheel', onWheel, { capture: true, passive: false });
    surface.addEventListener('mousemove', onMouseMove, { passive: true });
    surface.addEventListener('dblclick', onDblClick);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      surface.removeEventListener('wheel', onWheel, { capture: true });
      surface.removeEventListener('mousemove', onMouseMove);
      surface.removeEventListener('dblclick', onDblClick);
      if (rafTimeId != null) cancelAnimationFrame(rafTimeId);
      if (rafPriceId != null) cancelAnimationFrame(rafPriceId);
    };
  }, [chartContainerRef, chartRef, ready, transformedData.ohlcRows.length]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawingsRef, selectedDrawingId, toolState.drawings]
  );

  const clearPromptState = useCallback(() => {
    setPromptRequest(null);
    pendingTextPointRef.current = null;
    pendingTextVariantRef.current = null;
    editingDrawingIdRef.current = null;
    forceTextCreateRef.current = false;
    draftPointerStartRef.current = null;
  }, []);

  const syncPatternWizardHint = useCallback(() => {
    const draft = draftRef.current;
    if (!draft || !drawingActiveRef.current || !isWizardVariant(draft.variant)) {
      setPatternWizardHint(null);
      return;
    }

    const total = draft.anchors.length;
    const step = Math.max(1, Math.min(total, draftProgressRef.current + 1));
    const labels = PATTERN_LABELS_BY_VARIANT[draft.variant] || [];
    const pointLabel = labels[step - 1] || `P${step}`;
    const definition = getToolDefinition(draft.variant);

    setPatternWizardHint({
      toolLabel: definition?.label || draft.variant,
      pointLabel,
      step,
      total,
    });
  }, [draftProgressRef, draftRef, drawingActiveRef]);

  const exitDrawingModeIfNeeded = useCallback((variant: Exclude<ToolVariant, 'none'> | null, force = false) => {
    if ((keepDrawing && !force) || !variant) return;
    const definition = getToolDefinition(variant);
    setVariant(variant, definition?.category ?? 'lines');
  }, [keepDrawing, setVariant]);

  const handleCursorModeSelect = useCallback((mode: CursorMode) => {
    clearPromptState();
    setPatternWizardHint(null);
    setVariant('none', 'none');
    setCursorMode(mode);
  }, [clearPromptState, setCursorMode, setVariant]);

  // Test hook: expose programmatic cursor-mode setter for Playwright parity tests.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as { __tradereplaySetCursorMode?: (m: CursorMode) => void }).__tradereplaySetCursorMode = (m: CursorMode) => {
      handleCursorModeSelect(m);
    };
    (window as unknown as { __tradereplayGetCursorMode?: () => CursorMode }).__tradereplayGetCursorMode = () => cursorMode;
    return () => {
      const w = window as unknown as { __tradereplaySetCursorMode?: unknown; __tradereplayGetCursorMode?: unknown };
      delete w.__tradereplaySetCursorMode;
      delete w.__tradereplayGetCursorMode;
    };
  }, [handleCursorModeSelect, cursorMode]);

  const handleVariantSelect = useCallback((group: ToolCategory, variant: ToolVariant) => {
    clearPromptState();
    setPatternWizardHint(null);
    if (variant !== 'none') {
      lastDrawingVariantRef.current = variant;
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

  const hoverTrackingEnabled = !(toolState.variant === 'none' && (cursorMode === 'arrow' || (cursorMode === 'demo' && !demoAltActive)));

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

  const recordInteractionLatency = useCallback((metric: InteractionMetric, startedAt: number) => {
    const elapsed = Math.max(0, performance.now() - startedAt);
    const store = interactionLatencyRef.current;
    const bucket = store[metric];
    bucket.count += 1;
    bucket.totalMs += elapsed;
    bucket.maxMs = Math.max(bucket.maxMs, elapsed);
    getGlobalPerfTelemetry()?.record(`event-latency:${metric}`, elapsed);
  }, []);

  const resolveHitTarget = useCallback((
    point: DrawPoint,
    intent: 'select' | 'erase',
    preferredIds: Array<string | null> = [],
    restrictToVisible = true,
  ) => {
    const visibleRange = restrictToVisible ? getVisibleTimeRange() : null;
    const visibleIds = visibleRange ? new Set(drawingIndexRef.current.query(visibleRange)) : null;
    const preferred = preferredIds.filter((id): id is string => Boolean(id));

    const primary = resolveNearestDrawingHit(orderedDrawingsRef.current, point, {
      intent,
      spatialIndex: drawingSpatialIndexRef.current,
      includeIds: visibleIds,
      preferredIds: preferred,
    });

    if (primary.id || !visibleIds) return primary;

    return resolveNearestDrawingHit(orderedDrawingsRef.current, point, {
      intent,
      spatialIndex: drawingSpatialIndexRef.current,
      preferredIds: preferred,
    });
  }, [getVisibleTimeRange]);

  const updateHoverPoint = useCallback((clientX: number, clientY: number) => {
    const startedAt = performance.now();
    try {
      if (!hoverTrackingEnabled) {
        setHoverPoint((prev) => (prev ? null : prev));
        setHoveredDrawingId((prev) => (prev ? null : prev));
        return;
      }

      const point = pointerToDataPoint(clientX, clientY, 'free', false) ?? fallbackPoint();
      setHoverPoint((prev) => {
        if (!point) return null;
        if (!prev) return point;
        const unchangedTime = Math.abs(Number(prev.time) - Number(point.time)) < 1;
        const unchangedPrice = Math.abs(prev.price - point.price) < Math.max(0.01, Math.abs(point.price) * 0.0002);
        return unchangedTime && unchangedPrice ? prev : point;
      });

      if (!point) {
        setHoveredDrawingId((prev) => (prev ? null : prev));
        return;
      }

      const nearest = resolveHitTarget(point, 'select', [], true);
      let nextHovered = nearest.id;

      if (hoveredDrawingId) {
        const sticky = resolveHitTarget(point, 'select', [hoveredDrawingId], true);
        if (sticky.id === hoveredDrawingId) {
          if (!nearest.id || nearest.id === hoveredDrawingId) {
            nextHovered = hoveredDrawingId;
          } else if ((sticky.score - nearest.score) <= HOVER_SWITCH_MARGIN) {
            nextHovered = hoveredDrawingId;
          }
        }
      }

      setHoveredDrawingId((prev) => (prev === nextHovered ? prev : nextHovered));
    } finally {
      recordInteractionLatency('hover', startedAt);
    }
  }, [fallbackPoint, hoverTrackingEnabled, hoveredDrawingId, pointerToDataPoint, recordInteractionLatency, resolveHitTarget]);

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
    if (!fullView) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fullView]);

  useEffect(() => {
    setHoverPoint(null);
    setHoveredDrawingId(null);
    setPatternWizardHint(null);
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
    const normalized = normalizeDrawings(toolState.drawings);
    const ordered = normalized.slice().sort(compareDrawingRenderOrder);
    orderedDrawingsRef.current = ordered;
    drawingIndexRef.current.rebuild(ordered);
    drawingSpatialIndexRef.current.rebuild(ordered);
    setHoveredDrawingId((prev) => {
      if (!prev) return prev;
      return ordered.some((drawing) => drawing.id === prev && drawing.visible !== false) ? prev : null;
    });
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

      const timeScaleApi = chartRef.current?.timeScale();
      const visibleTimeRange = (() => {
        try {
          return timeScaleApi?.getVisibleRange?.() ?? null;
        } catch {
          return null;
        }
      })();
      const firstVisibleTime = Number(
        visibleTimeRange?.from
        ?? transformedData.times[0]
        ?? 0,
      );
      const lastVisibleTime = Number(
        visibleTimeRange?.to
        ?? transformedData.times[transformedData.times.length - 1]
        ?? (firstVisibleTime + 1),
      );
      const visibleTimeSpan = Math.max(1, lastVisibleTime - firstVisibleTime);

      const topVisiblePrice = series.coordinateToPrice(0);
      const bottomVisiblePrice = series.coordinateToPrice(cssHeight);
      const hasVisiblePriceBounds = topVisiblePrice != null && bottomVisiblePrice != null
        && Number.isFinite(topVisiblePrice)
        && Number.isFinite(bottomVisiblePrice);
      const maxVisiblePrice = hasVisiblePriceBounds
        ? Math.max(topVisiblePrice as number, bottomVisiblePrice as number)
        : null;
      const minVisiblePrice = hasVisiblePriceBounds
        ? Math.min(topVisiblePrice as number, bottomVisiblePrice as number)
        : null;
      const visiblePriceSpan = (maxVisiblePrice != null && minVisiblePrice != null)
        ? Math.max(1e-6, maxVisiblePrice - minVisiblePrice)
        : null;

      const estimateXFromTime = (time: number): number | null => {
        if (!Number.isFinite(time)) return null;
        return ((time - firstVisibleTime) / visibleTimeSpan) * cssWidth;
      };

      const estimateYFromPrice = (price: number): number | null => {
        if (!Number.isFinite(price)) return null;
        if (maxVisiblePrice == null || minVisiblePrice == null || visiblePriceSpan == null) return null;
        return ((maxVisiblePrice - price) / visiblePriceSpan) * cssHeight;
      };

      const clampOffscreen = (value: number, extent: number): number => {
        const pad = 2048;
        return Math.max(-pad, Math.min(extent + pad, value));
      };

      const toXY = (point: DrawPoint) => {
        const price = Number(point.price);
        const time = Number(point.time);
        let x = timeScaleApi?.timeToCoordinate(point.time) ?? null;
        let y = series.priceToCoordinate(price);

        if (x == null) {
          x = estimateXFromTime(time);
        }
        if (y == null) {
          y = estimateYFromPrice(price);
        }
        if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;

        return {
          x: clampOffscreen(x, cssWidth),
          y: clampOffscreen(y, cssHeight),
        };
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

        const resolveFibLevels = (fallback: number[]): number[] => {
          const custom = activeDrawing.options.fibLevels.trim();
          if (!custom) return fallback;

          const parsed = custom
            .split(/[\s,;]+/)
            .map((token) => Number.parseFloat(token))
            .filter((value) => Number.isFinite(value));

          if (!parsed.length) return fallback;
          return Array.from(new Set(parsed)).sort((a, b) => a - b);
        };

        const fibLabelText = (level: number, from: DrawPoint, to: DrawPoint) => {
          const pct = `${(level * 100).toFixed(1)}%`;
          const value = from.price + (to.price - from.price) * level;
          const price = value.toFixed(2);

          if (activeDrawing.options.fibLabelMode === 'price') return price;
          if (activeDrawing.options.fibLabelMode === 'both') return `${pct} (${price})`;
          return pct;
        };

        const vwapBucketKey = (time: number, interval: 'session' | 'week' | 'month'): string => {
          const date = new Date(time * 1000);
          if (interval === 'month') {
            return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
          }
          if (interval === 'week') {
            const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
            const day = utcDate.getUTCDay() || 7;
            utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
            const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
            const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
            return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
          }
          return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
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
        } else if ((v === 'brush' || v === 'highlighter' || v === 'path' || v === 'polyline' || v === 'curveTool' || v === 'doubleCurve') && points.length >= 2) {
          const smoothness = Math.max(0, Math.min(1, Number(activeDrawing.options.brushSmoothness) || 0));
          const sampleStep = Math.max(1, Math.round(2 - smoothness));
          const sampled = points.filter((_, index) => index % sampleStep === 0 || index === points.length - 1);

          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          if (v === 'highlighter') {
            ctx.globalAlpha = Math.max(0.12, activeDrawing.options.opacity * 0.35);
            ctx.lineWidth = Math.max(5, activeDrawing.options.thickness * 3.1);
          } else if (v === 'brush') {
            ctx.lineWidth = Math.max(1, activeDrawing.options.thickness * (1.15 + smoothness * 1.1));
          }

          if (v === 'curveTool' || v === 'doubleCurve') {
            const drawCurve = (offsetY: number) => {
              ctx.beginPath();
              ctx.moveTo(sampled[0].x, sampled[0].y + offsetY);
              for (let index = 1; index < sampled.length - 1; index += 1) {
                const midX = (sampled[index].x + sampled[index + 1].x) / 2;
                const midY = (sampled[index].y + sampled[index + 1].y) / 2 + offsetY;
                ctx.quadraticCurveTo(sampled[index].x, sampled[index].y + offsetY, midX, midY);
              }
              const last = sampled[sampled.length - 1];
              ctx.lineTo(last.x, last.y + offsetY);
              ctx.stroke();
            };

            drawCurve(0);
            if (v === 'doubleCurve') {
              drawCurve(Math.max(6, activeDrawing.options.thickness * 3));
            }
          } else {
            // Apply Catmull-Rom smoothing for brush/highlighter when smoothness > 0.2
            const renderPoints = (v === 'brush' || v === 'highlighter') && smoothness > 0.2
              ? catmullRomSmooth(sampled, Math.max(4, Math.round(smoothness * 10)))
              : sampled;

            ctx.beginPath();
            ctx.moveTo(renderPoints[0].x, renderPoints[0].y);
            for (let index = 1; index < renderPoints.length; index += 1) {
              ctx.lineTo(renderPoints[index].x, renderPoints[index].y);
            }
            ctx.stroke();
          }

          ctx.restore();
        } else if (v === 'ray' && points.length >= 2) {
          drawSegment(getRaySegment(points[0], points[1], cssWidth, cssHeight));
        } else if (v === 'arrowTool' && points.length >= 2) {
          // Arrow tool: line with arrowhead at the end
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.stroke();
          // Draw arrowhead
          const headSize = Math.max(8, activeDrawing.options.thickness * 4);
          const [tip, left, right] = getArrowheadPoints(points[0], points[1], headSize, headSize * 0.6);
          ctx.beginPath();
          ctx.moveTo(tip.x, tip.y);
          ctx.lineTo(left.x, left.y);
          ctx.lineTo(right.x, right.y);
          ctx.closePath();
          ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, ${activeDrawing.options.opacity})`;
          ctx.fill();
        } else if (v === 'infoLine' && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          const metrics = computeInfoLineMetrics(activeDrawing.anchors[0], activeDrawing.anchors[1], p1, p2);
          // Render rounded-rect panel near the line endpoint (TV places it near p2)
          ctx.save();
          const fontSize = Math.max(11, activeDrawing.options.textSize - 1);
          ctx.font = `400 ${fontSize}px ${activeDrawing.options.font}, sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const lines = [metrics.line1, metrics.line2, metrics.line3];
          const lineH = fontSize + 4;
          const padX = 8;
          const padY = 6;
          const widest = lines.reduce((max, l) => Math.max(max, ctx.measureText(l).width), 0);
          const panelW = widest + padX * 2 + 14; // +handle
          const panelH = lineH * lines.length + padY * 2;
          // Position: offset toward the higher anchor (TV-style), clamp inside canvas.
          let panelX = (p1.x + p2.x) / 2 + 8;
          let panelY = Math.min(p1.y, p2.y) + 8;
          panelX = Math.max(2, Math.min(panelX, cssWidth - panelW - 2));
          panelY = Math.max(2, Math.min(panelY, cssHeight - panelH - 2));
          // Background
          ctx.fillStyle = 'rgba(20, 28, 42, 0.92)';
          ctx.strokeStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.55)`;
          ctx.lineWidth = 1;
          const r = 4;
          ctx.beginPath();
          ctx.moveTo(panelX + r, panelY);
          ctx.lineTo(panelX + panelW - r, panelY);
          ctx.quadraticCurveTo(panelX + panelW, panelY, panelX + panelW, panelY + r);
          ctx.lineTo(panelX + panelW, panelY + panelH - r);
          ctx.quadraticCurveTo(panelX + panelW, panelY + panelH, panelX + panelW - r, panelY + panelH);
          ctx.lineTo(panelX + r, panelY + panelH);
          ctx.quadraticCurveTo(panelX, panelY + panelH, panelX, panelY + panelH - r);
          ctx.lineTo(panelX, panelY + r);
          ctx.quadraticCurveTo(panelX, panelY, panelX + r, panelY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Drag-handle dots (≡-style) at top-left
          ctx.fillStyle = 'rgba(180, 196, 220, 0.8)';
          for (let dy = 0; dy < 3; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              ctx.fillRect(panelX + 4 + dx * 3, panelY + 4 + dy * 3, 2, 2);
            }
          }
          // Text
          ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, ${activeDrawing.options.opacity})`;
          lines.forEach((line, idx) => {
            ctx.fillText(line, panelX + padX + 10, panelY + padY + idx * lineH);
          });
          ctx.restore();
        } else if (v === 'trendAngle' && points.length >= 2) {
          const [p1, p2] = snapTrendAngleSegment(points[0], points[1]);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          // Draw angle arc at vertex
          const arcRadius = Math.min(24, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.2);
          const startAngle = 0;
          const endAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          ctx.save();
          ctx.globalAlpha = Math.max(0.3, activeDrawing.options.opacity * 0.5);
          ctx.beginPath();
          ctx.arc(p1.x, p1.y, arcRadius, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
          ctx.stroke();
          ctx.restore();
          // Horizontal reference line
          ctx.save();
          ctx.setLineDash([2, 3]);
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p1.x + arcRadius * 1.5, p1.y);
          ctx.stroke();
          ctx.restore();
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
          const levels = resolveFibLevels(def.behaviors?.fibLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
          for (const level of levels) {
            if (level === 0) continue;
            const r = dist * level;
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, r, 0, Math.PI * 2);
            ctx.stroke();
            if (activeDrawing.options.priceLabel) {
              drawText(ctx, activeDrawing, points[0].x + r + 4, points[0].y - 4, fibLabelText(level, activeDrawing.anchors[0], activeDrawing.anchors[1]));
            }
          }
        } else if (v === 'pitchfan' && points.length >= 2) {
          const levels = resolveFibLevels(def.behaviors?.fibLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
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
            let cycleNum = 1;
            ctx.beginPath();
            const lineXs: number[] = [];
            for (let x = points[0].x; x <= cssWidth; x += spacing) {
              ctx.moveTo(x, 0);
              ctx.lineTo(x, cssHeight);
              lineXs.push(x);
            }
            for (let x = points[0].x - spacing; x >= 0; x -= spacing) {
              ctx.moveTo(x, 0);
              ctx.lineTo(x, cssHeight);
              lineXs.unshift(x);
            }
            ctx.stroke();
            // Number each cycle line at top
            ctx.save();
            ctx.font = `bold 9px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
            ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.6)`;
            ctx.textAlign = 'center';
            for (const lx of lineXs) {
              ctx.fillText(`${cycleNum}`, lx, 14);
              cycleNum += 1;
            }
            ctx.restore();
          }
        } else if (v === 'fibSpeedResistFan' && points.length >= 2) {
          const levels = resolveFibLevels(def.behaviors?.fibLevels || [0.236, 0.382, 0.5, 0.618, 0.786, 1]);
          const start = points[0];
          const end = points[1];
          // Zone fills between adjacent fan rays
          ctx.save();
          ctx.globalAlpha = Math.max(0.03, activeDrawing.options.opacity * 0.05);
          for (let li = 0; li < levels.length - 1; li += 1) {
            const t1 = { x: end.x, y: start.y + (end.y - start.y) * levels[li] };
            const t2 = { x: end.x, y: start.y + (end.y - start.y) * levels[li + 1] };
            if (li % 2 === 0) {
              ctx.beginPath();
              ctx.moveTo(start.x, start.y);
              ctx.lineTo(t1.x, t1.y);
              ctx.lineTo(t2.x, t2.y);
              ctx.closePath();
              ctx.fill();
            }
          }
          ctx.restore();
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
          // Labels at end of each fan ray
          if (activeDrawing.options.priceLabel) {
            ctx.save();
            ctx.font = `9px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
            ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.6)`;
            for (const level of levels) {
              const target = { x: end.x, y: start.y + (end.y - start.y) * level };
              ctx.fillText(`${(level * 100).toFixed(1)}%`, target.x + 4, target.y - 2);
            }
            ctx.restore();
          }
        } else if (v === 'fibTimeZone' && points.length >= 2) {
          const base = points[0];
          const spacing = Math.abs(points[1].x - points[0].x);
          if (spacing > 2) {
            const sequence = [1, 2, 3, 5, 8, 13, 21];
            // Draw alternating zone fills between fib time lines
            ctx.save();
            ctx.globalAlpha = Math.max(0.03, activeDrawing.options.opacity * 0.05);
            for (let si = 0; si < sequence.length - 1; si += 1) {
              const x1 = base.x + spacing * sequence[si];
              const x2 = base.x + spacing * sequence[si + 1];
              if (x1 > cssWidth) break;
              if (si % 2 === 0) {
                ctx.fillRect(x1, 0, Math.min(x2, cssWidth) - x1, cssHeight);
              }
            }
            ctx.restore();
            ctx.beginPath();
            for (const n of sequence) {
              const x = base.x + spacing * n;
              if (x > cssWidth) break;
              ctx.moveTo(x, 0);
              ctx.lineTo(x, cssHeight);
            }
            ctx.stroke();
            // Labels at top
            if (activeDrawing.options.priceLabel) {
              ctx.save();
              ctx.font = `9px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
              ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.6)`;
              ctx.textAlign = 'center';
              for (const n of sequence) {
                const x = base.x + spacing * n;
                if (x > cssWidth) break;
                ctx.fillText(`${n}`, x, 14);
              }
              ctx.restore();
            }
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
            // Zone fills
            ctx.save();
            ctx.globalAlpha = Math.max(0.03, activeDrawing.options.opacity * 0.05);
            for (let si = 0; si < sequence.length - 1; si += 1) {
              const x1 = end.x + spacing * sequence[si];
              const x2 = end.x + spacing * sequence[si + 1];
              if (x1 > cssWidth) break;
              if (si % 2 === 0) {
                ctx.fillRect(x1, 0, Math.min(x2, cssWidth) - x1, cssHeight);
              }
            }
            ctx.restore();
            ctx.beginPath();
            for (const n of sequence) {
              const x = end.x + spacing * n;
              if (x > cssWidth) break;
              ctx.moveTo(x, 0);
              ctx.lineTo(x, cssHeight);
            }
            ctx.stroke();
            // Labels at top
            if (activeDrawing.options.priceLabel) {
              ctx.save();
              ctx.font = `9px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
              ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.6)`;
              for (const n of sequence) {
                const x = end.x + spacing * n;
                if (x > cssWidth) break;
                ctx.fillText(`${n}`, x + 3, 12);
              }
              ctx.restore();
            }
          }
        } else if (v === 'fibCircles' && points.length >= 2) {
          const levels = resolveFibLevels(def.behaviors?.fibLevels || [0.236, 0.382, 0.5, 0.618, 0.786, 1]);
          const radiusBase = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
          for (const level of levels) {
            const radius = Math.max(1, radiusBase * level);
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
            ctx.stroke();
            // Label at right edge of circle
            if (activeDrawing.options.priceLabel) {
              ctx.save();
              ctx.font = `9px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
              ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.7)`;
              ctx.fillText(fibLabelText(level, activeDrawing.anchors[0], activeDrawing.anchors[1]), points[0].x + radius + 3, points[0].y - 2);
              ctx.restore();
            }
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
          const levels = resolveFibLevels([0.236, 0.382, 0.5, 0.618, 0.786]);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(mirror.x, mirror.y);
          for (const level of levels) {
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
          const levels = resolveFibLevels(def.behaviors?.fibLevels || [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
          const start = points[0];
          const end = points[1];
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const channelLength = Math.hypot(dx, dy) || 1;
          const normal = { x: -dy / channelLength, y: dx / channelLength };
          const channelSpan = channelLength * 0.35;
          // Zone fills between adjacent channel lines
          ctx.save();
          ctx.globalAlpha = Math.max(0.03, activeDrawing.options.opacity * 0.05);
          for (let li = 0; li < levels.length - 1; li += 1) {
            const o1 = channelSpan * levels[li];
            const o2 = channelSpan * levels[li + 1];
            if (li % 2 === 0) {
              ctx.beginPath();
              ctx.moveTo(start.x + normal.x * o1, start.y + normal.y * o1);
              ctx.lineTo(end.x + normal.x * o1, end.y + normal.y * o1);
              ctx.lineTo(end.x + normal.x * o2, end.y + normal.y * o2);
              ctx.lineTo(start.x + normal.x * o2, start.y + normal.y * o2);
              ctx.closePath();
              ctx.fill();
            }
          }
          ctx.restore();
          // Draw channel lines
          for (const level of levels) {
            const offset = channelSpan * level;
            drawSegment([
              { x: start.x + normal.x * offset, y: start.y + normal.y * offset },
              { x: end.x + normal.x * offset, y: end.y + normal.y * offset },
            ]);
            // Label at end
            if (activeDrawing.options.priceLabel) {
              ctx.save();
              ctx.font = `9px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
              ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.6)`;
              ctx.fillText(fibLabelText(level, activeDrawing.anchors[0], activeDrawing.anchors[1]),
                end.x + normal.x * offset + 4, end.y + normal.y * offset - 2);
              ctx.restore();
            }
          }
        } else if (v === 'gannFan' && points.length >= 2) {
          const start = points[0];
          const end = points[1];
          const spanX = end.x - start.x;
          const spanY = end.y - start.y;
          const ratios = [0.125, 0.25, 0.333, 0.5, 1, 2, 3, 4, 8];
          const ratioLabels = ['1×8', '1×4', '1×3', '1×2', '1×1', '2×1', '3×1', '4×1', '8×1'];
          ctx.beginPath();
          for (let ri = 0; ri < ratios.length; ri += 1) {
            const ratio = ratios[ri];
            const target = {
              x: start.x + spanX,
              y: start.y + spanY * ratio,
            };
            const segment = getRaySegment(start, target, cssWidth, cssHeight);
            ctx.moveTo(segment[0].x, segment[0].y);
            ctx.lineTo(segment[1].x, segment[1].y);
          }
          ctx.stroke();
          // Draw ratio labels at the end of each fan line
          if (activeDrawing.options.priceLabel) {
            for (let ri = 0; ri < ratios.length; ri += 1) {
              const ratio = ratios[ri];
              const target = {
                x: start.x + spanX,
                y: start.y + spanY * ratio,
              };
              const segment = getRaySegment(start, target, cssWidth, cssHeight);
              ctx.save();
              ctx.font = `9px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
              ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.7)`;
              ctx.fillText(ratioLabels[ri], segment[1].x + 3, segment[1].y - 2);
              ctx.restore();
            }
          }
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
          // Draw ratio labels on edges
          if (activeDrawing.options.priceLabel) {
            ctx.save();
            ctx.font = `8px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
            ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.5)`;
            for (let i = 1; i < 8; i += 1) {
              const frac = `${i}/8`;
              ctx.fillText(frac, x + (w * i) / 8 - 6, y - 3);
            }
            ctx.restore();
          }
        } else if (v === 'anchoredVwap' && points.length >= 1) {
          const startIndex = nearestCandleIndex(transformedData.times, activeDrawing.anchors[0].time);
          if (startIndex >= 0) {
            const interval = activeDrawing.options.vwapInterval;
            let cumulativePV = 0;
            let cumulativeVolume = 0;
            let started = false;
            let bucket = '';
            let lastX = points[0].x;
            let lastY = points[0].y;
            ctx.beginPath();
            for (let i = startIndex; i < transformedData.ohlcRows.length; i += 1) {
              const row = transformedData.ohlcRows[i];
              const x = chartRef.current?.timeScale().timeToCoordinate(row.time);
              if (x == null) continue;

              if (interval !== 'session') {
                const nextBucket = vwapBucketKey(Number(row.time), interval);
                if (bucket && nextBucket !== bucket) {
                  cumulativePV = 0;
                  cumulativeVolume = 0;
                  started = false;
                }
                bucket = nextBucket;
              }

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
              const suffix = interval === 'session' ? '' : ` ${interval}`;
              drawText(ctx, activeDrawing, lastX + 6, lastY - 8, `VWAP${suffix}`);
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
          const p3 = points[2] ?? { x: p2.x, y: p1.y - (p2.y - p1.y) };
          const left = Math.min(p1.x, p2.x, p3.x);
          const right = Math.max(p1.x, p2.x, p3.x);
          const isShort = v === 'shortPosition';
          const entryY = p1.y;
          const upperY = Math.min(p2.y, p3.y);
          const lowerY = Math.max(p2.y, p3.y);
          const targetY = isShort ? lowerY : upperY;
          const stopY = isShort ? upperY : lowerY;

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

          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath();
          ctx.arc(right, targetY, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(right, stopY, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          const entry = activeDrawing.anchors[0];
          const target = activeDrawing.anchors[1] ?? entry;
          const stop = activeDrawing.anchors[2] ?? { time: target.time, price: entry.price - (target.price - entry.price) };
          const rewardPx = Math.abs(target.price - entry.price).toFixed(2);
          const riskPx = Math.abs(stop.price - entry.price).toFixed(2);

          const label = v === 'positionForecast' ? 'Forecast' : isShort ? 'Short' : 'Long';
          const labelMode = activeDrawing.options.positionLabelMode;
          const metric = labelMode === 'price'
            ? `T ${rewardPx} / S ${riskPx}`
            : labelMode === 'both'
              ? `RR ${rr.toFixed(2)}x · T ${rewardPx} / S ${riskPx}`
              : `RR ${rr.toFixed(2)}x`;
          drawText(ctx, activeDrawing, right + 6, entryY - 8, `${label} ${metric}`);

          // Inline price labels on entry/target/stop lines (TradingView style)
          ctx.save();
          ctx.font = `bold 10px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
          ctx.textAlign = 'left';
          const entryPrice = entry.price.toFixed(2);
          const targetPrice = target.price.toFixed(2);
          const stopPrice = stop.price.toFixed(2);
          // Entry label
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.fillText(`Entry ${entryPrice}`, left + 4, entryY - 3);
          // Target label
          ctx.fillStyle = isShort ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.9)';
          ctx.fillText(`Target ${targetPrice}`, left + 4, targetY + (targetY < entryY ? -3 : 12));
          // Stop label
          ctx.fillStyle = isShort ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)';
          ctx.fillText(`Stop ${stopPrice}`, left + 4, stopY + (stopY < entryY ? -3 : 12));
          ctx.restore();
        } else if (v === 'barPattern' && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          // Draw baseline
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          const width = Math.abs(p2.x - p1.x);
          const midY = (p1.y + p2.y) / 2;
          const range = Math.abs(p2.y - p1.y) || 30;
          const barCount = Math.max(3, Math.round(width / 12));
          const barW = Math.max(3, width / barCount * 0.6);
          // Draw candlestick bars
          for (let i = 0; i < barCount; i += 1) {
            const x = p1.x + (width * (i + 0.5)) / barCount;
            const noise = Math.sin(i * 1.7) * 0.3 + Math.cos(i * 2.3) * 0.2;
            const open = midY + range * noise * 0.4;
            const close = open + range * (Math.sin(i * 0.9) * 0.25);
            const high = Math.min(open, close) - Math.abs(range * 0.1);
            const low = Math.max(open, close) + Math.abs(range * 0.1);
            const bullish = close < open;
            ctx.save();
            ctx.fillStyle = bullish ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)';
            ctx.strokeStyle = bullish ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)';
            ctx.lineWidth = 1;
            // Wick
            ctx.beginPath();
            ctx.moveTo(x, high);
            ctx.lineTo(x, low);
            ctx.stroke();
            // Body
            const top = Math.min(open, close);
            const bodyH = Math.max(1, Math.abs(close - open));
            ctx.fillRect(x - barW / 2, top, barW, bodyH);
            ctx.strokeRect(x - barW / 2, top, barW, bodyH);
            ctx.restore();
          }
        } else if (v === 'ghostFeed' && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          // Draw dashed projection line for ghost effect
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.globalAlpha = Math.max(0.3, activeDrawing.options.opacity * 0.6);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          for (let t = 0; t <= 1.4; t += 0.04) {
            const x = p1.x + dx * t;
            const y = p1.y + dy * t + Math.sin(t * Math.PI * 6) * 7;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
          // Ghost label
          ctx.font = `9px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
          ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.5)`;
          ctx.fillText('Ghost', p1.x + dx * 1.4 + 4, p1.y + dy * 1.4);
          ctx.restore();
        } else if (def.family === 'pattern') {
          // Pattern fills (semi-transparent zone between legs)
          if (points.length >= 3) {
            ctx.save();
            ctx.globalAlpha = Math.max(0.04, activeDrawing.options.opacity * 0.08);
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i += 1) {
              ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          // Draw polyline
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i += 1) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();

          // Elliott wave dashed connectors (first to last)
          const isElliott = v.startsWith('elliott');
          if (isElliott && points.length >= 3) {
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
            ctx.stroke();
            ctx.restore();
          }

          // Point labels
          const labels = PATTERN_LABELS_BY_VARIANT[v] || [];
          for (let i = 0; i < Math.min(labels.length, points.length); i += 1) {
            // Label with background circle like TradingView
            ctx.save();
            const lx = points[i].x;
            const ly = points[i].y;
            const isAbove = i > 0 ? points[i].y < points[i - 1].y : true;
            const labelOffsetY = isAbove ? -12 : 16;
            ctx.font = `bold ${Math.max(10, activeDrawing.options.textSize - 1)}px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
            const m = ctx.measureText(labels[i]);
            const boxW = Math.max(18, m.width + 8);
            const boxH = 16;
            const boxX = lx - boxW / 2;
            const boxY = ly + labelOffsetY - boxH / 2 - 2;
            ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.2)`;
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxW, boxH, 4);
            ctx.fill();
            ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, ${activeDrawing.options.opacity})`;
            ctx.textAlign = 'center';
            ctx.fillText(labels[i], lx, ly + labelOffsetY);
            ctx.restore();
          }
        } else if (def.family === 'text') {
          const text = activeDrawing.text || activeDrawing.variant;
          const px = points[0].x + 4;
          const py = points[0].y - 4;

          // Variant-specific decorations
          if (v === 'note' || v === 'comment') {
            // Note/Comment marker dot
            ctx.save();
            ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.4)`;
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if (v === 'pin') {
            // Pin handle line
            ctx.save();
            ctx.strokeStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.4)`;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[0].x, points[0].y - 20);
            ctx.stroke();
            ctx.restore();
          } else if (v === 'callout') {
            // Callout tail from anchor to text box
            ctx.save();
            ctx.strokeStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.5)`;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(px, py);
            ctx.stroke();
            ctx.restore();
          } else if (v === 'priceLabel' || v === 'priceNote') {
            // Arrow pointing to price level
            ctx.save();
            ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.6)`;
            ctx.beginPath();
            ctx.moveTo(points[0].x - 8, points[0].y);
            ctx.lineTo(points[0].x, points[0].y - 4);
            ctx.lineTo(points[0].x, points[0].y + 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          } else if (v === 'flagMark' || v === 'signpost') {
            // Small flag pole
            ctx.save();
            ctx.strokeStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.6)`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[0].x, points[0].y - 24);
            ctx.stroke();
            // Flag shape
            ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 0.25)`;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y - 24);
            ctx.lineTo(points[0].x + 14, points[0].y - 20);
            ctx.lineTo(points[0].x, points[0].y - 16);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          } else if (v === 'arrowMarker') {
            // Up arrow marker
            ctx.save();
            const sz = Math.max(8, activeDrawing.options.thickness * 3);
            ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, ${activeDrawing.options.opacity})`;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y - sz);
            ctx.lineTo(points[0].x - sz * 0.6, points[0].y);
            ctx.lineTo(points[0].x + sz * 0.6, points[0].y);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          } else if (v === 'arrowMarkUp') {
            ctx.save();
            const sz = Math.max(8, activeDrawing.options.thickness * 3);
            ctx.fillStyle = 'rgba(34,197,94,0.85)';
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y - sz);
            ctx.lineTo(points[0].x - sz * 0.6, points[0].y);
            ctx.lineTo(points[0].x + sz * 0.6, points[0].y);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          } else if (v === 'arrowMarkDown') {
            ctx.save();
            const sz = Math.max(8, activeDrawing.options.thickness * 3);
            ctx.fillStyle = 'rgba(239,68,68,0.85)';
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y + sz);
            ctx.lineTo(points[0].x - sz * 0.6, points[0].y);
            ctx.lineTo(points[0].x + sz * 0.6, points[0].y);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }

          // For arrow markers, skip text rendering
          if (v !== 'arrowMarker' && v !== 'arrowMarkUp' && v !== 'arrowMarkDown') {
            drawText(ctx, activeDrawing, px, py, text);
          }
        } else if (v === 'ellipse' && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          const cx = (p1.x + p2.x) / 2;
          const cy = (p1.y + p2.y) / 2;
          const rx = Math.abs(p2.x - p1.x) / 2;
          const ry = Math.abs(p2.y - p1.y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (v === 'arc' && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          const cx = (p1.x + p2.x) / 2;
          const cy = (p1.y + p2.y) / 2;
          const rx = Math.max(1, Math.abs(p2.x - p1.x) / 2);
          const ry = Math.max(1, Math.abs(p2.y - p1.y) / 2);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
        } else if (v === 'rotatedRectangle' && points.length >= 2) {
          // Rotated rectangle: the line from p1→p2 defines one edge, rect extends perpendicular
          const p1 = points[0];
          const p2 = points[1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const edgeLen = Math.hypot(dx, dy);
          const perpLen = edgeLen * 0.4;
          const angle = Math.atan2(dy, dx);
          const nx = -Math.sin(angle) * perpLen;
          const ny = Math.cos(angle) * perpLen;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p2.x + nx, p2.y + ny);
          ctx.lineTo(p1.x + nx, p1.y + ny);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else if (v === 'sector' && points.length >= 2) {
          // Sector (pie slice) from p1 to p2
          const p1 = points[0];
          const p2 = points[1];
          const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const startAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const sweep = Math.PI / 3; // 60° sector
          ctx.save();
          ctx.globalAlpha = Math.max(0.08, activeDrawing.options.opacity * 0.15);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.arc(p1.x, p1.y, r, startAngle - sweep / 2, startAngle + sweep / 2);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.arc(p1.x, p1.y, r, startAngle - sweep / 2, startAngle + sweep / 2);
          ctx.closePath();
          ctx.stroke();
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
          const levels = resolveFibLevels(def.behaviors?.fibLevels || [0, 0.236, 0.382, 0.5, 0.618, 1]);
          const left = Math.min(p1.x, p2.x);
          const right = Math.max(p1.x, p2.x);
          const width = right - left;
          // Draw zone fills between adjacent levels (TradingView style)
          ctx.save();
          const fillAlpha = Math.max(0.04, activeDrawing.options.opacity * 0.06);
          for (let li = 0; li < levels.length - 1; li += 1) {
            const y1 = p1.y + (p2.y - p1.y) * levels[li];
            const y2 = p1.y + (p2.y - p1.y) * levels[li + 1];
            ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, ${fillAlpha * (li % 2 === 0 ? 1 : 0.6)})`;
            ctx.fillRect(left, Math.min(y1, y2), width, Math.abs(y2 - y1));
          }
          ctx.restore();
          // Draw level lines + labels
          for (const level of levels) {
            const y = p1.y + (p2.y - p1.y) * level;
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
            if (activeDrawing.options.priceLabel) {
              // Label with background
              const label = fibLabelText(level, activeDrawing.anchors[0], activeDrawing.anchors[1] || activeDrawing.anchors[0]);
              ctx.save();
              ctx.font = `${Math.max(10, activeDrawing.options.textSize - 2)}px ${activeDrawing.options.font || 'JetBrains Mono'}, sans-serif`;
              const metrics = ctx.measureText(label);
              const labelX = right + 4;
              const labelY = y + 3;
              ctx.fillStyle = 'rgba(8, 18, 30, 0.7)';
              ctx.fillRect(labelX - 2, labelY - 10, metrics.width + 6, 14);
              ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, ${activeDrawing.options.opacity})`;
              ctx.fillText(label, labelX, labelY);
              ctx.restore();
            }
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

        const isSelected = selectedDrawingId === activeDrawing.id;
        const isHovered = !draft && hoveredDrawingIdRef.current === activeDrawing.id;

        // TV-parity: hovered drawing gets a faint brightness/glow outline + anchor dots
        if (isHovered && !isSelected) {
          ctx.save();
          ctx.strokeStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, ${Math.min(1, (activeDrawing.options.opacity) * 1.6)})`;
          ctx.lineWidth = Math.max(activeDrawing.options.thickness + 1, activeDrawing.options.thickness * 1.5);
          ctx.setLineDash(activeDrawing.options.style === 'dashed' ? [6, 4] : activeDrawing.options.style === 'dotted' ? [2, 4] : []);
          // Repaint the primary segment slightly thicker as a glow
          if (points.length >= 2) {
            const p1 = points[0];
            const p2 = points[1];
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          } else if (points.length === 1) {
            const p = points[0];
            const v = activeDrawing.variant;
            ctx.beginPath();
            if (v === 'hline') { ctx.moveTo(0, p.y); ctx.lineTo(cssWidth, p.y); }
            else if (v === 'vline') { ctx.moveTo(p.x, 0); ctx.lineTo(p.x, cssHeight); }
            else if (v === 'horizontalRay') { ctx.moveTo(p.x, p.y); ctx.lineTo(cssWidth, p.y); }
            else if (v === 'crossLine') {
              ctx.moveTo(0, p.y); ctx.lineTo(cssWidth, p.y);
              ctx.moveTo(p.x, 0); ctx.lineTo(p.x, cssHeight);
            }
            ctx.stroke();
          }
          ctx.restore();

          // Anchor dots on hover (lighter than selected dots)
          for (const anchor of points) {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.arc(anchor.x, anchor.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // TV-parity: "+Add text" inline label shown at line midpoint on hover
          if (points.length >= 1) {
            const mid = points.length >= 2
              ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
              : points[0];
            const label = '+ Add text';
            ctx.save();
            ctx.font = 'bold 11px -apple-system, system-ui, sans-serif';
            const textMetrics = ctx.measureText(label);
            const tw = textMetrics.width;
            const th = 14;
            const tx = mid.x - tw / 2;
            const ty = mid.y - 18;
            ctx.fillStyle = 'rgba(8, 18, 30, 0.72)';
            ctx.fillRect(tx - 4, ty - th + 2, tw + 8, th + 2);
            ctx.fillStyle = `rgba(${rgbFromHex(activeDrawing.options.color)}, 1)`;
            ctx.fillText(label, tx, ty);
            ctx.restore();
          }
        }

        if (isSelected) {
          for (const anchor of points) {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      };

      const visibleRange = getVisibleTimeRange();
      const orderedDrawings = orderedDrawingsRef.current;
      const visibleIds = visibleRange
        ? new Set(drawingIndexRef.current.query(visibleRange))
        : new Set(orderedDrawings.map((drawing) => drawing.id));

      for (const drawing of orderedDrawings) {
        if (!visibleIds.has(drawing.id) && drawing.id !== selectedDrawingId) continue;
        drawTool(drawing);
      }

      const syncedCrosshair = syncedCrosshairRef.current;
      if (syncedCrosshair) {
        const x = chartRef.current?.timeScale().timeToCoordinate(syncedCrosshair.time);
        if (x != null && Number.isFinite(x)) {
          ctx.save();
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255, 215, 64, 0.72)';
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, cssHeight);
          ctx.stroke();

          if (syncedCrosshair.price != null) {
            const y = series.priceToCoordinate(syncedCrosshair.price);
            if (y != null && Number.isFinite(y)) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(cssWidth, y);
              ctx.stroke();
            }
          }

          ctx.restore();
        }
      }

      if (draftRef.current) drawTool(draftRef.current, true);

      /* ── TV-parity axis highlight for the selected drawing ─────────────
         Paints a light-blue band on the price-axis gutter (Y-range) and/or
         time-axis gutter (X-range) covered by the currently selected line.
         The band updates with move/anchor drags and disappears on deselect
         or when the drawing is hidden. Mirrors TradingView behavior. */
      const axisHighlightColor = 'rgba(33, 150, 243, 0.22)';
      if (selectedDrawingId) {
        const selected = drawingsRef.current.find((d) => d.id === selectedDrawingId);
        if (selected && selected.visible !== false && selected.options.visible !== false && selected.anchors.length) {
          const anchorsForHighlight = moveState?.drawingId === selected.id
            ? translateAnchors(moveState.originalAnchors, moveState.startPoint, moveState.currentPoint)
            : anchorMoveState?.drawingId === selected.id
              ? (() => {
                  const next = anchorMoveState.originalAnchors.map((a) => ({ ...a }));
                  next[anchorMoveState.anchorIndex] = anchorMoveState.currentPoint;
                  return next;
                })()
              : selected.anchors;
          const pts = anchorsForHighlight.map(toXY).filter(Boolean) as Array<{ x: number; y: number }>;
          if (pts.length) {
            const dims = (() => {
              try { return chartRef.current?.getDimensions?.() ?? null; } catch { return null; }
            })();
            const priceAxisWidth = dims?.priceAxisWidth ?? 68;
            const timeAxisHeight = dims?.timeAxisHeight ?? 28;
            const plotW = cssWidth - priceAxisWidth;
            const plotH = cssHeight - timeAxisHeight;

            const variant = selected.variant;
            // Determine xRange / yRange per variant
            let xRange: [number, number] | null = null;
            let yRange: [number, number] | null = null;

            if (variant === 'hline') {
              yRange = [pts[0].y, pts[0].y];
              xRange = null; // full-width hline: no x-band
            } else if (variant === 'horizontalRay') {
              yRange = [pts[0].y, pts[0].y];
              // Horizontal ray may have 1 or 2 anchors. With 2, use their x-range.
              // With 1, paint a small x-band around the anchor x (TV shows a highlight
              // at the start point on the time axis).
              if (pts.length >= 2) {
                xRange = [Math.min(pts[0].x, pts[1].x), Math.max(pts[0].x, pts[1].x)];
              } else {
                xRange = [pts[0].x, pts[0].x];
              }
            } else if (variant === 'vline' || variant === 'crossLine') {
              xRange = [pts[0].x, pts[0].x];
              yRange = variant === 'crossLine' ? [pts[0].y, pts[0].y] : null;
            } else {
              const xs = pts.map((p) => p.x);
              const ys = pts.map((p) => p.y);
              xRange = [Math.min(...xs), Math.max(...xs)];
              yRange = [Math.min(...ys), Math.max(...ys)];
            }

            ctx.save();
            ctx.fillStyle = axisHighlightColor;
            // Minimum band thickness (px) for single-point variants like hline/vline/
            // horizontalRay's y-axis band, matching TV's visible highlight thickness.
            const MIN_BAND_PX = 8;
            // Time-axis (bottom) band for X range
            if (xRange && timeAxisHeight > 0) {
              const x0 = Math.max(0, Math.min(plotW, xRange[0]));
              const x1 = Math.max(0, Math.min(plotW, xRange[1]));
              const bandW = Math.max(MIN_BAND_PX, x1 - x0);
              const bandX = x1 - x0 < MIN_BAND_PX ? Math.max(0, x0 - MIN_BAND_PX / 2) : x0;
              ctx.fillRect(bandX, plotH, bandW, timeAxisHeight);
            }
            // Price-axis (right) band for Y range
            if (yRange && priceAxisWidth > 0) {
              const y0 = Math.max(0, Math.min(plotH, yRange[0]));
              const y1 = Math.max(0, Math.min(plotH, yRange[1]));
              const bandH = Math.max(MIN_BAND_PX, y1 - y0);
              const bandY = y1 - y0 < MIN_BAND_PX ? Math.max(0, y0 - MIN_BAND_PX / 2) : y0;
              ctx.fillRect(plotW, bandY, priceAxisWidth, bandH);
            }
            ctx.restore();
          }
        }
      }

      getGlobalPerfTelemetry()?.record('overlay', performance.now() - overlayStart);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      getDrawingById: (id: string) => drawingsRef.current.find((drawing) => drawing.id === id) ?? null,
      getLatestDrawingId: () => drawingsRef.current[drawingsRef.current.length - 1]?.id ?? null,
      getSelectedDrawingId: () => selectedDrawingId,
      getActiveVariant: () => toolVariantRef.current,
      getLastPointerDownDebug: () => (lastPointerDownDebugRef.current ? { ...lastPointerDownDebugRef.current } : null),
      forceSelectDrawing: (id: string | null) => {
        setSelectedDrawingId(id);
        setHoveredDrawingId(id);
        return id;
      },
      getHoveredDrawingId: () => hoveredDrawingId,
      getHoverPoint: () => (hoverPoint ? { ...hoverPoint } : null),
      getMagnetMode: () => magnetMode,
      /**
       * Returns the rendered pixel coordinates (relative to the chart pane)
       * for each anchor of a drawing. Useful for tests/diagnostics that need
       * to compare clicks-vs-drawings in pixel space.
       */
      getDrawingPixelAnchors: (id?: string | null) => {
        const list = drawingsRef.current;
        const drawing = id ? list.find((d) => d.id === id) : list[list.length - 1];
        if (!drawing) return null;
        const chart = chartRef.current;
        const series = getActiveSeries();
        if (!chart || !series) return null;
        const ts = chart.timeScale();
        const out: Array<{ x: number | null; y: number | null }> = [];
        for (const a of drawing.anchors) {
          const x = ts.timeToCoordinate(a.time as DrawPoint['time']);
          const y = series.priceToCoordinate(a.price);
          out.push({ x: typeof x === 'number' ? x : null, y: typeof y === 'number' ? y : null });
        }
        return { id: drawing.id, variant: drawing.variant, anchors: out };
      },
      /**
       * Return TV-parity info-line metrics for a given drawing id (or the
       * latest infoLine drawing if id is null). Includes both raw values and
       * formatted display strings used by the floating panel.
       */
      getInfoLineMetrics: (id?: string | null) => {
        const list = drawingsRef.current.filter((d) => d.variant === 'infoLine');
        const drawing = id ? list.find((d) => d.id === id) : list[list.length - 1];
        if (!drawing || drawing.anchors.length < 2) return null;
        const chart = chartRef.current;
        const series = getActiveSeries();
        if (!chart || !series) return null;
        const a1 = drawing.anchors[0];
        const a2 = drawing.anchors[1];
        const x1 = chart.timeScale().timeToCoordinate(a1.time as DrawPoint['time']);
        const y1 = series.priceToCoordinate(a1.price);
        const x2 = chart.timeScale().timeToCoordinate(a2.time as DrawPoint['time']);
        const y2 = series.priceToCoordinate(a2.price);
        if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
        return computeInfoLineMetrics(a1, a2, { x: x1, y: y1 }, { x: x2, y: y2 });
      },
      pointerToDataPoint: (clientX: number, clientY: number, snap: boolean) =>
        pointerToDataPoint(clientX, clientY, crosshairSnapMode, snap),
      getScrollPosition: () => chartRef.current?.timeScale().scrollPosition() ?? null,
      getVisibleLogicalRange: () => chartRef.current?.timeScale().getVisibleLogicalRange() ?? null,
      getChartBounds: () => {
        const rect = chartContainerRef.current?.getBoundingClientRect();
        if (!rect) return null;
        return {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        };
      },
      getAxisDimensions: () => {
        const chart = chartRef.current;
        if (!chart) return null;
        try {
          return chart.getDimensions?.() ?? null;
        } catch {
          return null;
        }
      },
      getClickClickPhase: () => clickClickPhaseRef.current,
      getDraftVariant: () => draftRef.current?.variant ?? null,
      getFloatingToolbarState: () => {
        // Compute fresh each call (don't rely on throttled React state) so tests
        // reading the anchor right after a pan/scroll see the updated position.
        const id = selectedDrawingId;
        const drawing = id ? drawingsRef.current.find((d) => d.id === id) : null;
        const chart = chartRef.current;
        const series = getActiveSeries();
        const overlay = overlayRef.current;
        if (!drawing || !chart || !series || !overlay) {
          const a = toolbarAnchorRef.current;
          if (!id || !a) return { visible: false, drawingId: null as string | null };
          return {
            visible: true,
            drawingId: id,
            left: a.left,
            right: a.right,
            top: a.top,
            bottom: a.bottom,
            centerX: (a.left + a.right) / 2,
            centerY: (a.top + a.bottom) / 2,
          };
        }
        const rect = overlay.getBoundingClientRect();
        const xs: number[] = [];
        const ys: number[] = [];
        for (const a of drawing.anchors) {
          const x = chart.timeScale().timeToCoordinate(a.time as DrawPoint['time']);
          const y = series.priceToCoordinate(a.price);
          if (x == null || y == null) continue;
          xs.push(rect.left + x);
          ys.push(rect.top + y);
        }
        if (!xs.length || !ys.length) {
          const a = toolbarAnchorRef.current;
          if (!a) return { visible: false, drawingId: null as string | null };
          return {
            visible: true,
            drawingId: id,
            left: a.left,
            right: a.right,
            top: a.top,
            bottom: a.bottom,
            centerX: (a.left + a.right) / 2,
            centerY: (a.top + a.bottom) / 2,
          };
        }
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        const top = Math.min(...ys);
        const bottom = Math.max(...ys);
        return {
          visible: true,
          drawingId: id,
          left,
          right,
          top,
          bottom,
          centerX: (left + right) / 2,
          centerY: (top + bottom) / 2,
        };
      },
      getDraftAnchorsClient: () => {
        const chart = chartRef.current;
        const series = getActiveSeries();
        const overlay = overlayRef.current;
        const draft = draftRef.current;
        if (!chart || !series || !overlay || !draft) return null;
        const rect = overlay.getBoundingClientRect();
        const pts = draft.anchors
          .map((a) => {
            const x = chart.timeScale().timeToCoordinate(a.time as DrawPoint['time']);
            const y = series.priceToCoordinate(a.price);
            if (x == null || y == null) return null;
            return { x: rect.left + x, y: rect.top + y };
          })
          .filter((p): p is { x: number; y: number } => Boolean(p));
        return { variant: draft.variant, anchors: pts };
      },
      scrollToPosition: (position: number) => {
        chartRef.current?.timeScale().scrollToPosition(position, false);
        return chartRef.current?.timeScale().scrollPosition() ?? null;
      },
      getToolOptions: () => ({ ...toolState.options }),
      dataPointToClient: (time: number, price: number) => {
        const chart = chartRef.current;
        const series = getActiveSeries();
        const overlay = overlayRef.current;
        if (!chart || !series || !overlay) return null;
        const x = chart.timeScale().timeToCoordinate(time as DrawPoint['time']);
        const y = series.priceToCoordinate(price);
        if (x == null || y == null) return null;
        const rect = overlay.getBoundingClientRect();
        return { x: rect.left + x, y: rect.top + y };
      },
      getProjectedAnchors: (drawingId?: string) => {
        const chart = chartRef.current;
        const series = getActiveSeries();
        const overlay = overlayRef.current;
        if (!chart || !series || !overlay) return null;
        const target = drawingId
          ? drawingsRef.current.find((drawing) => drawing.id === drawingId)
          : drawingsRef.current[drawingsRef.current.length - 1];
        if (!target) return null;
        const rect = overlay.getBoundingClientRect();
        const points = target.anchors
          .map((anchor) => {
            const x = chart.timeScale().timeToCoordinate(anchor.time as DrawPoint['time']);
            const y = series.priceToCoordinate(anchor.price);
            if (x == null || y == null) return null;
            return { x: rect.left + x, y: rect.top + y };
          })
          .filter((point): point is { x: number; y: number } => Boolean(point));
        return {
          id: target.id,
          variant: target.variant,
          anchors: points,
        };
      },
      clearDrawingsFast: () => {
        // Use clearDrawings() so a history checkpoint is pushed — prevents undo from restoring stale test state
        clearDrawings();
        setSelectedDrawingId(null);
        setHoveredDrawingId(null);
        return 0;
      },
      addSyntheticDrawings: (count: number, variant: Exclude<ToolVariant, 'none'> = 'trend') => {
        const normalizedCount = Math.max(0, Math.min(2_000, Math.floor(Number(count) || 0)));
        if (normalizedCount === 0) return 0;

        const toolDef = getToolDefinition(variant);
        if (!toolDef) return 0;

        const times = transformedData.times;
        const rows = transformedData.ohlcRows;
        if (!times.length || !rows.length) return 0;

        const startIdx = Math.max(0, times.length - 900);
        const span = Math.max(24, times.length - startIdx - 1);
        const baseOptions = { ...toolState.options };
        const created: Drawing[] = [];

        for (let i = 0; i < normalizedCount; i += 1) {
          const fromIdx = startIdx + ((i * 17) % span);
          const toIdx = Math.min(times.length - 1, fromIdx + 6 + (i % 21));
          const fromRow = rows[fromIdx] ?? rows[rows.length - 1];
          const toRow = rows[toIdx] ?? fromRow;

          const sourcePrice = Number.isFinite(fromRow.close) ? fromRow.close : fromRow.open;
          const targetPrice = Number.isFinite(toRow.close) ? toRow.close : toRow.open;
          const drift = 1 + (((i % 9) - 4) * 0.0035);

          const p1: DrawPoint = { time: times[fromIdx], price: sourcePrice };
          const p2: DrawPoint = { time: times[toIdx], price: targetPrice * drift };
          created.push(createDrawing(variant, baseOptions, p1, p2));
        }

        updateAllDrawings((prev) => [...prev, ...created], false);
        return created.length;
      },
      setHitTestTelemetryEnabled: (enabled: boolean) => {
        setHitTestTelemetryEnabled(Boolean(enabled));
        return getHitTestTelemetrySnapshot();
      },
      resetHitTestStats: () => {
        resetHitTestTelemetry();
        return getHitTestTelemetrySnapshot();
      },
      getHitTestStats: () => getHitTestTelemetrySnapshot(),
      getSpatialHitTestStats: () => drawingSpatialIndexRef.current.getStats(),
      getInteractionLatencyStats: () => getInteractionLatencySnapshot(interactionLatencyRef.current),
      resetInteractionLatencyStats: () => {
        interactionLatencyRef.current = makeInteractionLatencyStore();
        return getInteractionLatencySnapshot(interactionLatencyRef.current);
      },
    };
    (window as unknown as Record<string, unknown>).__chartDebug = debug;
    return () => {
      delete (window as unknown as Record<string, unknown>).__chartDebug;
    };
  }, [
    chartRef,
    crosshairSnapMode,
    drawingsRef,
    getActiveSeries,
    hoverPoint,
    hoveredDrawingId,
    magnetMode,
    overlayRef,
    pointerToDataPoint,
    selectedDrawingId,
    toolState.history.length,
    toolState.options,
    transformedData.ohlcRows,
    transformedData.times,
    clearDrawings,
    updateAllDrawings,
  ]);

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
    if (!syncBus || !syncId) {
      syncedCrosshairRef.current = null;
      return;
    }

    return syncBus.subscribe((event) => {
      if (event.sourceId === syncId) return;

      if (event.type === 'crosshair') {
        syncedCrosshairRef.current = event.payload
          ? { time: event.payload.time, price: event.payload.price }
          : null;
        renderOverlay();
        return;
      }

      const chart = chartRef.current;
      if (!chart || !event.payload) return;

      const currentRange = chart.timeScale().getVisibleLogicalRange();
      if (logicalRangeEquals(currentRange, event.payload)) return;

      applyingSyncedRangeRef.current = true;
      chart.timeScale().setVisibleLogicalRange(event.payload);
      void Promise.resolve().then(() => {
        applyingSyncedRangeRef.current = false;
      });
    });
  }, [chartRef, renderOverlay, syncBus, syncId]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !syncBus || !syncId) return;

    const emitRange = () => {
      if (applyingSyncedRangeRef.current) return;
      const range = chart.timeScale().getVisibleLogicalRange();
      if (!range) return;
      const payload = { from: range.from, to: range.to };
      if (logicalRangeEquals(lastEmittedSyncedRangeRef.current, payload)) return;
      lastEmittedSyncedRangeRef.current = payload;
      syncBus.emit({ type: 'range', sourceId: syncId, payload });
    };

    chart.timeScale().subscribeVisibleTimeRangeChange(emitRange);
    return () => {
      try {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(emitRange);
      } catch {
        // Chart may have been removed.
      }
    };
  }, [chartRef, ready, syncBus, syncId]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !syncBus || !syncId) return;

    const emitCrosshair = (param: unknown) => {
      const payload = param as CrosshairMoveEvent;
      if (!payload || payload.time == null || payload.source === 'leave') {
        syncBus.emit({ type: 'crosshair', sourceId: syncId, payload: null });
        return;
      }

      const time = Number(payload.time);
      if (!Number.isFinite(time)) {
        syncBus.emit({ type: 'crosshair', sourceId: syncId, payload: null });
        return;
      }

      syncBus.emit({
        type: 'crosshair',
        sourceId: syncId,
        payload: {
          time,
          price: typeof payload.price === 'number' ? payload.price : null,
        },
      });
    };

    chart.subscribeCrosshairMove(emitCrosshair);
    return () => {
      try {
        chart.unsubscribeCrosshairMove(emitCrosshair);
      } catch {
        // Chart may have been removed.
      }
      syncBus.emit({ type: 'crosshair', sourceId: syncId, payload: null });
    };
  }, [chartRef, ready, syncBus, syncId]);

  useEffect(() => {
    syncedCrosshairRef.current = null;
    lastEmittedSyncedRangeRef.current = null;
  }, [syncId, symbol]);

  useEffect(() => {
    resetForSymbol();
    setSelectedDrawingId(null);
    setHoveredDrawingId(null);
    setPatternWizardHint(null);
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
      // Ctrl+Z: undo drawing history
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      // Ctrl+Y or Ctrl+Shift+Z: redo drawing history
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedDrawingId) {
        const d = drawingsRef.current.find((item) => item.id === selectedDrawingId);
        if (d?.locked) return;
        removeDrawing(selectedDrawingId);
        setSelectedDrawingId(null);
        setHoveredDrawingId((prev) => (prev === selectedDrawingId ? null : prev));
        return;
      }
      // TV-parity: Ctrl+Z / Cmd+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo.
      // Skip when typing in an input/textarea/contenteditable element.
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || (target?.isContentEditable === true);
      if (isEditable) return;
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawingsRef, removeDrawing, selectedDrawingId, undo, redo]);

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
      const wasDrawing = drawingActiveRef.current;
      const isInteracting = wasDrawing || dragMoveRef.current || dragAnchorMoveRef.current || dragAnchor;
      if (!isInteracting) {
        // TV-parity: Escape with no active interaction deselects the
        // currently selected drawing (returns to normal mode) and exits any
        // active tool. Do NOT touch focus on form elements.
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || target?.isContentEditable === true) return;
        if (selectedDrawingId) {
          setSelectedDrawingId(null);
          setHoveredDrawingId(null);
          renderOverlay();
        }
        if (toolState.variant !== 'none') {
          // Exit any active drawing tool (TV-parity Escape behavior).
          exitDrawingModeIfNeeded(toolState.variant as Exclude<ToolVariant, 'none'>, true);
        }
        return;
      }
      cancelDraft();
      clickClickPhaseRef.current = 0;
      clickClickStartRef.current = null;
      setPatternWizardHint(null);
      dragMoveRef.current = null;
      dragAnchorMoveRef.current = null;
      draftPointerStartRef.current = null;
      setDragAnchor(null);
      // TV-parity: Escape cancels draft AND fully exits drawing mode (ignores keepDrawing)
      if (wasDrawing) {
        exitDrawingModeIfNeeded(lastDrawingVariantRef.current as Exclude<ToolVariant, 'none'> | null, true);
      }
      renderOverlay();
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [cancelDraft, dragAnchor, drawingActiveRef, exitDrawingModeIfNeeded, renderOverlay, selectedDrawingId, toolState.variant]);

  useEffect(() => {
    if (!fullView) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (drawingActiveRef.current || dragMoveRef.current || dragAnchorMoveRef.current || dragAnchor) return;
      setFullView(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragAnchor, fullView]);

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

  const getPriceAxisHitInfo = useCallback((clientX: number) => {
    const chartRect = chartContainerRef.current?.getBoundingClientRect();
    if (!chartRect || chartRect.width <= 0) {
      return {
        isAxis: false,
        localX: null,
        chartWidth: null,
        axisWidth: PRICE_AXIS_WIDTH_PX,
      };
    }

    const chartWidth = chartRect.width;
    const axisWidth = chartWidth <= PRICE_AXIS_WIDTH_PX + 20
      ? Math.max(24, Math.floor(chartWidth * 0.24))
      : PRICE_AXIS_WIDTH_PX;

    const localX = clientX - chartRect.left;
    return {
      isAxis: localX > chartWidth - axisWidth,
      localX,
      chartWidth,
      axisWidth,
    };
  }, [chartContainerRef, chartRef]);

  const isPriceAxisClientX = useCallback((clientX: number): boolean => getPriceAxisHitInfo(clientX).isAxis, [getPriceAxisHitInfo]);

  useEffect(() => {
    const surface = chartContainerRef.current?.closest<HTMLDivElement>('[data-testid="chart-interaction-surface"]');
    if (!surface) return;

    const onPointerDownCapture = (event: PointerEvent) => {
      if (toolVariantRef.current !== 'none') return;
      const axisInfo = getPriceAxisHitInfo(event.clientX);
      const target = event.target as HTMLElement | null;
      lastPointerDownDebugRef.current = {
        source: 'capture',
        variant: toolVariantRef.current,
        clientX: event.clientX,
        clientY: event.clientY,
        localX: axisInfo.localX,
        chartWidth: axisInfo.chartWidth,
        axisWidth: axisInfo.axisWidth,
        clickedPriceAxis: axisInfo.isAxis,
        targetTag: target?.tagName?.toLowerCase() ?? null,
        targetTestId: target?.getAttribute?.('data-testid') ?? null,
      };

      if (!axisInfo.isAxis) return;

      setSelectedDrawingId(null);
      setHoveredDrawingId(null);
      renderOverlay();
    };

    surface.addEventListener('pointerdown', onPointerDownCapture, true);
    return () => {
      surface.removeEventListener('pointerdown', onPointerDownCapture, true);
    };
  }, [chartContainerRef, getPriceAxisHitInfo, renderOverlay]);

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
    const startedAt = performance.now();
    try {
      clearTouchTooltip();
      draftPointerStartRef.current = null;
      dragAnchorMoveRef.current = null;

      // ── Alt+drag anywhere → demo cursor brush (TradingView parity) ──
      // The library's canvas-level pointerdown handler natively owns the
      // Alt+drag gesture (start, extend, end). We intentionally DO NOT
      // invoke demoCursor().beginStroke here: doing so would double-fire
      // (once from canvas native, once from this React surface) and create
      // duplicate strokes. Just swallow the event so active tools / selection
      // / eraser do not react to an Alt-modified click.
      if (event.altKey || altHeldRef.current) {
        event.preventDefault();
        return;
      }

      const freePoint = pointerToDataPoint(event.clientX, event.clientY, 'free', false);
      const axisInfo = getPriceAxisHitInfo(event.clientX);
      const clickedPriceAxis = axisInfo.isAxis;
      const target = event.target as HTMLElement | null;
      lastPointerDownDebugRef.current = {
        source: 'overlay',
        variant: toolState.variant,
        clientX: event.clientX,
        clientY: event.clientY,
        localX: axisInfo.localX,
        chartWidth: axisInfo.chartWidth,
        axisWidth: axisInfo.axisWidth,
        clickedPriceAxis,
        targetTag: target?.tagName?.toLowerCase() ?? null,
        targetTestId: target?.getAttribute?.('data-testid') ?? null,
      };

      if (cursorMode === 'eraser' && toolState.variant === 'none') {
        const preferred = [selectedDrawingId, hoveredDrawingId].filter((id): id is string => Boolean(id));
        const erasePoint = freePoint ?? hoverPoint ?? fallbackPoint();
        const targetId = erasePoint
          ? resolveHitTarget(erasePoint, 'erase', preferred).id ?? preferred[0] ?? null
          : preferred[0] ?? null;
        if (targetId) {
          removeDrawing(targetId);
          if (selectedDrawingId === targetId) {
            setSelectedDrawingId(null);
          }
          if (hoveredDrawingId === targetId) {
            setHoveredDrawingId(null);
          }
        }
        renderOverlay();
        return;
      }

      // Demo mode: Alt key held → temporarily draw with last used tool (TV parity)
      if (demoAltActiveRef.current && cursorMode === 'demo' && toolState.variant === 'none' && !drawingActiveRef.current) {
        const tempVariant = lastDrawingVariantRef.current;
        const point = pointerToDataPoint(event.clientX, event.clientY, resolvePointerSnapMode(), magnetMode) || fallbackPoint();
        if (!point) { renderOverlay(); return; }
        draftPointerStartRef.current = { x: event.clientX, y: event.clientY, variant: tempVariant };
        const result = startDraftForVariant(tempVariant, point);
        syncPatternWizardHint();
        if (result.kind === 'finalized') {
          draftPointerStartRef.current = null;
          setPatternWizardHint(null);
          const d = drawingsRef.current[drawingsRef.current.length - 1];
          if (d) {
            setSelectedDrawingId(d.id);
            setHoveredDrawingId(d.id);
          }
        }
        renderOverlay();
        if (event.currentTarget.setPointerCapture) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        return;
      }

      if (toolState.variant === 'none') {
        if (clickedPriceAxis) {
          setSelectedDrawingId(null);
          setHoveredDrawingId(null);
          renderOverlay();
          return;
        }

        if (!freePoint) {
          setSelectedDrawingId(null);
          setHoveredDrawingId(null);
          renderOverlay();
          return;
        }

        const candidate = resolveHitTarget(freePoint, 'select', [selectedDrawingId, hoveredDrawingId]).id;
        // Pixel-space sanity check: the data-space hit-test (resolveHitTarget)
        // uses very lax normalization (priceScale = 3% of price; timeScale ≈ 2
        // days; limit 2.5), so it can match almost any chart click against an
        // existing drawing. Re-validate the candidate in pixel space against
        // its own rendered geometry so "click on empty area deselects" works
        // exactly like TradingView. Threshold: 24 px (TV uses ~10-15 px; we
        // allow extra slack so magnet/snap drift between cursor and committed
        // anchor still keeps the drawing easy to grab on a re-click).
        const SELECT_PIXEL_TOLERANCE = 24;
        let selected: string | null = candidate;
        if (candidate) {
          const drawing = drawingsRef.current.find((d) => d.id === candidate);
          const chart = chartRef.current;
          const series = getActiveSeries?.();
          // Use the chart container's bounding rect (not the surface) so that
          // chart.timeScale().timeToCoordinate() / series.priceToCoordinate()
          // (which are relative to the chart pane) line up with our click.
          const chartRect = chartContainerRef.current?.getBoundingClientRect?.()
            ?? overlayRef.current?.getBoundingClientRect?.()
            ?? (event.currentTarget as HTMLElement)?.getBoundingClientRect?.();
          if (drawing && chart && series && chartRect && drawing.anchors?.length) {
            const clickPx = { x: event.clientX - chartRect.left, y: event.clientY - chartRect.top };
            const ts = chart.timeScale();
            const pts: Array<{ x: number; y: number }> = [];
            for (const a of drawing.anchors) {
              const x = ts.timeToCoordinate(a.time as import('@tradereplay/charts').UTCTimestamp);
              const y = (series as any).priceToCoordinate?.(a.price);
              if (typeof x === 'number' && typeof y === 'number') pts.push({ x, y });
            }
            // Variants whose visual extends infinitely: skip pixel re-check
            const v = drawing.variant;
            const isInfiniteHorizontal = v === 'hline';
            const isInfiniteVertical = v === 'vline';
            const isCross = v === 'crossLine';
            const isExtended = v === 'extendedLine' || drawing.options?.extendLeft || drawing.options?.extendRight;
            const isRayLike = v === 'ray' || v === 'horizontalRay' || drawing.options?.rayMode;
            // Compute pixel distance heuristically per variant
            let bestPx = Number.POSITIVE_INFINITY;
            if (pts.length === 0) {
              bestPx = 0; // unknown; preserve candidate
            } else if (isInfiniteHorizontal) {
              bestPx = Math.abs(clickPx.y - pts[0].y);
            } else if (isInfiniteVertical) {
              bestPx = Math.abs(clickPx.x - pts[0].x);
            } else if (isCross) {
              bestPx = Math.min(Math.abs(clickPx.y - pts[0].y), Math.abs(clickPx.x - pts[0].x));
            } else if (v === 'horizontalRay' && pts.length === 1) {
              // 1-anchor horizontal ray: extends horizontally to the right
              // from anchor[0]. Distance is |dy| if click is right of anchor,
              // else hypot to the anchor endpoint.
              if (clickPx.x >= pts[0].x) {
                bestPx = Math.abs(clickPx.y - pts[0].y);
              } else {
                bestPx = Math.hypot(clickPx.x - pts[0].x, clickPx.y - pts[0].y);
              }
            } else if (isExtended && pts.length >= 2) {
              const a0 = pts[0], a1 = pts[1];
              const dx = a1.x - a0.x, dy = a1.y - a0.y;
              const len2 = dx * dx + dy * dy || 1;
              const num = Math.abs(dy * clickPx.x - dx * clickPx.y + a1.x * a0.y - a1.y * a0.x);
              bestPx = num / Math.sqrt(len2);
            } else if (isRayLike && pts.length >= 2) {
              const a0 = pts[0], a1 = pts[1];
              const dx = a1.x - a0.x, dy = a1.y - a0.y;
              const len2 = dx * dx + dy * dy || 1;
              const t = ((clickPx.x - a0.x) * dx + (clickPx.y - a0.y) * dy) / len2;
              if (t < 0) {
                bestPx = Math.hypot(clickPx.x - a0.x, clickPx.y - a0.y);
              } else {
                const num = Math.abs(dy * clickPx.x - dx * clickPx.y + a1.x * a0.y - a1.y * a0.x);
                bestPx = num / Math.sqrt(len2);
              }
            } else {
              // Polyline/segment: min distance to any segment between consecutive anchors,
              // plus distance to each anchor (handles single-point and tight shapes).
              for (const p of pts) {
                bestPx = Math.min(bestPx, Math.hypot(clickPx.x - p.x, clickPx.y - p.y));
              }
              for (let i = 0; i < pts.length - 1; i += 1) {
                const a0 = pts[i], a1 = pts[i + 1];
                const dx = a1.x - a0.x, dy = a1.y - a0.y;
                const len2 = dx * dx + dy * dy;
                if (len2 < 1e-6) continue;
                let t = ((clickPx.x - a0.x) * dx + (clickPx.y - a0.y) * dy) / len2;
                t = Math.max(0, Math.min(1, t));
                const px = a0.x + t * dx, py = a0.y + t * dy;
                bestPx = Math.min(bestPx, Math.hypot(clickPx.x - px, clickPx.y - py));
              }
            }
            if (bestPx > SELECT_PIXEL_TOLERANCE) selected = null;
          }
        }
        setSelectedDrawingId(selected);
        setHoveredDrawingId((prev) => (selected ? selected : (prev ? null : prev)));
        if (selected) {
          const drawing = drawingsRef.current.find((item) => item.id === selected);
          const drawingDefinition = drawing ? getToolDefinition(drawing.variant) : null;

          if (
            drawing
            && drawingDefinition?.family === 'text'
            && drawingDefinition.capabilities.supportsText
            && event.detail >= 2
          ) {
            pendingTextPointRef.current = drawing.anchors[0] || freePoint;
            pendingTextVariantRef.current = drawing.variant as Exclude<ToolVariant, 'none'>;
            editingDrawingIdRef.current = drawing.id;
            setPromptRequest({
              title: `Edit ${drawingDefinition.label}`,
              label: 'Update text',
              defaultValue: drawing.text || '',
              preview: true,
              allowStyleControls: true,
              styleOptions: {
                font: drawing.options.font,
                textSize: drawing.options.textSize,
                bold: drawing.options.bold,
                italic: drawing.options.italic,
                align: drawing.options.align,
                textBackground: drawing.options.textBackground,
                textBorder: drawing.options.textBorder,
              },
            });
            renderOverlay();
            return;
          }

          if (drawing && !drawing.locked) {
            // Pixel-distance anchor hit test — the previous (time, price) tolerance
            // was too loose when two anchors were close (trend lines with small
            // horizontal span would always match anchor[0]). Use screen-space
            // Euclidean distance with a 12px radius instead.
            const chartApi = chartRef.current;
            const seriesApi = getActiveSeries();
            const overlayEl = overlayRef.current;
            const rect = overlayEl?.getBoundingClientRect();
            const HIT_RADIUS_PX = 12;
            let idx = -1;
            if (chartApi && seriesApi && rect) {
              const px = event.clientX - rect.left;
              const py = event.clientY - rect.top;
              let bestDist = HIT_RADIUS_PX * HIT_RADIUS_PX;
              drawing.anchors.forEach((a, i) => {
                const ax = chartApi.timeScale().timeToCoordinate(a.time as DrawPoint['time']);
                const ay = seriesApi.priceToCoordinate(a.price);
                if (ax == null || ay == null) return;
                const dx = ax - px;
                const dy = ay - py;
                const d2 = dx * dx + dy * dy;
                if (d2 <= bestDist) {
                  bestDist = d2;
                  idx = i;
                }
              });
            }
            if (idx >= 0) {
              setDragAnchor({ drawingId: selected, anchorIndex: idx });
              dragAnchorMoveRef.current = {
                drawingId: selected,
                anchorIndex: idx,
                currentPoint: freePoint,
                originalAnchors: drawing.anchors.map((anchor) => ({ ...anchor })),
              };
            } else {
              dragMoveRef.current = {
                drawingId: selected,
                startPoint: freePoint,
                currentPoint: freePoint,
                originalAnchors: drawing.anchors.map((anchor) => ({ ...anchor })),
              };
            }
          }
          // Only capture pointer on this div when dragging a drawing — otherwise
          // let the chart canvas (which captured it first on pointerdown) keep
          // its capture so pan/scale drag stops correctly on mouseup.
          if (event.currentTarget.setPointerCapture && (dragMoveRef.current || dragAnchorMoveRef.current)) {
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }
        renderOverlay();
        return;
      }

      const point = pointerToDataPoint(event.clientX, event.clientY, resolvePointerSnapMode(), magnetMode);
      if (!point) return;

      const needsText = activeDefinition?.family === 'text' && activeDefinition.capabilities.supportsText && toolState.variant !== 'priceLabel';
      if (needsText) {
        pendingTextPointRef.current = point;
        const variant = toolState.variant as Exclude<typeof toolState.variant, 'none'>;
        pendingTextVariantRef.current = variant;
        editingDrawingIdRef.current = null;
        const iconPreset = selectedIconPreset && selectedIconPreset.variant === variant ? selectedIconPreset : null;
        const sharedStyle = {
          allowStyleControls: true,
          styleOptions: {
            font: toolState.options.font,
            textSize: toolState.options.textSize,
            bold: toolState.options.bold,
            italic: toolState.options.italic,
            align: toolState.options.align,
            textBackground: toolState.options.textBackground,
            textBorder: toolState.options.textBorder,
          },
        } as const;
        setPromptRequest(
          iconPreset
            ? { title: iconPreset.title, label: iconPreset.label, defaultValue: iconPreset.defaultValue, preview: iconPreset.preview ?? true, ...sharedStyle }
            : variant === 'emoji'
              ? { title: 'Emoji', label: 'Enter emoji', defaultValue: '🚀', preview: true, ...sharedStyle }
              : variant === 'sticker'
                ? { title: 'Sticker', label: 'Enter sticker text', defaultValue: 'WAGMI', preview: true, ...sharedStyle }
                : variant === 'iconTool'
                  ? { title: 'Icon', label: 'Enter symbol', defaultValue: '★', preview: true, ...sharedStyle }
                  : {
                      title: activeDefinition?.label || 'Text',
                      label: 'Enter text',
                      defaultValue: activeDefinition?.label === 'Note' ? 'Note' : 'Text',
                      preview: true,
                      ...sharedStyle,
                    },
        );
        return;
      }

      const text = activeDefinition?.family === 'text' && activeDefinition.capabilities.supportsText ? '' : undefined;
      const activeVariant = toolState.variant as Exclude<ToolVariant, 'none'>;

      // TV-parity click-click mode: for 2-anchor line tools, the FIRST click
      // starts the draft; a SECOND click (on a non-touch device) commits it.
      // Between clicks the cursor moves freely updating anchor[1] without any
      // button pressed.
      const useClickClick = event.pointerType !== 'touch' && isClickClickVariant(activeVariant);
      if (useClickClick && clickClickPhaseRef.current === 1 && drawingActiveRef.current && draftRef.current?.variant === activeVariant) {
        // Second click: set final anchor[1] to clicked point, then commit.
        updateDraft(point);
        const committed = finalizeDraft();
        clickClickPhaseRef.current = 0;
        clickClickStartRef.current = null;
        draftPointerStartRef.current = null;
        setPatternWizardHint(null);
        if (committed) {
          setSelectedDrawingId(committed.id);
          setHoveredDrawingId(committed.id);
          exitDrawingModeIfNeeded(committed.variant);
          // Dispatch synthetic mouseup to chart canvas so any drag/pan state
          // accumulated from this pointerdown is cleared (TV-parity: no ghost pan)
          const container = chartContainerRef.current;
          const target = container?.querySelector('canvas') as HTMLElement | null;
          if (target) {
            try {
              target.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true, cancelable: true,
                clientX: event.clientX, clientY: event.clientY,
                button: 0, buttons: 0,
              }));
            } catch {
              // ignore
            }
          }
        }
        renderOverlay();
        if (event.currentTarget.setPointerCapture) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        return;
      }

      if (!isPointOnlyVariant(activeVariant) && !isWizardVariant(activeVariant)) {
        draftPointerStartRef.current = { x: event.clientX, y: event.clientY, variant: activeVariant };
      } else {
        draftPointerStartRef.current = null;
      }
      const result = startDraft(point, text);
      syncPatternWizardHint();
      if (useClickClick && result.kind === 'draft') {
        // First click established; mark phase=1 so pointerup won't finalize
        // unless the user dragged a meaningful distance.
        clickClickPhaseRef.current = 1;
        clickClickStartRef.current = { x: event.clientX, y: event.clientY };
        // Suppress the "short drag → treat as misclick and delete" guard:
        // click-click legitimately has zero drag distance on pointerup.
        draftPointerStartRef.current = null;
      }
      if (result.kind === 'finalized') {
        draftPointerStartRef.current = null;
        setPatternWizardHint(null);
        const d = drawingsRef.current[drawingsRef.current.length - 1];
        if (d) {
          setSelectedDrawingId(d.id);
          setHoveredDrawingId(d.id);
          exitDrawingModeIfNeeded(d.variant);
        }
      }
      renderOverlay();
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } finally {
      recordInteractionLatency('pointerdown', startedAt);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const startedAt = performance.now();
    try {
      // Alt-driven demo stroke: handled natively by the library on the canvas.
      // We still bail out here so drawing/hover logic does not interfere while
      // an Alt gesture is in progress.
      if (event.altKey || altHeldRef.current) {
        return;
      }
      const isEditingDrawing = Boolean(dragMoveRef.current || dragAnchor || dragAnchorMoveRef.current || drawingActiveRef.current);
      if (!isEditingDrawing) {
        updateHoverPoint(event.clientX, event.clientY);
      }

      const shouldUseFreePointer = Boolean(dragMoveRef.current || dragAnchor || dragAnchorMoveRef.current);
      const pointerPoint = pointerToDataPoint(
        event.clientX,
        event.clientY,
        shouldUseFreePointer ? 'free' : resolvePointerSnapMode(),
        shouldUseFreePointer ? false : magnetMode,
      );
      if (!pointerPoint) return;
      const point = pointerPoint;

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
    } finally {
      recordInteractionLatency('pointermove', startedAt);
    }
  };

  const onChartContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const point = pointerToDataPoint(event.clientX, event.clientY, 'free', false) || fallbackPoint();
    if (!point) return;

    const selected = resolveHitTarget(point, 'select', [selectedDrawingId, hoveredDrawingId]).id;
    if (!selected) return;

    setSelectedDrawingId(selected);
    setHoveredDrawingId(selected);
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
    // demo: hide system cursor when red overlay circle is shown; switch to crosshair when Alt held
    demo: demoAltActive ? 'crosshair' : 'none',
    eraser: buildEraserCursor(),
  };

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Show crosshair for: active drawing tool, non-arrow/demo cursor modes, or when Alt held in demo mode
    const showCrosshair = toolState.variant !== 'none' || (cursorMode !== 'arrow' && (cursorMode !== 'demo' || demoAltActive));
    const hiddenColor = 'rgba(0, 0, 0, 0)';
    const crosshairPalette = parityMode
      ? {
          vertColor: 'rgba(120, 123, 134, 0.75)',
          horzColor: 'rgba(120, 123, 134, 0.75)',
          vertLabel: '#787b86',
          horzLabel: '#787b86',
        }
      : {
          vertColor: 'rgba(0, 209, 255, 0.72)',
          horzColor: 'rgba(255, 0, 0, 0.65)',
          vertLabel: '#00d1ff',
          horzLabel: '#ff0000',
        };

    chart.applyOptions({
      crosshair: {
        vertLine: {
          color: showCrosshair ? crosshairPalette.vertColor : hiddenColor,
          width: 1,
          style: 2,
          labelBackgroundColor: showCrosshair ? crosshairPalette.vertLabel : hiddenColor,
        },
        horzLine: {
          color: showCrosshair ? crosshairPalette.horzColor : hiddenColor,
          width: 1,
          style: 2,
          labelBackgroundColor: showCrosshair ? crosshairPalette.horzLabel : hiddenColor,
        },
      },
    });

    if (!showCrosshair) {
      setHoverPoint(null);
      setHoveredDrawingId(null);
    }
  }, [chartRef, cursorMode, demoAltActive, parityMode, toolState.variant]);

  // ── Demo mode: track Alt key to temporarily enable crosshair/drawing ──────
  useEffect(() => {
    if (cursorMode !== 'demo') {
      // Reset when leaving demo mode
      demoAltActiveRef.current = false;
      setDemoAltActive(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault();
        demoAltActiveRef.current = true;
        setDemoAltActive(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        demoAltActiveRef.current = false;
        setDemoAltActive(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      demoAltActiveRef.current = false;
      setDemoAltActive(false);
    };
  }, [cursorMode]);

  // ── Demo mode: update red cursor circle position via mousemove ────────────
  useEffect(() => {
    const el = demoCursorDivRef.current;
    if (!el) return;
    if (cursorMode !== 'demo') {
      el.style.display = 'none';
      return;
    }
    const container = chartContainerRef.current;
    if (!container) return;
    const surface = container.closest<HTMLDivElement>('[data-testid="chart-interaction-surface"]') ?? container;
    const onMove = (e: MouseEvent) => {
      const rect = surface.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.display = demoAltActiveRef.current ? 'none' : 'block';
    };
    const onLeave = () => { el.style.display = 'none'; };
    const onEnter = () => { if (!demoAltActiveRef.current) el.style.display = 'block'; };
    surface.addEventListener('mousemove', onMove);
    surface.addEventListener('mouseleave', onLeave);
    surface.addEventListener('mouseenter', onEnter);
    return () => {
      surface.removeEventListener('mousemove', onMove);
      surface.removeEventListener('mouseleave', onLeave);
      surface.removeEventListener('mouseenter', onEnter);
      el.style.display = 'none';
    };
  }, [cursorMode, chartContainerRef]);

  // ── Demonstration cursor: toggle the chart library's always-on brush mode ──
  // When the user picks the "Demonstration" cursor in the tool rail we enable
  // the library's freehand brush so plain drag draws a fading red stroke (no
  // Alt required — Alt+drag still works globally in every mode).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || typeof chart.demoCursor !== 'function') return;
    try {
      chart.demoCursor().setActive(cursorMode === 'demo' && toolState.variant === 'none');
    } catch { /* noop */ }
    return () => {
      try { chart.demoCursor().setActive(false); } catch { /* noop */ }
    };
  }, [chartRef, cursorMode, toolState.variant]);

  // ── Global Alt tracker: TradingView parity ───────────────────────────────
  // Alt+drag anywhere on the chart activates the demo cursor brush regardless
  // of which tool is currently selected. Releasing Alt mid-stroke finalizes
  // the stroke and begins the fade-out.
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && !altHeldRef.current) {
        altHeldRef.current = true;
        setAltHeld(true);
      }
    };
    const onGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        altHeldRef.current = false;
        setAltHeld(false);
        // If we were driving a stroke via the overlay, finalize it now.
        // Library's native window keyup finalizes any in-flight stroke.
      }
    };
    const onBlur = () => {
      altHeldRef.current = false;
      setAltHeld(false);
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    window.addEventListener('keyup', onGlobalKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onGlobalKeyDown);
      window.removeEventListener('keyup', onGlobalKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [chartRef]);

  const overlayInteractive = toolState.variant !== 'none' || cursorMode === 'eraser' || selectedDrawingId !== null;
  const overlayCursor = toolState.variant !== 'none' ? undefined : cursorCssByMode[cursorMode];

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const startedAt = performance.now();
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      // Alt-driven demo stroke: library's canvas native pointerup handles
      // finalization. Just bail so selection/drag logic does not fire.
      if (event.altKey || altHeldRef.current) {
        return;
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

      if (drawingActiveRef.current && draftRef.current && isWizardVariant(draftRef.current.variant)) {
        syncPatternWizardHint();
        renderOverlay();
        return;
      }

      // TV-parity: for click-click line tools, the first pointerup must NOT
      // commit the drawing UNLESS the pointer moved enough to look like a
      // deliberate drag (TV also supports click-drag-release as an equivalent
      // shortcut). Threshold ≈ 8 px matches TV.
      if (clickClickPhaseRef.current === 1 && drawingActiveRef.current && draftRef.current && isClickClickVariant(draftRef.current.variant)) {
        const start = clickClickStartRef.current;
        const dragDistance = start ? Math.hypot(event.clientX - start.x, event.clientY - start.y) : 0;
        if (dragDistance < 8) {
          // Treat as a click: stay in phase 1 and wait for the second click.
          renderOverlay();
          return;
        }
        // Drag-commit path: finalize now.
        const committed = finalizeDraft();
        clickClickPhaseRef.current = 0;
        clickClickStartRef.current = null;
        draftPointerStartRef.current = null;
        if (committed) {
          setSelectedDrawingId(committed.id);
          setHoveredDrawingId(committed.id);
          exitDrawingModeIfNeeded(committed.variant);
        }
        renderOverlay();
        return;
      }

      const committed = finalizeDraft();
      const start = draftPointerStartRef.current;
      draftPointerStartRef.current = null;
      // Dispatch a synthetic mouseup/pointerup to the chart library's canvas so
      // any drag state it entered on pointerdown is cleared. Without this, the
      // chart pans with the cursor after we commit a drawing (see regression).
      if (committed) {
        const container = chartContainerRef.current;
        const target = container?.querySelector('canvas') as HTMLElement | null;
        if (target) {
          try {
            target.dispatchEvent(new MouseEvent('mouseup', {
              bubbles: true, cancelable: true,
              clientX: event.clientX, clientY: event.clientY,
              button: 0,
            }));
          } catch { /* no-op */ }
        }
      }
      if (committed && start && committed.variant === start.variant) {
        const pointerDistance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (pointerDistance < 3) {
          removeDrawing(committed.id);
          setSelectedDrawingId(null);
          if (hoveredDrawingId === committed.id) {
            setHoveredDrawingId(null);
          }
          renderOverlay();
          return;
        }
      }
      if (toolState.variant === 'zoom' && committed?.anchors[1]) {
        zoomToRange(committed.anchors[0].time, committed.anchors[1].time);
        removeDrawing(committed.id);
        exitDrawingModeIfNeeded(committed.variant);
      } else if (committed) {
        setPatternWizardHint(null);
        setSelectedDrawingId(committed.id);
        setHoveredDrawingId(committed.id);
        exitDrawingModeIfNeeded(committed.variant);
      }
      renderOverlay();
    } finally {
      recordInteractionLatency('pointerup', startedAt);
    }
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

  const handleClearAll = useCallback(() => {
    clearDrawings();
    setSelectedDrawingId(null);
    setHoveredDrawingId(null);
  }, [clearDrawings]);

  const handleDelete = useCallback(() => {
    if (selectedDrawingId) {
      removeDrawing(selectedDrawingId);
      setSelectedDrawingId(null);
      setHoveredDrawingId((prev) => (prev === selectedDrawingId ? null : prev));
    }
  }, [removeDrawing, selectedDrawingId]);

  const handleToolOptionsChange = useCallback((partial: Partial<Drawing['options']>) => {
    setOptions(partial);

    if (!selectedDrawingId) return;

    updateDrawing(
      selectedDrawingId,
      (drawing) => {
        const nextOptions = { ...drawing.options, ...partial };
        return {
          ...drawing,
          options: nextOptions,
          locked: partial.locked ?? drawing.locked,
          visible: partial.visible ?? drawing.visible,
        };
      },
      false,
    );
    renderOverlay();
  }, [renderOverlay, selectedDrawingId, setOptions, updateDrawing]);

  const handleToggleFullView = useCallback(() => {
    setFullView((prev) => !prev);
  }, []);

  /* ── Floating drawing toolbar (TV-parity) ──────────────────────────── */
  const [toolbarAnchor, setToolbarAnchor] = useState<FloatingToolbarAnchor>(null);
  useEffect(() => { toolbarAnchorRef.current = toolbarAnchor; }, [toolbarAnchor]);
  // Bump `toolbarTick` whenever something that affects the projected bbox
  // changes (pan/zoom/resize/drawing move) so the memoized anchor recomputes.
  const [toolbarTick, setToolbarTick] = useState(0);

  useEffect(() => {
    if (!selectedDrawing) {
      setToolbarAnchor(null);
      return;
    }
    const chart = chartRef.current;
    const series = getActiveSeries();
    const overlay = overlayRef.current;
    if (!chart || !series || !overlay) {
      setToolbarAnchor(null);
      return;
    }
    const rect = overlay.getBoundingClientRect();
    const xs: number[] = [];
    const ys: number[] = [];
    for (const a of selectedDrawing.anchors) {
      const x = chart.timeScale().timeToCoordinate(a.time as DrawPoint['time']);
      const y = series.priceToCoordinate(a.price);
      if (x == null || y == null) continue;
      xs.push(rect.left + x);
      ys.push(rect.top + y);
    }
    if (!xs.length || !ys.length) {
      // HLine / VLine / HRay / CrossLine: synthesize from viewport
      if (selectedDrawing.anchors[0]) {
        const a = selectedDrawing.anchors[0];
        const y = series.priceToCoordinate(a.price);
        const x = chart.timeScale().timeToCoordinate(a.time as DrawPoint['time']);
        if (y != null) {
          ys.push(rect.top + y);
          xs.push(rect.left + rect.width / 2);
        } else if (x != null) {
          xs.push(rect.left + x);
          ys.push(rect.top + rect.height / 2);
        }
      }
    }
    if (!xs.length || !ys.length) {
      setToolbarAnchor(null);
      return;
    }
    setToolbarAnchor({
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
    });
  }, [selectedDrawing, chartRef, getActiveSeries, overlayRef, toolbarTick, toolState.drawings]);

  // Keep toolbar anchor up-to-date on pan / zoom / resize.
  useEffect(() => {
    if (!selectedDrawingId) return;
    const raf = { id: 0 as number };
    const bump = () => {
      if (raf.id) return;
      raf.id = window.requestAnimationFrame(() => {
        raf.id = 0;
        setToolbarTick((n) => (n + 1) % 1_000_000);
      });
    };
    const chart = chartRef.current;
    const unsubs: Array<() => void> = [];
    try {
      chart?.timeScale().subscribeVisibleLogicalRangeChange?.(bump);
      unsubs.push(() => chart?.timeScale().unsubscribeVisibleLogicalRangeChange?.(bump));
    } catch {
      /* ignore */
    }
    window.addEventListener('resize', bump);
    unsubs.push(() => window.removeEventListener('resize', bump));
    return () => {
      unsubs.forEach((u) => u());
      if (raf.id) window.cancelAnimationFrame(raf.id);
    };
  }, [chartRef, selectedDrawingId]);

  const handleToolbarColor = useCallback((color: string) => {
    if (!selectedDrawingId) return;
    updateDrawing(selectedDrawingId, (d) => ({ ...d, options: { ...d.options, color } }));
    renderOverlay();
  }, [renderOverlay, selectedDrawingId, updateDrawing]);

  const handleToolbarThickness = useCallback((thickness: number) => {
    if (!selectedDrawingId) return;
    updateDrawing(selectedDrawingId, (d) => ({ ...d, options: { ...d.options, thickness } }));
    renderOverlay();
  }, [renderOverlay, selectedDrawingId, updateDrawing]);

  const handleToolbarStyle = useCallback((style: 'solid' | 'dashed' | 'dotted') => {
    if (!selectedDrawingId) return;
    updateDrawing(selectedDrawingId, (d) => ({ ...d, options: { ...d.options, style } }));
    renderOverlay();
  }, [renderOverlay, selectedDrawingId, updateDrawing]);

  const handleToolbarToggleLock = useCallback(() => {
    if (!selectedDrawingId) return;
    updateDrawing(selectedDrawingId, (d) => {
      const next = !(d.locked || d.options.locked);
      return { ...d, locked: next, options: { ...d.options, locked: next } };
    });
  }, [selectedDrawingId, updateDrawing]);

  const handleToolbarToggleVisible = useCallback(() => {
    if (!selectedDrawingId) return;
    updateDrawing(selectedDrawingId, (d) => {
      const next = !(d.visible !== false && d.options.visible !== false);
      return { ...d, visible: next, options: { ...d.options, visible: next } };
    });
    renderOverlay();
  }, [renderOverlay, selectedDrawingId, updateDrawing]);

  const handleToolbarDelete = useCallback(() => {
    if (!selectedDrawingId) return;
    removeDrawing(selectedDrawingId);
    setSelectedDrawingId(null);
    setHoveredDrawingId(null);
  }, [removeDrawing, selectedDrawingId]);

  const handleToolbarDuplicate = useCallback(() => {
    if (!selectedDrawingId) return;
    const src = drawingsRef.current.find((d) => d.id === selectedDrawingId);
    if (!src) return;
    // Offset each anchor by ~12 bars in time and ~0.5% in price so the copy is visible.
    const offsetSec = 12 * 60;
    const priceDelta = Math.max(0.01, Math.abs(src.anchors[0]?.price ?? 1) * 0.005);
    const newAnchors = src.anchors.map((a) => ({
      time: ((a.time as unknown as number) + offsetSec) as DrawPoint['time'],
      price: a.price + priceDelta,
    }));
    const clone: Drawing = {
      ...src,
      id: `dwg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      anchors: newAnchors,
      options: { ...src.options },
      selected: false,
      text: src.text,
    };
    updateAllDrawings((prev) => [...prev, clone]);
    setSelectedDrawingId(clone.id);
  }, [drawingsRef, selectedDrawingId, updateAllDrawings]);

  const handleToolbarAddText = useCallback(() => {
    if (!selectedDrawingId) return;
    const src = drawingsRef.current.find((d) => d.id === selectedDrawingId);
    if (!src) return;
    const a0 = src.anchors[0];
    const a1 = src.anchors[src.anchors.length - 1] ?? a0;
    if (!a0) return;
    const def = getToolDefinition(src.variant);
    // If the drawing itself supports text (infoLine, trendAngle, fib*, etc.), edit it directly.
    if (def?.capabilities.supportsText) {
      pendingTextPointRef.current = a0;
      pendingTextVariantRef.current = src.variant as Exclude<ToolVariant, 'none'>;
      editingDrawingIdRef.current = src.id;
      setPromptRequest({
        title: `Edit ${def.label}`,
        label: 'Text',
        defaultValue: src.text ?? '',
        preview: true,
        allowStyleControls: true,
        styleOptions: {
          font: src.options.font,
          textSize: src.options.textSize,
          bold: src.options.bold,
          italic: src.options.italic,
          align: src.options.align,
          textBackground: src.options.textBackground,
          textBorder: src.options.textBorder,
        },
      });
      return;
    }
    // Otherwise create a separate anchoredText drawing at the line midpoint.
    const mid: DrawPoint = {
      time: (((a0.time as unknown as number) + (a1.time as unknown as number)) / 2) as DrawPoint['time'],
      price: (a0.price + a1.price) / 2,
    };
    pendingTextPointRef.current = mid;
    pendingTextVariantRef.current = 'anchoredText';
    editingDrawingIdRef.current = null;
    forceTextCreateRef.current = true;
    setPromptRequest({
      title: 'Add text',
      label: 'Enter text',
      defaultValue: 'Text',
      preview: true,
      allowStyleControls: true,
      styleOptions: {
        font: toolState.options.font,
        textSize: toolState.options.textSize,
        bold: toolState.options.bold,
        italic: toolState.options.italic,
        align: toolState.options.align,
        textBackground: toolState.options.textBackground,
        textBorder: toolState.options.textBorder,
      },
    });
  }, [drawingsRef, selectedDrawingId, toolState.options]);

  const handleToolbarOpenSettings = useCallback(() => {
    setOptionsOpen(true);
  }, []);

  const floatingPortalZIndex = fullView ? 165 : 60;
  const dialogPortalZIndex = fullView ? 170 : 50;
  const topBarModalZIndex = fullView ? 172 : 90;

  const chartBody = (
    <div
      data-testid="chart-root"
      data-full-view={fullView ? 'true' : 'false'}
      className={`relative flex h-full w-full flex-col ${fullView ? 'max-h-none min-h-0' : 'max-h-[calc(100vh-100px)] min-h-[340px]'}`}
    >
      <div className="flex min-h-0 h-full w-full flex-col">
      {/* Top bar + rail + chart in a flex layout */}
      <ChartTopBar chartType={chartType} setChartType={setChartType} magnetMode={magnetMode} setMagnetMode={setMagnetMode} crosshairSnapMode={crosshairSnapMode} setCrosshairSnapMode={setCrosshairSnapMode} onUndo={undo} onRedo={redo} onClear={handleClearAll} onExportPng={onExportPng} optionsOpen={optionsOpen} setOptionsOpen={setOptionsOpen} indicatorsOpen={indicatorsOpen} setIndicatorsOpen={setIndicatorsOpen} activeIndicatorsCount={enabledIndicators.length} treeOpen={treeOpen} setTreeOpen={setTreeOpen} selectedDrawingVariant={selectedDrawing?.variant ?? null} isMobile={isMobile} isFullView={fullView} onToggleFullView={handleToggleFullView} modalZIndex={topBarModalZIndex} />

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
          portalZIndex={floatingPortalZIndex}
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
            onMouseMove={(event) => {
              if (drawingActiveRef.current || dragMoveRef.current || dragAnchorMoveRef.current || dragAnchor) return;
              updateHoverPoint(event.clientX, event.clientY);
            }}
            onMouseLeave={() => {
              setHoverPoint(null);
              setHoveredDrawingId(null);
            }}
            onClick={() => { if (plusMenuOpen) setPlusMenuOpen(false); }}
          >
            {/* `touch-none` (touch-action: none) is required so two-finger
                pinch-zoom and horizontal touch-drag reach lightweight-charts.
                With `touch-pan-y`, the browser intercepts/cancels multi-finger
                gestures per W3C spec, breaking pinch-zoom on tablet/mobile. */}
            <div className="chart-wrapper h-full w-full touch-none">
              <ChartCanvas chartContainerRef={chartContainerRef} overlayRef={overlayRef} activeVariant={toolState.variant} overlayInteractive={overlayInteractive} overlayCursor={overlayCursor} containerCursor={overlayCursor} />
            </div>

            {/* External OHLC legend — rendered at top-left INSIDE the chart canvas, never over ToolRail */}
            {ohlcLegend ? (
              <div className="pointer-events-none absolute left-2 top-2 z-30">
                {ohlcLegend}
              </div>
            ) : null}

            {/* Last price Y-axis badge */}
            {lastPriceBadge != null ? (
              <div
                className="pointer-events-none absolute right-0 z-30 flex items-center"
                style={{ top: lastPriceBadge.y - 10 }}
              >
                <div
                  className="rounded-l px-2 py-0.5 text-[13px] font-bold text-white tabular-nums"
                  style={{ backgroundColor: lastPriceBadge.isUp ? '#26a69a' : '#ef5350' }}
                >
                  {lastPriceBadge.price.toFixed(2)}
                </div>
              </div>
            ) : null}

            {/* ── Crosshair DOM overlays — always in DOM, updated via refs (no flicker) ── */}

            {/* Hovered-candle second Y-axis badge */}
            <div
              ref={hoveredCloseBadgeRef}
              className="pointer-events-none absolute right-0 z-[29] flex items-center"
              style={{ display: 'none', top: 0 }}
            >
              <div
                className="rounded-l px-2 py-0.5 text-[13px] font-bold text-white tabular-nums opacity-90"
              >
                <span ref={hoveredClosePriceTextRef} />
              </div>
            </div>

            {/* Y-axis crosshair price label + "+" button */}
            <div
              ref={crosshairYLabelRef}
              className="absolute right-0 z-[31] flex items-center"
              style={{ display: 'none', top: 0, pointerEvents: 'auto' }}
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
              onDoubleClick={(e) => {
                // Double-click on Y-axis label resets price scale to auto (TV parity)
                const chart = chartRef.current as (IChartApi & { resetPriceScale?: (y: number) => void }) | null;
                if (chart?.resetPriceScale) {
                  // Use canvas-relative Y so getPaneAtY works correctly
                  const canvasEl = chartContainerRef.current?.querySelector('canvas');
                  const canvasRect = canvasEl?.getBoundingClientRect();
                  const cy = canvasRect ? e.clientY - canvasRect.top : e.clientY;
                  chart.resetPriceScale(cy);
                }
              }}
            >
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-l bg-[#1e222d] text-[14px] font-bold text-white hover:bg-[#2a2e39] leading-none border-r border-white/10"
                title="Add alert / order / drawing"
                onMouseEnter={cancelHide}
                onClick={(e) => {
                  e.stopPropagation();
                  // Primary: use tracked crosshair price; fallback: parse the displayed label text
                  // (handles race where cursor briefly left canvas before clicking "+" button)
                  const rawPrice = crosshairPriceRef.current
                    ?? parseFloat(crosshairYPriceTextRef.current?.textContent ?? '');
                  const price = Number.isFinite(rawPrice) ? rawPrice : null;
                  if (price == null) return;
                  const yEl = crosshairYLabelRef.current;
                  const topPx = yEl ? parseInt(yEl.style.top || '0', 10) : 0;
                  if (plusMenuOpen && plusMenuPrice === price) {
                    setPlusMenuOpen(false);
                  } else {
                    setPlusMenuPrice(price);
                    setPlusMenuTime(crosshairTimeRef.current);
                    setPlusMenuY(topPx);
                    setPlusMenuOpen(true);
                  }
                }}
              >
                +
              </button>
              <div className="rounded-r bg-[#131722] px-2.5 py-0.5 text-[13px] font-bold text-white tabular-nums whitespace-nowrap">
                <span ref={crosshairYPriceTextRef} />
              </div>
            </div>

            {/* "+" context menu panel (state-driven, only shown on click) */}
            {plusMenuOpen && plusMenuPrice != null ? (
              <div
                className="absolute z-50 w-[296px] overflow-hidden rounded-xl border border-white/10 bg-[#1e222d] py-1.5 shadow-2xl"
                style={{
                  top: Math.max(4, plusMenuY - 20),
                  right: 84,
                  pointerEvents: 'auto',
                }}
                // Keep the Y-label visible while hovering the menu; hide after leaving
                onMouseEnter={cancelHide}
                onMouseLeave={scheduleHide}
              >
                {/* Add alert */}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white hover:bg-white/5 transition"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    onAddAlert?.(plusMenuPrice);
                  }}
                >
                  <span className="flex-1 leading-snug">Add alert on {symbol} at {plusMenuPrice.toFixed(2)}</span>
                  <span className="shrink-0 text-[10px] text-white/40">Alt+A</span>
                </button>

                {/* Buy */}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white hover:bg-white/5 transition"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    toast.info(`Buy order at ${plusMenuPrice.toFixed(2)} — trading coming soon`);
                  }}
                >
                  <span className="flex-1 leading-snug">Buy 1 {symbol} @ {plusMenuPrice.toFixed(2)} limit</span>
                  <span className="shrink-0 text-[10px] text-white/40">Alt+Shift+B</span>
                </button>

                {/* Sell */}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white hover:bg-white/5 transition"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    toast.info(`Sell order at ${plusMenuPrice.toFixed(2)} — trading coming soon`);
                  }}
                >
                  <span className="flex-1 leading-snug">Sell 1 {symbol} @ {plusMenuPrice.toFixed(2)} stop</span>
                </button>

                {/* Add order */}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white hover:bg-white/5 transition"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    toast.info(`Order at ${plusMenuPrice.toFixed(2)} — trading coming soon`);
                  }}
                >
                  <span className="flex-1 leading-snug">Add order on {symbol} at {plusMenuPrice.toFixed(2)}…</span>
                  <span className="shrink-0 text-[10px] text-white/40">Shift+T</span>
                </button>

                <div className="my-1 border-t border-white/10" />

                {/* Draw horizontal line — placed immediately at exact price */}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-white hover:bg-white/5 transition"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    const price = plusMenuPrice;
                    if (price == null) return;
                    const times = transformedData.times;
                    if (!times.length) return;
                    const anchorTime = plusMenuTime ?? Number(times[times.length - 1]);
                    const pt: DrawPoint = { time: anchorTime as DrawPoint['time'], price };
                    const hlineOpts = buildToolOptions('hline');
                    const drawing = createDrawing('hline', hlineOpts, pt, pt);
                    updateAllDrawings((prev) => [...prev, drawing]);
                    setSelectedDrawingId(drawing.id);
                    renderOverlay();
                  }}
                >
                  <span className="flex-1 leading-snug">Draw horizontal line at {plusMenuPrice.toFixed(2)}</span>
                  <span className="shrink-0 text-[10px] text-white/40">Alt+H</span>
                </button>
              </div>
            ) : null}

            {/* X-axis crosshair time label */}
            <div
              ref={crosshairXLabelRef}
              className="pointer-events-none absolute bottom-0 z-[31] -translate-x-1/2 rounded-t bg-[#131722] px-2.5 py-1 text-[12px] font-semibold text-white tabular-nums whitespace-nowrap"
              style={{ display: 'none', left: 0 }}
            />

            {/* ── Countdown timer: time until next candle on X-axis ── */}
            <div
              ref={countdownDivRef}
              data-testid="candle-countdown"
              className="pointer-events-none absolute bottom-0 z-[30] -translate-x-1/2 rounded-t px-2 py-0.5 text-[11px] font-bold tabular-nums whitespace-nowrap"
              style={{ display: 'none', left: 0, backgroundColor: '#2962ff', color: '#ffffff' }}
            />

            {/* ── Demo mode: reddish cursor circle (follows mouse via ref) ── */}
            <div
              ref={demoCursorDivRef}
              data-testid="demo-cursor-circle"
              className="pointer-events-none absolute z-[60]"
              style={{
                display: 'none',
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'rgba(211, 47, 47, 0.18)',
                border: '1.5px solid rgba(211, 47, 47, 0.85)',
                boxShadow: '0 0 6px 1px rgba(211,47,47,0.18)',
                transform: 'translate(-50%, -50%)',
              }}
            />

            {/* ── Demo mode: "Hold Alt for temporary drawing" hint ── */}
            {cursorMode === 'demo' && showDemoHint && !demoAltActive ? (
              <div
                data-testid="demo-hint"
                className="pointer-events-auto absolute bottom-9 left-1/2 z-[55] flex -translate-x-1/2 items-center gap-2 rounded border border-white/10 bg-[#1e222d] px-3 py-1.5 text-[12px] text-white shadow-lg"
              >
                <span>Hold <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px] font-mono">Alt</kbd> for temporary drawing</span>
                <button
                  type="button"
                  className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white/50 hover:text-white"
                  title="Dismiss"
                  onClick={() => setShowDemoHint(false)}
                >
                  ×
                </button>
              </div>
            ) : null}

            {patternWizardHint ? (
              <div
                data-testid="pattern-wizard-hint"
                className="pointer-events-none absolute left-3 top-3 z-40 rounded-lg border border-primary/35 bg-slate-950/88 px-2.5 py-1.5 text-[11px] font-semibold text-primary shadow-lg shadow-black/50"
              >
                {patternWizardHint.toolLabel}: place {patternWizardHint.pointLabel} ({patternWizardHint.step}/{patternWizardHint.total})
              </div>
            ) : null}

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

            <ToolOptionsPanel open={optionsOpen} options={toolState.options} optionsSchema={activeDefinition?.optionsSchema || []} onChange={handleToolOptionsChange} />

            <FloatingDrawingToolbar
              drawing={selectedDrawing}
              anchor={toolbarAnchor}
              zIndex={floatingPortalZIndex + 5}
              onChangeColor={handleToolbarColor}
              onChangeThickness={handleToolbarThickness}
              onChangeStyle={handleToolbarStyle}
              onToggleLock={handleToolbarToggleLock}
              onToggleVisible={handleToolbarToggleVisible}
              onAddText={handleToolbarAddText}
              onDuplicate={handleToolbarDuplicate}
              onDelete={handleToolbarDelete}
              onOpenSettings={handleToolbarOpenSettings}
            />

            <IndicatorsModal open={indicatorsOpen} onOpenChange={setIndicatorsOpen} enabledIndicators={enabledIndicators} onAddIndicator={addIndicator} onRemoveIndicator={removeEnabledIndicator} builtinIds={builtinIds} portalZIndex={dialogPortalZIndex} />

            <ChartPromptModal
              request={promptRequest}
              portalZIndex={dialogPortalZIndex}
              onConfirm={({ value, style }) => {
                const pt = pendingTextPointRef.current;
                const pendingVariant = pendingTextVariantRef.current;
                const editingId = editingDrawingIdRef.current;
                const forceCreate = forceTextCreateRef.current;
                pendingTextPointRef.current = null;
                pendingTextVariantRef.current = null;
                editingDrawingIdRef.current = null;
                forceTextCreateRef.current = false;
                setPromptRequest(null);

                setOptions(style);

                if (editingId) {
                  updateDrawing(editingId, (drawing) => ({
                    ...drawing,
                    text: value,
                    options: {
                      ...drawing.options,
                      ...style,
                    },
                  }));
                  renderOverlay();
                  return;
                }

                // Force-create path: floating toolbar "Add text" from cursor mode.
                if (forceCreate && pt && pendingVariant) {
                  const result = startDraftForVariant(pendingVariant, pt, value);
                  if (result.kind === 'finalized') {
                    const d = drawingsRef.current[drawingsRef.current.length - 1];
                    if (d) {
                      updateDrawing(
                        d.id,
                        (drawing) => ({
                          ...drawing,
                          text: value,
                          options: {
                            ...drawing.options,
                            ...style,
                          },
                        }),
                        false,
                      );
                      setSelectedDrawingId(d.id);
                    }
                  }
                  renderOverlay();
                  return;
                }

                if (pt && pendingVariant && toolState.variant === pendingVariant) {
                  const result = startDraft(pt, value);
                  if (result.kind === 'finalized') {
                    const d = drawingsRef.current[drawingsRef.current.length - 1];
                    if (d) {
                      updateDrawing(
                        d.id,
                        (drawing) => ({
                          ...drawing,
                          text: value,
                          options: {
                            ...drawing.options,
                            ...style,
                          },
                        }),
                        false,
                      );
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
        {symbol} · {mode} · {chartType} · bars {transformedData.ohlcRows.length}/{data.length} (visible {visibleCount}) · {toolState.drawings.length} drawing{toolState.drawings.length === 1 ? '' : 's'} · tool: {toolState.variant} · magnet: {magnetMode ? 'on' : 'off'}
      </div>
      </div>
    </div>
  );

  if (fullView && typeof document !== 'undefined') {
    return createPortal(
      <div data-testid="chart-full-view-overlay" className="fixed inset-0 z-[120] bg-black/75 p-2 sm:p-3">
        <div className="h-full w-full overflow-hidden rounded-xl border border-primary/25 bg-background shadow-2xl shadow-black/60">
          {chartBody}
        </div>
      </div>,
      document.body,
    );
  }

  return chartBody;
}

