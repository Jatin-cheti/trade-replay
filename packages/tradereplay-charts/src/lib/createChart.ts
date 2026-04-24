// ─── Public types ────────────────────────────────────────────────────────────

import { TimeIndex } from './data/timeIndex';
import { SeriesStore, type TimedRow } from './data/seriesStore';
import { type PaneId, type PaneDef, PANE_DIVIDER_H, computePaneLayout, resizePaneHeights } from './layout/panes';
import { priceToY, yToPrice, sepPriceToY, sepYToPrice, padPriceRange } from './scales/priceScale';
import { getIndicator } from '../indicators/registry';
import { registerBuiltins } from '../indicators/builtins/index';
import type { IndicatorDefinition, IndicatorInstanceId } from '../indicators/types';
import type {
  IndicatorComputeWindow,
  IndicatorWorkerRequest,
  IndicatorWorkerResponse,
} from '../indicators/engine/indicatorWorkerProtocol';
import { getGlobalPerfTelemetry, enableGlobalPerfTelemetry } from './perfTelemetry';

// Auto-register built-in indicators so they are available from the first createChart call.
registerBuiltins();

export type UTCTimestamp = number;

export type InteractionMode = 'idle' | 'pan' | 'axis-zoom' | 'scroll' | 'pinch';

export interface CandlestickData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LineData {
  time: UTCTimestamp;
  value: number;
}

export interface HistogramData {
  time: UTCTimestamp;
  value: number;
  color?: string;
}

export type SeriesType = 'Candlestick' | 'Line' | 'Area' | 'Baseline' | 'Histogram' | 'Bar';

type RowOf<T extends SeriesType> = T extends 'Candlestick' | 'Bar'
  ? CandlestickData
  : T extends 'Histogram'
  ? HistogramData
  : LineData;

export interface SeriesOptions {
  visible?: boolean;
  color?: string;
  lineWidth?: number;
  lineColor?: string;
  topColor?: string;
  bottomColor?: string;
  upColor?: string;
  downColor?: string;
  borderUpColor?: string;
  borderDownColor?: string;
  wickUpColor?: string;
  wickDownColor?: string;
  topLineColor?: string;
  bottomLineColor?: string;
  topFillColor1?: string;
  topFillColor2?: string;
  bottomFillColor1?: string;
  bottomFillColor2?: string;
  baseValue?: { type: string; price: number };
  priceFormat?: { type: string; precision?: number; minMove?: number };
  base?: number;
  thinBars?: boolean;
  priceScaleId?: string;
  /** Price scale mode for this series' pane (Normal, Logarithmic, Percentage, IndexedTo100). */
  priceScaleMode?: PriceScaleMode;
  /**
   * Internal escape hatch for derived helper series whose synthetic timestamps
   * should not affect the chart's canonical time index.
   */
  excludeFromTimeIndex?: boolean;
}

export interface ScaleMargins {
  top: number;
  bottom: number;
}

export interface IPriceScaleApi {
  applyOptions(opts: { scaleMargins?: ScaleMargins }): void;
}

export interface ISeriesApi<_T extends SeriesType> {
  setData(data: RowOf<_T>[]): void;
  update(row: RowOf<_T>): void;
  applyOptions(options: Partial<SeriesOptions>): void;
  priceScale(): IPriceScaleApi;
  coordinateToPrice(y: number): number | null;
  priceToCoordinate(price: number): number | null;
  /** Return all data currently loaded into this series. */
  getData(): RowOf<_T>[];
  /** Create a horizontal reference line at a price level. */
  createPriceLine(options: PriceLineOptions): IPriceLine;
  /** Set (or replace) bar markers. Pass [] to clear all markers. */
  setMarkers(markers: SeriesMarker[]): void;
  /** Attach a primitive renderer to this series. */
  attachPrimitive(primitive: ISeriesPrimitive): void;
  /** Detach a previously-attached primitive. */
  detachPrimitive(primitive: ISeriesPrimitive): void;
}

export interface LogicalRange {
  from: number;
  to: number;
}

export interface TimeRange {
  from: UTCTimestamp;
  to: UTCTimestamp;
}

export interface ITimeScaleApi {
  scrollPosition(): number;
  getVisibleLogicalRange(): LogicalRange | null;
  setVisibleLogicalRange(range: LogicalRange): void;
  applyOptions(opts: { rightOffset?: number; [key: string]: unknown }): void;
  scrollToPosition(pos: number, animate: boolean): void;
  scrollToRealTime(): void;
  coordinateToTime(x: number): UTCTimestamp | null;
  timeToCoordinate(time: UTCTimestamp): number | null;
  setVisibleRange(range: TimeRange): void;
  subscribeVisibleTimeRangeChange(handler: () => void): void;
  unsubscribeVisibleTimeRangeChange(handler: () => void): void;
  /** Fit all loaded data into the visible viewport. */
  fitContent(): void;
}

export interface ChartOptions {
  width?: number;
  height?: number;
  autoSize?: boolean;
  /** Custom price formatter. Overrides the default two-decimal formatter. */
  priceFormatter?: (price: number) => string;
  /** Custom time formatter. Overrides the default time/date formatter. */
  timeFormatter?: (time: UTCTimestamp) => string;
  layout?: {
    background?: { type?: string; color?: string };
    textColor?: string;
    fontFamily?: string;
    fontSize?: number;
  };
  grid?: {
    vertLines?: { color?: string };
    horzLines?: { color?: string };
  };
  crosshair?: {
    mode?: number;
    vertLine?: { color?: string; width?: number; style?: number; labelBackgroundColor?: string };
    horzLine?: { color?: string; width?: number; style?: number; labelBackgroundColor?: string };
  };
  rightPriceScale?: { borderColor?: string };
  timeScale?: {
    borderColor?: string;
    timeVisible?: boolean;
    secondsVisible?: boolean;
    rightBarStaysOnScroll?: boolean;
    shiftVisibleRangeOnNewBar?: boolean;
    rightOffset?: number;
  };
  handleScale?: {
    axisPressedMouseMove?: { time?: boolean; price?: boolean };
    mouseWheel?: boolean;
    pinch?: boolean;
  };
  handleScroll?: {
    mouseWheel?: boolean;
    pressedMouseMove?: boolean;
    vertTouchDrag?: boolean;
    horzTouchDrag?: boolean;
  };
  indicatorEngine?: {
    mode?: 'auto' | 'main-thread' | 'worker';
    visibleRangeOnly?: boolean;
    windowPaddingBars?: number;
  };
  parity?: {
    enabled?: boolean;
    viewMode?: 'normal' | 'full';
    showLastPriceLine?: boolean;
    showLastValueLabels?: boolean;
    showWatermark?: boolean;
    /** Vertical range padding used for price series during parity capture. */
    pricePadding?: number;
    /** Vertical range padding used for histogram/volume series during parity capture. */
    volumePadding?: number;
  };
  /**
   * Enable opt-in perf instrumentation.  Logs a throttled summary
   * (avg / p95 per metric) to the console every 5 s.
   * Can also be enabled at runtime: `window.__TRADEREPLAY_PERF_DEBUG__ = true`.
   */
  perfDebug?: boolean;
  /**
   * When provided, the time axis uses these exact UTC-second timestamps as
   * tick targets instead of the automatic bar-modulo heuristic. The chart
   * finds the nearest data bar to each target and labels it.
   * Useful for 1D NSE sessions: pass the 30-min IST boundary timestamps
   * (stored as fake-UTC seconds, i.e. IST time treated as UTC) so labels
   * always land on 09:30, 10:00, 10:30 … 15:30 regardless of bar count.
   */
  forcedTimeTicks?: number[];
}

export interface IChartApi {
  applyOptions(opts: Partial<ChartOptions>): void;
  addSeries<T extends SeriesType>(type: T, options?: Partial<SeriesOptions>, paneId?: string): ISeriesApi<T>;
  timeScale(): ITimeScaleApi;
  /** Current chart size + axis gutter sizes (CSS pixels). */
  getDimensions(): { width: number; height: number; priceAxisWidth: number; timeAxisHeight: number };
  subscribeCrosshairMove(handler: (param: unknown) => void): void;
  unsubscribeCrosshairMove(handler: (param: unknown) => void): void;
  subscribeClick(handler: (param: CrosshairMoveEvent) => void): void;
  unsubscribeClick(handler: (param: CrosshairMoveEvent) => void): void;
  subscribeDblClick(handler: (param: CrosshairMoveEvent) => void): void;
  unsubscribeDblClick(handler: (param: CrosshairMoveEvent) => void): void;
  setInteractionMode(mode: InteractionMode): void;
  remove(): void;
  /** Return IPaneApi objects for all current panes (main pane first). */
  panes(): IPaneApi[];
  /** Add a new subpane below the main pane and return its id. */
  addPane(opts?: { height?: number; id?: string }): string;
  /** Remove a subpane (no-op for the main pane). Series are moved to main. */
  removePane(id: string): void;
  /** Update relative height weights for panes. Keys are pane ids. */
  setPaneHeights(heights: Record<string, number>): void;
  /**
   * Attach a built-in or custom indicator to the chart.
   *
   * The indicator's output series are created automatically and assigned to
   * the main price pane (overlay outputs) or a new subpane (subpane outputs).
   *
   * @param indicatorId  Registry id (e.g. 'sma', 'ema', 'rsi', 'macd').
   * @param params       Parameter overrides (e.g. { period: 14 }).
   * @returns            An opaque instance id for use with `removeIndicator`.
   */
  addIndicator(indicatorId: string, params?: Record<string, number>): string;
  /** Remove a previously added indicator instance and its output series/pane. */
  removeIndicator(instanceId: string): void;
  /**
   * Zoom the price scale for the pane at the given canvas Y coordinate.
   * Positive deltaY = zoom out (expand visible price range).
   * Negative deltaY = zoom in (shrink visible price range).
   * Anchors at the price under the cursor so that price stays in place.
   */
  zoomPriceScale(deltaY: number, anchorY: number): void;
  /**
   * Demo cursor API — programmatic access to the Alt+drag freehand brush.
   * Mirrors TradingView's "Hold Alt for temporary drawing" feature.
   */
  demoCursor(): IDemoCursorApi;
  /** Reset the price scale for the pane at the given canvas Y to auto-fit. */
  resetPriceScale(anchorY: number): void;
}

/** API for programmatic control of the demo-cursor (freehand brush) feature. */
export interface IDemoCursorApi {
  /** Remove all current strokes immediately. */
  clearStrokes(): void;
  /** Set the stroke colour (CSS colour string). Default: rgba(255,80,80,1). */
  setColor(color: string): void;
  /** Set the stroke line width in CSS pixels. Default: 3. */
  setLineWidth(width: number): void;
  /** Set the fade duration in milliseconds. Default: 3000. */
  setFadeDuration(ms: number): void;
  /** Returns the number of live (not fully faded) strokes. */
  strokeCount(): number;
  /**
   * Enable "always-on" brush mode. When true, plain pointerdown+drag in the
   * chart area draws a brush stroke without requiring Alt. Used by toolbars
   * that expose a dedicated "Demonstration" cursor tool. Default: false.
   */
  setActive(active: boolean): void;
  /** Returns whether always-on brush mode is enabled. */
  isActive(): boolean;
}

export interface CrosshairMoveEvent {
  point: { x: number; y: number } | null;
  time: UTCTimestamp | null;
  price: number | null;
  paneId: string | null;
  source: 'local-pointer' | 'leave';
}

// ─── Plugin / Primitive system ────────────────────────────────────────────────

export type PriceScaleMode = 'Normal' | 'Logarithmic' | 'Percentage' | 'IndexedTo100';

export type SeriesMarkerPosition = 'aboveBar' | 'belowBar' | 'inBar';
export type SeriesMarkerShape = 'circle' | 'square' | 'arrowUp' | 'arrowDown';

export interface SeriesMarker {
  time: UTCTimestamp;
  position: SeriesMarkerPosition;
  shape: SeriesMarkerShape;
  color?: string;
  size?: number;
  text?: string;
  id?: string;
}

export interface PriceLineOptions {
  price: number;
  color?: string;
  lineWidth?: number;
  lineStyle?: 'Solid' | 'Dashed' | 'Dotted';
  axisLabelVisible?: boolean;
  title?: string;
  id?: string;
}

export interface IPriceLine {
  applyOptions(opts: Partial<PriceLineOptions>): void;
  options(): PriceLineOptions;
  remove(): void;
}

/**
 * Geometry context passed to primitive renderers during draw.
 * Mirrors LWC's renderer APIs so third-party primitives are familiar.
 */
export interface IPrimitiveGeometry {
  ctx: CanvasRenderingContext2D;
  barToX(barIndex: number): number;
  priceToY(price: number): number;
  yToPrice(y: number): number;
  xToBar(x: number): number;
  firstBar: number;
  lastBar: number;
  paneTop: number;
  paneHeight: number;
  chartWidth: number;
  chartHeight: number;
  timeAt(index: number): UTCTimestamp | null;
}

export type PrimitivePaneViewZOrder = 'background' | 'normal' | 'top';

export interface IPrimitivePaneRenderer {
  draw(target: CanvasRenderingContext2D, geometry: IPrimitiveGeometry): void;
  drawBackground?(target: CanvasRenderingContext2D, geometry: IPrimitiveGeometry): void;
}

export interface IPrimitivePaneView {
  zOrder?: PrimitivePaneViewZOrder;
  renderer(): IPrimitivePaneRenderer;
}

export interface IPrimitiveAxisView {
  coordinate(): number;
  text(): string;
  textColor?(): string;
  backgroundColor?(): string;
  visible?(): boolean;
}

export interface ISeriesPrimitiveBase {
  attached?(params: { chart: IChartApi; requestUpdate: () => void }): void;
  detached?(): void;
  updateAllViews?(): void;
  paneViews?(): IPrimitivePaneView[];
  priceAxisViews?(): IPrimitiveAxisView[];
  timeAxisViews?(): IPrimitiveAxisView[];
  autoscaleInfo?(
    startTimePoint: UTCTimestamp,
    endTimePoint: UTCTimestamp,
  ): { priceRange: { minValue: number; maxValue: number } } | null;
}

export type ISeriesPrimitive = ISeriesPrimitiveBase;
export type IPanePrimitive = ISeriesPrimitiveBase;

export interface IPaneApi {
  id(): string;
  getSize(): { width: number; height: number };
  attachPrimitive(primitive: IPanePrimitive): void;
  detachPrimitive(primitive: IPanePrimitive): void;
  moveTo(targetIndex: number): void;
}

// ─── Internal constants ───────────────────────────────────────────────────────
const PRICE_AXIS_W = 68;
const TIME_AXIS_H = 28;
const DEFAULT_BAR_WIDTH = 8;
const MIN_BAR_WIDTH = 2;
const MAX_BAR_WIDTH = Number.POSITIVE_INFINITY;
const PRICE_PADDING = 0.1;
const PARITY_COMPACT_PRICE_AXIS_WIDTH = 56;
const PARITY_COMPACT_PRICE_AXIS_MAX_VIEWPORT_WIDTH = 500;
const CANDLE_BODY_WIDTH_FACTOR = 0.72;
const CANDLE_MIN_BODY_PX = 1;
const MAX_RIGHT_OFFSET_BARS = 24;
const DEFAULT_INDICATOR_WINDOW_PADDING_BARS = 500;
const MIN_INDICATOR_WINDOW_PADDING_BARS = 64;
/** Id of the default (main) pane that always exists. */
const MAIN_PANE_ID: PaneId = 'main';
/** Minimum pane height weight to prevent zero-height panes. */
const MIN_PANE_HEIGHT = 0.01;

interface ChartDebugHooks {
  onRecomputeStart?: (payload: { indicatorCount: number; sourceLength: number }) => void;
  onRecomputeEnd?: (payload: { indicatorCount: number; sourceLength: number; durationMs: number }) => void;
  onRenderEnd?: (payload: { durationMs: number; barCount: number; indicatorCount: number }) => void;
  onSeriesDataMutation?: (payload: {
    kind: 'setData' | 'update';
    seriesId: string;
    seriesType: SeriesType;
    result?: 'replaced' | 'appended';
    outOfOrderInsert?: boolean;
    sourceLength: number;
  }) => void;
  onIndicatorIncremental?: (payload: {
    indicatorCount: number;
    sourceLength: number;
    fallbackCount: number;
  }) => void;
  onIndicatorFullRecompute?: (payload: {
    indicatorCount: number;
    sourceLength: number;
    usedWorker: boolean;
  }) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function niceStep(range: number, steps: number): number {
  const rough = range / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * mag;
}

const _priceFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtPrice(p: number): string {
  if (!Number.isFinite(p)) return '';
  const abs = Math.abs(p);
  if (abs >= 10000) return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(p);
  return _priceFormatter.format(p);
}

function fmtTime(ts: UTCTimestamp, interval: number, rangeSeconds?: number, prevTs?: UTCTimestamp): string {
  const d = new Date(ts * 1000);
  const span = rangeSeconds ?? interval;
  // Long ranges (≥ ~1 year) → month + year
  if (span >= 365 * 86400) {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  // Medium ranges (≥ ~2 weeks or daily interval) → month + day
  if (span >= 14 * 86400 || interval >= 86400) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  // Short multi-day range (2–14 days, intraday interval): show date at day boundary, HH:MM otherwise.
  if (span >= 2 * 86400) {
    const prev = prevTs != null ? new Date((prevTs as number) * 1000) : null;
    const dayChanged = !prev || prev.getUTCFullYear() !== d.getUTCFullYear() || prev.getUTCMonth() !== d.getUTCMonth() || prev.getUTCDate() !== d.getUTCDate();
    if (dayChanged) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function pickIntradayTickStepSeconds(intervalSeconds: number): number {
  if (intervalSeconds <= 60) return 15 * 60;
  if (intervalSeconds <= 5 * 60) return 30 * 60;
  if (intervalSeconds <= 15 * 60) return 60 * 60;
  if (intervalSeconds <= 30 * 60) return 2 * 60 * 60;
  return intervalSeconds;
}

function resolveTimeTickBars(
  firstBar: number,
  lastBar: number,
  intervalSeconds: number,
  barWidthPx: number,
  minSpacingPx: number,
  timeAt: (index: number) => UTCTimestamp | null,
): number[] {
  if (lastBar < firstBar) return [];
  const safeInterval = Number.isFinite(intervalSeconds) && intervalSeconds > 0
    ? intervalSeconds
    : 60;
  const anchorSeconds = safeInterval < 86400
    ? pickIntradayTickStepSeconds(safeInterval)
    : safeInterval;

  let stepBars = Math.max(1, Math.round(anchorSeconds / safeInterval));
  while (stepBars * Math.max(0.1, barWidthPx) < minSpacingPx) {
    stepBars *= 2;
  }

  let start = -1;
  for (let i = firstBar; i <= lastBar; i += 1) {
    const t = timeAt(i);
    if (t == null) continue;
    if (anchorSeconds > 0 && t % anchorSeconds === 0) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    start = Math.ceil(firstBar / stepBars) * stepBars;
  }

  const ticks: number[] = [];
  // Generate ticks forward from anchor
  for (let i = start; i <= lastBar; i += stepBars) {
    if (timeAt(i) == null) continue;
    ticks.push(i);
  }
  // Also generate ticks backward from anchor so data is covered even when
  // the first time-boundary falls near the end of the visible range.
  for (let i = start - stepBars; i >= firstBar; i -= stepBars) {
    if (timeAt(i) == null) continue;
    ticks.unshift(i);
  }

  if (ticks.length === 0) {
    for (let i = lastBar; i >= firstBar; i -= 1) {
      if (timeAt(i) == null) continue;
      ticks.push(i);
      break;
    }
  }

  return ticks;
}

function fmtCompactVolume(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)} K`;
  return value.toFixed(0);
}

function clampPadding(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(0.45, value as number));
}

function snapCssPixel(value: number): number {
  return Math.round(value) + 0.5;
}

// ─── Log-scale helpers ─────────────────────────────────────────────────────

function logPriceToY(price: number, min: number, max: number, top: number, h: number): number {
  const safeMin = Math.max(1e-10, min);
  const safeMax = Math.max(1e-10, max);
  const safePrice = Math.max(1e-10, price);
  const logMin = Math.log(safeMin);
  const logMax = Math.log(safeMax);
  if (logMax === logMin) return top + h / 2;
  return top + h * (1 - (Math.log(safePrice) - logMin) / (logMax - logMin));
}

function yToLogPrice(y: number, min: number, max: number, top: number, h: number): number {
  const safeMin = Math.max(1e-10, min);
  const safeMax = Math.max(1e-10, max);
  const logMin = Math.log(safeMin);
  const logMax = Math.log(safeMax);
  const ratio = 1 - (y - top) / h;
  return Math.exp(logMin + ratio * (logMax - logMin));
}

/** Compute log-spaced price tick values for a pane in log mode. */
function logPriceTicks(min: number, max: number, targetCount: number): number[] {
  if (min <= 0 || max <= 0 || min >= max) return [];
  const ticks: number[] = [];
  const logMin = Math.log10(Math.max(1e-10, min));
  const logMax = Math.log10(Math.max(1e-10, max));
  const firstDecade = Math.floor(logMin);
  const lastDecade = Math.ceil(logMax);
  const multiples = [1, 2, 3, 5, 7];
  for (let d = firstDecade; d <= lastDecade; d++) {
    const base = Math.pow(10, d);
    for (const m of multiples) {
      const v = base * m;
      if (v >= min && v <= max) ticks.push(v);
    }
  }
  // If too many ticks, keep at most ~targetCount evenly spaced by log position.
  if (ticks.length > targetCount * 2) {
    const step = Math.ceil(ticks.length / targetCount);
    return ticks.filter((_, i) => i % step === 0);
  }
  return ticks;
}

type ParityDebugConfig = {
  enabled?: boolean;
  showPaneBounds?: boolean;
  showScaleValues?: boolean;
  showCursor?: boolean;
};

type ParityDebugGlobal = typeof globalThis & {
  __TRADEREPLAY_PARITY_DEBUG__?: boolean | ParityDebugConfig;
};

function resolveParityDebugConfig(): Required<ParityDebugConfig> {
  const raw = (globalThis as ParityDebugGlobal).__TRADEREPLAY_PARITY_DEBUG__;
  if (raw === true) {
    return {
      enabled: true,
      showPaneBounds: true,
      showScaleValues: true,
      showCursor: true,
    };
  }
  if (!raw || typeof raw !== 'object') {
    return {
      enabled: false,
      showPaneBounds: true,
      showScaleValues: true,
      showCursor: true,
    };
  }
  return {
    enabled: raw.enabled !== false,
    showPaneBounds: raw.showPaneBounds !== false,
    showScaleValues: raw.showScaleValues !== false,
    showCursor: raw.showCursor !== false,
  };
}

function parityDebugEnabled(): boolean {
  return resolveParityDebugConfig().enabled;
}

function resolveCandleBodyWidth(barWidth: number, widthFactor = CANDLE_BODY_WIDTH_FACTOR): number {
  const raw = Math.floor(barWidth * widthFactor);
  const maxAllowed = Math.max(CANDLE_MIN_BODY_PX, Math.floor(barWidth - 1));
  return Math.max(CANDLE_MIN_BODY_PX, Math.min(maxAllowed, raw));
}

/** Bars within this distance of the live edge are treated as "at live edge"
 * for the purpose of auto-advancing rightmostIndex on new streaming bars. */
const LIVE_EDGE_THRESHOLD = 2;

interface SeriesState {
  /** Unique series identifier within this chart instance. */
  id: string;
  type: SeriesType;
  opts: SeriesOptions;
  store: SeriesStore<TimedRow>;
  /** Id of the pane this series belongs to. Defaults to MAIN_PANE_ID. */
  paneId: PaneId;
  scaleMargins: ScaleMargins;
  separateScale: boolean;
  excludeFromTimeIndex: boolean;
  /**
   * If set, this series was created as indicator output.
   * It is excluded from TimeIndex rebuilds (its timestamps are always a
   * subset of the source series' timestamps).
   */
  indicatorInstanceId?: IndicatorInstanceId;
  /** Price lines attached to this series. */
  priceLines: Map<string, PriceLineOptions & { id: string }>;
  /** Bar markers attached to this series. */
  markers: SeriesMarker[];
  /** Plugin primitives attached to this series. */
  primitives: ISeriesPrimitive[];
}

/** Internal state for a live indicator instance. */
interface IndicatorInstance {
  instanceId: IndicatorInstanceId;
  indicatorId: string;
  definition: IndicatorDefinition;
  /** Resolved params merged with defaults from the definition. */
  params: Record<string, number>;
  /**
   * Id of the pane owned by this indicator (subpane output only).
   * `undefined` for overlay-only indicators (no dedicated pane).
   */
  ownedPaneId?: PaneId;
  /** Series ids for each output, parallel to `definition.outputs`. */
  outputSeriesIds: string[];
  /**
   * Length of the source array at the time of the last full recompute.
   * Used by the incremental update path to detect when a full recompute
   * is needed (params changed, bars inserted mid-series, etc.).
   */
  lastFullComputeLength?: number;
}

/** Per-render geometry and price range for a single pane. */
interface PaneRenderState {
  id: PaneId;
  top: number;
  h: number;
  min: number;
  max: number;
}

interface PanePriceScaleState {
  mode: 'auto' | 'manual';
  min: number;
  max: number;
}

type RenderLayerId = 'chart' | 'interaction' | 'demo-cursor' | 'ui';

interface LayerRenderState {
  firstBar: number;
  lastBar: number;
  paneStates: PaneRenderState[];
  seriesRanges: Array<{ min: number; max: number } | null>;
}

type RenderLayer = {
  id: RenderLayerId;
  order: number;
  render: (state: LayerRenderState) => void;
};

// ─── createChart ─────────────────────────────────────────────────────────────

export function createChart(
  container: HTMLElement,
  initOpts?: Partial<ChartOptions>
): IChartApi {
  const parityEnabled = initOpts?.parity?.enabled === true;
  const parityViewMode = initOpts?.parity?.viewMode ?? 'normal';
  const showParityLastPriceLine = parityEnabled && initOpts?.parity?.showLastPriceLine === true;
  const showParityLastValueLabels = parityEnabled && initOpts?.parity?.showLastValueLabels === true;
  const showParityWatermark = parityEnabled && initOpts?.parity?.showWatermark === true;
  const pricePadding = clampPadding(initOpts?.parity?.pricePadding, PRICE_PADDING);
  const volumePadding = clampPadding(initOpts?.parity?.volumePadding, pricePadding);

  function resolvePriceAxisWidth(nextWidth: number): number {
    if (!parityEnabled || parityViewMode !== 'normal') return PRICE_AXIS_W;
    if (nextWidth <= PARITY_COMPACT_PRICE_AXIS_MAX_VIEWPORT_WIDTH) {
      return PARITY_COMPACT_PRICE_AXIS_WIDTH;
    }
    return PRICE_AXIS_W;
  }

  // ── dimensions ──
  let width = (initOpts?.width ?? container.clientWidth) || 800;
  let height = (initOpts?.height ?? container.clientHeight) || 400;
  let priceAxisWidth = resolvePriceAxisWidth(width);

  // ── theme ──
  let bgColor = '#131722';
  let textColor = '#b2b5be';
  let fontFamily = 'Trebuchet MS, Arial, sans-serif';
  let fontSize = 11;
  let gridColor = 'rgba(42, 46, 57, 0.72)';
  let crosshairVColor = 'rgba(120, 123, 134, 0.8)';
  let crosshairHColor = 'rgba(120, 123, 134, 0.8)';
  let axisBorderColor = 'rgba(42, 46, 57, 0.95)';

  if (initOpts?.layout?.background?.color) bgColor = initOpts.layout.background.color;
  if (initOpts?.layout?.textColor) textColor = initOpts.layout.textColor;
  if (initOpts?.layout?.fontFamily) fontFamily = initOpts.layout.fontFamily;
  if (initOpts?.layout?.fontSize != null) fontSize = initOpts.layout.fontSize;
  if (initOpts?.grid?.vertLines?.color) gridColor = initOpts.grid.vertLines.color;
  if (initOpts?.crosshair?.vertLine?.color) crosshairVColor = initOpts.crosshair.vertLine.color;
  if (initOpts?.crosshair?.horzLine?.color) crosshairHColor = initOpts.crosshair.horzLine.color;
  if (initOpts?.rightPriceScale?.borderColor) axisBorderColor = initOpts.rightPriceScale.borderColor;

  // ── chart state ──
  let barWidth = DEFAULT_BAR_WIDTH;
  let rightOffsetBars = Math.max(
    -MAX_RIGHT_OFFSET_BARS,
    Math.min(MAX_RIGHT_OFFSET_BARS, Number(initOpts?.timeScale?.rightOffset ?? 0)),
  );
  /** Index into timeIndex for the bar at the right edge of the chart area. */
  let rightmostIndex = 0;
  const timeIndex = new TimeIndex();
  let mode: InteractionMode = 'idle';
  let crosshairX: number | null = null;
  let crosshairY: number | null = null;

  // Runtime-enforced interaction gates (see ChartOptions.handleScroll/handleScale).
  // When false, the corresponding pointer/wheel behaviour is suppressed so consumers
  // embedding the chart on pages (Symbol Page overview) can let the page scroll
  // normally instead of the chart hijacking the wheel.
  let allowWheelZoom = initOpts?.handleScale?.mouseWheel !== false;
  let allowWheelScroll = initOpts?.handleScroll?.mouseWheel !== false;

  // Optional forced tick timestamps (UTC seconds, e.g. IST fake-UTC boundaries for 1D).
  // When set, drawTimeAxis uses nearest-bar lookup instead of the modulo heuristic.
  let forcedTimeTicks: number[] | null = initOpts?.forcedTimeTicks ?? null;
  let allowPressedMouseMove = initOpts?.handleScroll?.pressedMouseMove !== false;

  // ── Custom formatters ──
  let customPriceFormatter: ((price: number) => string) | null = initOpts?.priceFormatter ?? null;
  let customTimeFormatter: ((time: UTCTimestamp) => string) | null = initOpts?.timeFormatter ?? null;

  // ── Price scale modes (per pane) ──
  const priceScaleModes = new Map<PaneId, PriceScaleMode>();

  // ── Pane-level primitives ──
  const panePrimitives = new Map<PaneId, IPanePrimitive[]>();

  // ── Kinetic scroll ──
  let kineticVelocity = 0;
  let kineticRafId: number | null = null;
  let kineticLastClientX = 0;
  let kineticLastTs = 0;

  // ── Click event listeners ──
  const clickListeners = new Set<(param: CrosshairMoveEvent) => void>();
  const dblClickListeners = new Set<(param: CrosshairMoveEvent) => void>();

  // ── Price line sequence ──
  let nextPriceLineSeq = 0;

  // ────────────────────────────────────────────────────────────────────────────
  // DEMO CURSOR (TradingView "presentation mode" brush)
  //
  // When Alt is held and the user clicks+drags, a freehand stroke is drawn in
  // a bright highlight colour.  The stroke fades to fully transparent over
  // DEMO_FADE_MS milliseconds after the pointer is released, exactly mimicking
  // TradingView's "Hold Alt for temporary drawing" feature.
  // ────────────────────────────────────────────────────────────────────────────

  /** A single freehand demo stroke. */
  interface DemoStroke {
    points: { x: number; y: number }[];
    startTime: number;   // performance.now() when drawing began
    endTime: number | null; // performance.now() when pointer released, null = ongoing
    color: string;
    lineWidth: number;
    fadeDuration: number; // ms to fully fade — captured from config at creation time
  }

  const DEMO_FADE_MS = 3000;   // 3 seconds to fully fade — same as TradingView
  const DEMO_STROKE_COLOR = 'rgba(255, 80, 80, 1)';   // TradingView-style red/orange
  const DEMO_LINE_WIDTH = 3;

  const demoStrokes: DemoStroke[] = [];
  let demoCursorActive = false;      // true while Alt+pointer is held
  let demoCursorForceMode = false;   // true when toolbar "Demonstration" cursor is selected
  let demoCursorRafId: number | null = null;
  // Mutable config — can be changed via IDemoCursorApi
  let demoCursorColor = DEMO_STROKE_COLOR;
  let demoCursorLineWidth = DEMO_LINE_WIDTH;
  let demoCursorFadeDuration = DEMO_FADE_MS;

  /** Called on every RAF tick while there are strokes that are still fading. */
  function demoCursorFadeLoop(): void {
    const now = performance.now();
    // Remove fully faded strokes
    let i = demoStrokes.length - 1;
    while (i >= 0) {
      const stroke = demoStrokes[i];
      if (stroke.endTime !== null && now - stroke.endTime >= stroke.fadeDuration) {
        demoStrokes.splice(i, 1);
      }
      i--;
    }
    scheduleRender('demo-cursor-fade');
    if (demoStrokes.length > 0) {
      demoCursorRafId = requestAnimationFrame(demoCursorFadeLoop);
    } else {
      demoCursorRafId = null;
    }
  }

  /** Draw all active demo strokes onto the canvas context. */
  function drawDemoCursor(): void {
    if (demoStrokes.length === 0) return;
    const now = performance.now();
    ctx.save();
    // Clip to chart area (exclude the right price axis)
    ctx.beginPath();
    ctx.rect(0, 0, cw(), ch());
    ctx.clip();

    for (const stroke of demoStrokes) {
      if (stroke.points.length < 2) {
        // Single dot
        if (stroke.points.length === 1) {
          let alpha = 1;
          if (stroke.endTime !== null) {
            alpha = Math.max(0, 1 - (now - stroke.endTime) / stroke.fadeDuration);
          }
          if (alpha <= 0) continue;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = stroke.color;
          ctx.beginPath();
          ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.lineWidth / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        continue;
      }

      let alpha = 1;
      if (stroke.endTime !== null) {
        alpha = Math.max(0, 1 - (now - stroke.endTime) / stroke.fadeDuration);
      }
      if (alpha <= 0) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let pi = 1; pi < stroke.points.length; pi++) {
        // Smooth the stroke using quadratic bezier midpoints (same technique
        // used in TradingView's pen tool for a smooth freehand look)
        if (pi < stroke.points.length - 1) {
          const midX = (stroke.points[pi].x + stroke.points[pi + 1].x) / 2;
          const midY = (stroke.points[pi].y + stroke.points[pi + 1].y) / 2;
          ctx.quadraticCurveTo(stroke.points[pi].x, stroke.points[pi].y, midX, midY);
        } else {
          ctx.lineTo(stroke.points[pi].x, stroke.points[pi].y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // ── Pane-aware price↔Y wrappers ──────────────────────────────────────────
  // These respect the current PriceScaleMode (Normal vs Logarithmic).

  function getPaneScaleMode(paneId: PaneId): PriceScaleMode {
    return priceScaleModes.get(paneId) ?? 'Normal';
  }

  function p2y(price: number, pane: PaneRenderState): number {
    if (getPaneScaleMode(pane.id) === 'Logarithmic') {
      return logPriceToY(price, pane.min, pane.max, pane.top, pane.h);
    }
    return priceToY(price, pane.min, pane.max, pane.top, pane.h);
  }

  function y2p(y: number, pane: PaneRenderState): number {
    if (getPaneScaleMode(pane.id) === 'Logarithmic') {
      return yToLogPrice(y, pane.min, pane.max, pane.top, pane.h);
    }
    return yToPrice(y, pane.min, pane.max, pane.top, pane.h);
  }

  /** Compute price tick values for a pane, respecting log mode. */
  function gridPriceTicks(pane: PaneRenderState, targetCount: number): number[] {
    if (getPaneScaleMode(pane.id) === 'Logarithmic') {
      return logPriceTicks(pane.min, pane.max, targetCount);
    }
    const priceRange = pane.max - pane.min;
    const hStep = niceStep(priceRange, targetCount);
    const ticks: number[] = [];
    let p = Math.ceil(pane.min / hStep) * hStep;
    while (p <= pane.max) {
      ticks.push(p);
      p += hStep;
    }
    return ticks;
  }

  // ── Resolved formatters ──────────────────────────────────────────────────
  function resolvedPriceFormatter(p: number): string {
    return customPriceFormatter ? customPriceFormatter(p) : fmtPrice(p);
  }

  function resolvedTimeFormatter(
    ts: UTCTimestamp,
    interval: number,
    rangeSeconds?: number,
    prevTs?: UTCTimestamp,
  ): string {
    if (customTimeFormatter) return customTimeFormatter(ts);
    return fmtTime(ts, interval, rangeSeconds, prevTs);
  }

  // ── Primitive geometry builder ────────────────────────────────────────────
  function buildPrimitiveGeometry(pane: PaneRenderState, rs: RenderState): IPrimitiveGeometry {
    return {
      ctx,
      barToX: (idx: number) => barToX(idx),
      priceToY: (price: number) => p2y(price, pane),
      yToPrice: (y: number) => y2p(y, pane),
      xToBar: (x: number) => xToBar(x),
      firstBar: rs.firstBar,
      lastBar: rs.lastBar,
      paneTop: pane.top,
      paneHeight: pane.h,
      chartWidth: cw(),
      chartHeight: ch(),
      timeAt: (index: number) => timeIndex.at(index) ?? null,
    };
  }

  /** Draw all primitives for a pane at a specific zOrder level. */
  function drawPrimitivesForPane(
    pane: PaneRenderState,
    rs: RenderState,
    zOrder: PrimitivePaneViewZOrder,
  ): void {
    const geo = buildPrimitiveGeometry(pane, rs);

    // Series-attached primitives
    for (const s of seriesList) {
      if (s.paneId !== pane.id) continue;
      for (const primitive of s.primitives) {
        for (const view of primitive.paneViews?.() ?? []) {
          if ((view.zOrder ?? 'normal') === zOrder) {
            const renderer = view.renderer();
            renderer.draw(ctx, geo);
          }
        }
        // Draw custom axis labels
        if (zOrder === 'top') {
          for (const axView of primitive.priceAxisViews?.() ?? []) {
            if (axView.visible?.() === false) continue;
            const yCoord = axView.coordinate();
            if (yCoord < pane.top || yCoord > pane.top + pane.h) continue;
            const label = axView.text();
            const bg = axView.backgroundColor?.() ?? '#2962ff';
            const fg = axView.textColor?.() ?? '#ffffff';
            const labelH = 16;
            ctx.font = `${fontSize}px ${fontFamily}`;
            const boxW = Math.max(38, Math.ceil(ctx.measureText(label).width + 10));
            ctx.fillStyle = bg;
            ctx.fillRect(cw() + 2, yCoord - labelH / 2, boxW, labelH);
            ctx.fillStyle = fg;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, cw() + 2 + boxW / 2, yCoord);
          }
        }
      }
    }

    // Pane-level primitives
    for (const primitive of panePrimitives.get(pane.id) ?? []) {
      for (const view of primitive.paneViews?.() ?? []) {
        if ((view.zOrder ?? 'normal') === zOrder) {
          const renderer = view.renderer();
          renderer.draw(ctx, geo);
        }
      }
    }
  }

  /** Draw price lines for a series. */
  function drawPriceLinesForSeries(s: SeriesState, rs: RenderState, pane: PaneRenderState): void {
    if (s.priceLines.size === 0) return;
    const w = cw();
    ctx.save();
    for (const pl of s.priceLines.values()) {
      const y = snapCssPixel(p2y(pl.price, pane));
      if (y < pane.top || y > pane.top + pane.h) continue;
      const color = pl.color ?? '#787b86';
      ctx.strokeStyle = color;
      ctx.lineWidth = pl.lineWidth ?? 1;
      switch (pl.lineStyle) {
        case 'Dashed': ctx.setLineDash([5, 3]); break;
        case 'Dotted': ctx.setLineDash([2, 3]); break;
        default: ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (pl.axisLabelVisible !== false) {
        const label = pl.title
          ? `${resolvedPriceFormatter(pl.price)} ${pl.title}`
          : resolvedPriceFormatter(pl.price);
        const labelH = 16;
        ctx.font = `${fontSize}px ${fontFamily}`;
        const boxW = Math.max(38, Math.ceil(ctx.measureText(label).width + 10));
        ctx.fillStyle = color;
        ctx.fillRect(w + 2, y - labelH / 2, boxW, labelH);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, w + 2 + boxW / 2, y);
      }
    }
    ctx.restore();
  }

  /** Draw bar markers for a series. */
  function drawMarkersForSeries(s: SeriesState, rs: RenderState, pane: PaneRenderState): void {
    if (s.markers.length === 0) return;
    ctx.save();
    for (const marker of s.markers) {
      const barIdx = timeIndex.indexOf(marker.time);
      if (barIdx < 0 || barIdx < rs.firstBar || barIdx > rs.lastBar) continue;
      const row = s.store.getAt(barIdx) as (CandlestickData & LineData) | null;
      if (!row) continue;
      const x = barToX(barIdx);
      const color = marker.color ?? '#ffffff';
      const sz = (marker.size ?? 1) * Math.max(4, barWidth * 0.6);

      let refPrice: number;
      if (s.type === 'Candlestick' || s.type === 'Bar') {
        const cd = row as CandlestickData;
        if (marker.position === 'aboveBar') refPrice = cd.high;
        else if (marker.position === 'belowBar') refPrice = cd.low;
        else refPrice = (cd.high + cd.low) / 2;
      } else {
        refPrice = row.value;
      }

      const refY = p2y(refPrice, pane);
      let y: number;
      if (marker.position === 'aboveBar') y = refY - sz - 4;
      else if (marker.position === 'belowBar') y = refY + sz + 4;
      else y = refY;

      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      switch (marker.shape) {
        case 'arrowUp': {
          ctx.beginPath();
          ctx.moveTo(x, y - sz * 0.7);
          ctx.lineTo(x + sz * 0.5, y + sz * 0.3);
          ctx.lineTo(x - sz * 0.5, y + sz * 0.3);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'arrowDown': {
          ctx.beginPath();
          ctx.moveTo(x, y + sz * 0.7);
          ctx.lineTo(x + sz * 0.5, y - sz * 0.3);
          ctx.lineTo(x - sz * 0.5, y - sz * 0.3);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'square': {
          ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
          break;
        }
        default: { // 'circle'
          ctx.beginPath();
          ctx.arc(x, y, sz / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }

      if (marker.text) {
        ctx.fillStyle = textColor;
        ctx.font = `${Math.max(9, fontSize - 1)}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = marker.position === 'aboveBar' ? 'bottom' : 'top';
        const textY = marker.position === 'aboveBar' ? y - sz * 0.5 : y + sz * 0.5;
        ctx.fillText(marker.text, x, textY);
      }
    }
    ctx.restore();
  }

  /** Ordered list of pane definitions; main pane is always first. */
  const panes: PaneDef[] = [{ id: MAIN_PANE_ID, height: 1 }];
  const panePriceScales = new Map<PaneId, PanePriceScaleState>();
  let nextPaneSeq = 0;
  let nextSeriesSeq = 0;
  let nextIndicatorSeq = 0;

  const seriesList: SeriesState[] = [];
  const indicatorInstances = new Map<IndicatorInstanceId, IndicatorInstance>();
  let rafId: number | null = null;
  let renderQueued = false;
  let destroyed = false;
  let renderMicrotaskQueued = false;
  const renderReasons = new Set<string>();
  let indicatorRafId: number | null = null;
  let indicatorWorker: Worker | null = null;
  let indicatorWorkerRequestSeq = 0;
  let indicatorWorkerLastAppliedSeq = 0;
  let indicatorWorkerInFlightRequestId: number | null = null;
  let indicatorComputeWindow: IndicatorComputeWindow | null = null;
  const indicatorEngineMode = initOpts?.indicatorEngine?.mode ?? 'auto';
  const indicatorVisibleRangeOnly = initOpts?.indicatorEngine?.visibleRangeOnly ?? false;
  const indicatorWindowPaddingBars = Math.max(
    MIN_INDICATOR_WINDOW_PADDING_BARS,
    Math.floor(initOpts?.indicatorEngine?.windowPaddingBars ?? DEFAULT_INDICATOR_WINDOW_PADDING_BARS),
  );
  const debugHooks = (globalThis as typeof globalThis & { __TRADEREPLAY_CHART_DEBUG__?: ChartDebugHooks }).__TRADEREPLAY_CHART_DEBUG__;

  // ── perf telemetry (opt-in) ──
  // Activating via chart option also flips the global flag so that overlay renderers
  // (e.g. TradingChart.tsx) can find the same singleton via getGlobalPerfTelemetry().
  const perf = initOpts?.perfDebug ? enableGlobalPerfTelemetry() : getGlobalPerfTelemetry();
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;user-select:none;touch-action:none;';
  container.style.position = 'relative';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  let canvasDpr = window.devicePixelRatio || 1;
  let renderSeq = 0;
  let lastParityCanvasSetupLogKey = '';

  function resolveDevicePixelRatio(): number {
    const dpr = window.devicePixelRatio || 1;
    if (!Number.isFinite(dpr) || dpr <= 0) return 1;
    return dpr;
  }

  function maybeLogParityCanvasSetup(reason: string, nextWidth: number, nextHeight: number): void {
    if (!parityDebugEnabled()) return;

    const rect = container.getBoundingClientRect();
    const expectedWidth = width * canvasDpr;
    const expectedHeight = height * canvasDpr;
    const scaled = Math.abs(canvas.width - expectedWidth) <= 1 && Math.abs(canvas.height - expectedHeight) <= 1;
    const logKey = [
      reason,
      width.toFixed(2),
      height.toFixed(2),
      canvasDpr.toFixed(4),
      `${canvas.width}x${canvas.height}`,
      `${nextWidth}x${nextHeight}`,
      `${container.clientWidth}x${container.clientHeight}`,
      `${rect.width.toFixed(2)}x${rect.height.toFixed(2)}`,
      scaled ? '1' : '0',
    ].join('|');

    if (logKey === lastParityCanvasSetupLogKey) return;
    lastParityCanvasSetupLogKey = logKey;

    const payload = {
      reason,
      cssWidth: width,
      cssHeight: height,
      dpr: Number(canvasDpr.toFixed(4)),
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      expectedCanvasWidth: Math.round(expectedWidth),
      expectedCanvasHeight: Math.round(expectedHeight),
      nextCanvasWidth: nextWidth,
      nextCanvasHeight: nextHeight,
      containerClientWidth: container.clientWidth,
      containerClientHeight: container.clientHeight,
      containerRectWidth: Number(rect.width.toFixed(2)),
      containerRectHeight: Number(rect.height.toFixed(2)),
      scaled,
    };

    console.info(`[parity:canvas-setup] ${JSON.stringify(payload)}`);
  }

  function resizeCanvas(forcedDpr?: number, reason = 'resize'): void {
    canvasDpr = forcedDpr != null ? forcedDpr : resolveDevicePixelRatio();
    priceAxisWidth = resolvePriceAxisWidth(width);
    const nextWidth = Math.max(1, Math.round(width * canvasDpr));
    const nextHeight = Math.max(1, Math.round(height * canvasDpr));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
    maybeLogParityCanvasSetup(reason, nextWidth, nextHeight);
  }
  resizeCanvas(undefined, 'init');

  // ── layout helpers ──
  function cw(): number { return width - priceAxisWidth; }
  function ch(): number { return height - TIME_AXIS_H; }
  function vbars(): number { return cw() / barWidth; }
  function maxBarWidthForViewport(): number {
    return Math.max(MIN_BAR_WIDTH, Math.min(MAX_BAR_WIDTH, cw() / 2));
  }

  function clampRightmostIndex(next: number): number {
    if (!timeIndex.length) return 0;
    const max = (timeIndex.length - 1) + MAX_RIGHT_OFFSET_BARS;
    const minVisibleBars = Math.max(2, Math.ceil(cw() / MAX_BAR_WIDTH));
    const minLogicalRightEdge = minVisibleBars - 0.5;
    const min = Math.min(timeIndex.length - 1, Math.max(minLogicalRightEdge, vbars() - 0.5));
    return Math.max(min, Math.min(max, next));
  }

  function getPanePriceScaleState(paneId: PaneId): PanePriceScaleState | undefined {
    return panePriceScales.get(paneId);
  }

  function setPanePriceScaleAuto(paneId: PaneId): void {
    panePriceScales.delete(paneId);
  }

  function setPanePriceScaleManual(paneId: PaneId, min: number, max: number): void {
    panePriceScales.set(paneId, { mode: 'manual', min, max });
  }

  function resolvePriceScaleRange(paneId: PaneId, autoMin: number, autoMax: number): { min: number; max: number } {
    const state = getPanePriceScaleState(paneId);
    if (state?.mode === 'manual') {
      return { min: state.min, max: state.max };
    }
    return { min: autoMin, max: autoMax };
  }

  // bar index → screen x (center of bar)
  function barToX(idx: number): number {
    return cw() - (rightmostIndex - idx + 0.5) * barWidth;
  }
  // screen x → bar index (float)
  function xToBar(x: number): number {
    return rightmostIndex + 0.5 - (cw() - x) / barWidth;
  }

  function isWorkerModeEnabled(): boolean {
    if (indicatorEngineMode === 'main-thread') return false;
    if (indicatorEngineMode === 'worker') return typeof Worker !== 'undefined';
    return typeof Worker !== 'undefined' && typeof window !== 'undefined';
  }

  function ensureIndicatorWorker(): Worker | null {
    if (!isWorkerModeEnabled()) return null;
    if (indicatorWorker) return indicatorWorker;

    try {
      indicatorWorker = new Worker(
        new URL('../indicators/engine/indicatorWorker.ts', import.meta.url),
        { type: 'module' },
      );
      return indicatorWorker;
    } catch {
      indicatorWorker = null;
      return null;
    }
  }

  function getVisibleBarWindow(): { first: number; last: number } {
    const first = Math.max(0, Math.floor(xToBar(0)));
    const last = Math.min(timeIndex.length - 1, Math.ceil(rightmostIndex));
    return { first, last };
  }

  function getIndicatorWindow(totalBars: number): IndicatorComputeWindow {
    if (!indicatorVisibleRangeOnly || totalBars <= 0) {
      return { start: 0, end: Math.max(0, totalBars - 1) };
    }

    const visible = getVisibleBarWindow();
    const start = Math.max(0, visible.first - indicatorWindowPaddingBars);
    const end = Math.min(totalBars - 1, visible.last + indicatorWindowPaddingBars);
    return { start, end };
  }

  function sourceForWindow(
    source: {
      times: UTCTimestamp[];
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    },
    windowRange: IndicatorComputeWindow,
  ): {
    times: UTCTimestamp[];
    open: (number | null)[];
    high: (number | null)[];
    low: (number | null)[];
    close: (number | null)[];
    volume: (number | null)[];
  } {
    return {
      times: source.times.slice(windowRange.start, windowRange.end + 1),
      open: source.open.slice(windowRange.start, windowRange.end + 1),
      high: source.high.slice(windowRange.start, windowRange.end + 1),
      low: source.low.slice(windowRange.start, windowRange.end + 1),
      close: source.close.slice(windowRange.start, windowRange.end + 1),
      volume: source.volume.slice(windowRange.start, windowRange.end + 1),
    };
  }

  // ── time management ──
  /**
   * Rebuild the canonical TimeIndex from all **source** series' raw rows
   * (indicator output series are excluded — their timestamps are always a
   * subset of the source timestamps), re-align every store, then update
   * `rightmostIndex`.
   *
   * Called once after all series have been `setData`-ed for the same symbol
   * so the index is consistent.  O(S·N·log(S·N)).
   */
  function rebuildIndex(): void {
    const oldLastTime =
      timeIndex.length > 0 ? timeIndex.at(timeIndex.length - 1) : null;

    // Only source series (non-indicator) contribute timestamps.
    timeIndex.rebuild(
      seriesList
        .filter((s) => !s.indicatorInstanceId && !s.excludeFromTimeIndex)
        .map((s) =>
          (s.store.rawRows as Array<{ time: UTCTimestamp }>).map((r) => r.time),
        ),
    );

    for (const s of seriesList) {
      s.store.realign();
    }

    const newLen = timeIndex.length;
    if (newLen === 0) {
      rightmostIndex = 0;
      // Clear indicator output stores on empty source.
      recomputeIndicators();
      return;
    }

    const newLastTime = timeIndex.at(newLen - 1)!;
    if (oldLastTime === null || newLastTime !== oldLastTime) {
      // First load or symbol switch: jump to the live edge.
      rightmostIndex = clampRightmostIndex((newLen - 1) + rightOffsetBars);
    } else {
      // Clamp to valid range (handles shrinking data sets).
      rightmostIndex = clampRightmostIndex(rightmostIndex);
    }

    // Recompute all indicator outputs with the updated source data.
    recomputeIndicators();
  }

  // ── indicator helpers ────────────────────────────────────────────────────────

  /**
   * Extract OHLCV arrays from the first source Candlestick or Bar series.
   * Returns `null` if no such series has been loaded yet.
   */
  function getSourceOhlcv(): {
    times: UTCTimestamp[];
    open: (number | null)[];
    high: (number | null)[];
    low: (number | null)[];
    close: (number | null)[];
    volume: (number | null)[];
  } | null {
    const src = seriesList.find(
      (s) =>
        !s.indicatorInstanceId &&
        (s.type === 'Candlestick' || s.type === 'Bar') &&
        s.store.length > 0,
    );
    if (!src) return null;

    const n = timeIndex.length;
    const times: UTCTimestamp[] = [];
    const open: (number | null)[] = [];
    const high: (number | null)[] = [];
    const low: (number | null)[] = [];
    const close: (number | null)[] = [];
    const volume: (number | null)[] = [];

    for (let i = 0; i < n; i++) {
      const t = timeIndex.at(i);
      if (t == null) continue;
      const row = src.store.getAt(i) as CandlestickData | null;
      times.push(t);
      open.push(row?.open ?? null);
      high.push(row?.high ?? null);
      low.push(row?.low ?? null);
      close.push(row?.close ?? null);
      volume.push(null); // volume tracked separately; not used by SMA/EMA/RSI/MACD
    }

    return { times, open, high, low, close, volume };
  }

  /**
   * Recompute all indicator instances and push the results into their output
   * series stores.  Called automatically from `rebuildIndex()` (full setData)
   * and from the streaming update path in `makeSeries.update()`.
   *
   * The implementation always does a full recompute.  For the common case of
   * a few hundred bars and simple indicators this is fast enough to run on
   * every tick.  Incremental paths (using `SeriesStore.update()`) can be added
   * per-indicator in the future without changing this interface.
   */
  function clearIndicatorOutputs(): void {
    for (const inst of indicatorInstances.values()) {
      for (const sid of inst.outputSeriesIds) {
        const ss = seriesList.find((s) => s.id === sid);
        if (!ss) continue;
        ss.store.setData([]);
        ss.store.realign();
      }
    }
  }

  function applyIndicatorOutputWindow(
    inst: IndicatorInstance,
    windowRange: IndicatorComputeWindow,
    sourceTimes: UTCTimestamp[],
    outputs: (number | null)[][],
  ): void {
    for (let oi = 0; oi < inst.outputSeriesIds.length; oi++) {
      const sid = inst.outputSeriesIds[oi];
      const ss = seriesList.find((s) => s.id === sid);
      if (!ss) continue;

      const values = outputs[oi] ?? [];
      const rows: TimedRow[] = [];
      for (let k = 0; k < values.length; k++) {
        const v = values[k];
        if (v == null) continue;
        const absoluteIndex = windowRange.start + k;
        if (absoluteIndex < 0 || absoluteIndex >= sourceTimes.length) continue;
        rows.push({ time: sourceTimes[absoluteIndex], value: v } as TimedRow);
      }

      ss.store.setData(rows);
      ss.store.realign();
    }
  }

  /**
   * Compute the minimum lookback horizon needed for an incremental tail recompute.
   *
   * For most indicators the relevant horizon is the largest numeric param value
   * (period) multiplied by a 3× safety factor to account for cascaded EMAs or
   * multi-smoothing indicators (e.g. MACD signal = EMA of EMA of close).
   *
   * Minimum horizon is 2 (always recompute at least the last two bars so carry-
   * forward logic has a predecessor to read).
   */
  function getIncrementalLookback(inst: IndicatorInstance): number {
    const maxPeriod = Object.values(inst.params).reduce(
      (acc, v) => (typeof v === 'number' && v > acc ? v : acc),
      0,
    );
    return Math.max(2, Math.ceil(maxPeriod * 3));
  }

  /**
   * Patch output stores for a single indicator instance using a tail recompute.
   *
   * Strategy:
   *   1. Determine the recompute start index: `max(0, srcLen - lookback)`.
   *   2. Run the indicator's `compute()` on the tail slice.
   *   3. Write back only the tail values with `store.setAt()` — leaving the
   *      already-correct head values untouched and avoiding a full `setData`.
   *
   * The function returns `true` on success and `false` when a full recompute is
   * required instead (e.g. source length changed by more than the lookback).
   */
  function applyIndicatorIncrementalTail(
    inst: IndicatorInstance,
    source: {
      times: UTCTimestamp[];
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    },
  ): boolean {
    const srcLen = source.times.length;
    if (srcLen === 0) return false;

    const prev = inst.lastFullComputeLength ?? 0;
    const lookback = getIncrementalLookback(inst);

    // If too many new bars have appeared since last full compute, fall back.
    const addedBars = srcLen - prev;
    if (addedBars < 0 || addedBars > lookback) return false;

    // Tail start: far enough back to cover the lookback window.
    const tailStart = Math.max(0, srcLen - lookback);

    const tailCtx = {
      times: source.times.slice(tailStart),
      open:   source.open.slice(tailStart),
      high:   source.high.slice(tailStart),
      low:    source.low.slice(tailStart),
      close:  source.close.slice(tailStart),
      volume: source.volume.slice(tailStart),
      params: inst.params,
    };

    const result = inst.definition.compute(tailCtx);

    // Patch the output store tail in-place.
    for (let oi = 0; oi < inst.outputSeriesIds.length; oi++) {
      const sid = inst.outputSeriesIds[oi];
      const ss  = seriesList.find((s) => s.id === sid);
      if (!ss) continue;

      const values = result.outputs[oi] ?? [];
      for (let k = 0; k < values.length; k++) {
        const v = values[k];
        const absoluteIndex = tailStart + k;
        if (absoluteIndex >= srcLen) break;
        const t = source.times[absoluteIndex];
        const alignedIdx = timeIndex.indexOf(t);
        if (alignedIdx < 0) continue;

        if (v == null) {
          // The indicator produced null for this slot — honour it.
          ss.store.setAt(alignedIdx, null as unknown as TimedRow);
        } else {
          ss.store.setAt(alignedIdx, { time: t, value: v } as TimedRow);
        }
      }
    }

    inst.lastFullComputeLength = srcLen;
    return true;
  }

  /**
   * Incremental recompute path for the streaming `update()` call.
   *
   * For each registered indicator instance this tries the fast tail recompute.
   * If any instance cannot be patched incrementally, that instance falls back to
   * a full window recompute (only for those that need it).
   * Never calls `clearIndicatorOutputs()` — existing values outside the tail
   * remain intact.
   */
  function recomputeIndicatorsIncremental(source: {
    times: UTCTimestamp[];
    open: (number | null)[];
    high: (number | null)[];
    low: (number | null)[];
    close: (number | null)[];
    volume: (number | null)[];
  }): void {
    const windowRange = getIndicatorWindow(source.times.length);
    let fallbackCount = 0;

    for (const inst of indicatorInstances.values()) {
      const ok = applyIndicatorIncrementalTail(inst, source);
      if (!ok) {
        fallbackCount += 1;
        // Fallback for this specific indicator: window recompute.
        const windowSrc = sourceForWindow(source, windowRange);
        const ctx = { ...windowSrc, params: inst.params };
        const result = inst.definition.compute(ctx);
        applyIndicatorOutputWindow(inst, windowRange, source.times, result.outputs);
        inst.lastFullComputeLength = source.times.length;
      }
    }

    indicatorComputeWindow = windowRange;
    debugHooks?.onIndicatorIncremental?.({
      indicatorCount: indicatorInstances.size,
      sourceLength: source.times.length,
      fallbackCount,
    });
    perf?.record('indicatorIncremental', 0); // signal incremental path was used
  }

  function recomputeIndicatorsMainThread(
    source: {
      times: UTCTimestamp[];
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    },
    windowRange: IndicatorComputeWindow,
  ): void {
    const windowSource = sourceForWindow(source, windowRange);
    const ctx = {
      times: windowSource.times,
      open: windowSource.open,
      high: windowSource.high,
      low: windowSource.low,
      close: windowSource.close,
      volume: windowSource.volume,
    };

    for (const inst of indicatorInstances.values()) {
      const result = inst.definition.compute({ ...ctx, params: inst.params });
      applyIndicatorOutputWindow(inst, windowRange, source.times, result.outputs);
      inst.lastFullComputeLength = source.times.length;
    }

    indicatorComputeWindow = windowRange;
  }

  function recomputeIndicatorsWorker(
    source: {
      times: UTCTimestamp[];
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    },
    windowRange: IndicatorComputeWindow,
  ): boolean {
    const worker = ensureIndicatorWorker();
    if (!worker) return false;
    if (indicatorWorkerInFlightRequestId != null) return false;

    const requestId = ++indicatorWorkerRequestSeq;
    indicatorWorkerInFlightRequestId = requestId;
    const request: IndicatorWorkerRequest = {
      requestId,
      source,
      window: windowRange,
      instances: Array.from(indicatorInstances.values()).map((inst) => ({
        instanceId: inst.instanceId,
        indicatorId: inst.indicatorId,
        params: inst.params,
        outputCount: inst.outputSeriesIds.length,
      })),
    };

    worker.onmessage = (event: MessageEvent<IndicatorWorkerResponse>) => {
      const response = event.data;
      if (response.requestId !== requestId) return;
      indicatorWorkerInFlightRequestId = null;
      if (response.requestId <= indicatorWorkerLastAppliedSeq) return;
      indicatorWorkerLastAppliedSeq = response.requestId;

      if (response.error) {
        recomputeIndicatorsMainThread(source, windowRange);
        scheduleRender();
        return;
      }

      for (const item of response.results) {
        const inst = indicatorInstances.get(item.instanceId);
        if (!inst) continue;
        applyIndicatorOutputWindow(inst, response.window, source.times, item.outputs);
        inst.lastFullComputeLength = source.times.length;
      }

      if (response.durationMs != null) {
        // Record actual off-thread compute time reported back by the worker.
        perf?.record('indicatorWorker', response.durationMs);
      }

      indicatorComputeWindow = response.window;
      scheduleRender();
    };

    worker.onerror = () => {
      indicatorWorkerInFlightRequestId = null;
    };

    worker.postMessage(request);
    return true;
  }

  function recomputeIndicators(): void {
    if (indicatorInstances.size === 0) return;

    const sourceLength = timeIndex.length;
    const recomputeStart = performance.now();
    debugHooks?.onRecomputeStart?.({ indicatorCount: indicatorInstances.size, sourceLength });

    const src = getSourceOhlcv();
    if (!src || src.times.length === 0) {
      clearIndicatorOutputs();
      indicatorComputeWindow = null;
      return;
    }

    const windowRange = getIndicatorWindow(src.times.length);
    const usedWorker = recomputeIndicatorsWorker(src, windowRange);
    if (!usedWorker) {
      recomputeIndicatorsMainThread(src, windowRange);
      indicatorWorkerLastAppliedSeq = Math.max(indicatorWorkerLastAppliedSeq, indicatorWorkerRequestSeq);
    }

    debugHooks?.onIndicatorFullRecompute?.({
      indicatorCount: indicatorInstances.size,
      sourceLength,
      usedWorker,
    });

    const recomputeDurationMs = performance.now() - recomputeStart;
    debugHooks?.onRecomputeEnd?.({
      indicatorCount: indicatorInstances.size,
      sourceLength,
      durationMs: recomputeDurationMs,
    });
    // For the worker path, durationMs is near-zero (work is off-thread); the actual
    // worker compute time is not instrumented here since it's asynchronous.  We label
    // the metric clearly so consumers know this is main-thread-side latency only.
    perf?.record(usedWorker ? 'indicatorDispatch' : 'indicatorCompute', recomputeDurationMs);
  }

  function scheduleIndicatorRecompute(): void {
    if (indicatorRafId != null) return;
    indicatorRafId = requestAnimationFrame(() => {
      indicatorRafId = null;
      recomputeIndicators();
      scheduleRender();
    });
  }

  // ── price scale helpers ──
  function computePriceRange(
    s: SeriesState,
    first: number,
    last: number
  ): { min: number; max: number } | null {
    let min = Infinity;
    let max = -Infinity;
    for (let i = Math.max(0, first); i <= Math.min(s.store.length - 1, last); i++) {
      const row = s.store.getAt(i) as (CandlestickData & LineData & HistogramData) | null;
      if (!row) continue;
      if (s.type === 'Candlestick' || s.type === 'Bar') {
        min = Math.min(min, row.low);
        max = Math.max(max, row.high);
      } else {
        const v = row.value;
        min = Math.min(min, v);
        if (s.type === 'Baseline') {
          // Use the actual baseValue.price (prevClose) as the floor, not 0.
          // This prevents the price axis from spanning 0–1400 when the baseline is at 1315.
          const basePrice = s.opts.baseValue?.price ?? 0;
          min = Math.min(min, basePrice);
        } else if (s.type === 'Histogram') {
          min = Math.min(min, 0);
        }
        max = Math.max(max, v);
      }
    }
    if (!isFinite(min) || !isFinite(max)) return null;
    const rangePadding = s.type === 'Histogram' ? volumePadding : pricePadding;
    return padPriceRange(min, max, rangePadding);
  }

  interface RenderState {
    firstBar: number;
    lastBar: number;
    /** Per-pane geometry and price ranges. */
    paneStates: PaneRenderState[];
    /** Per-series separate-scale ranges (indexed by seriesList position). */
    seriesRanges: (ReturnType<typeof computePriceRange>)[];
  }

  function computeRenderState(): RenderState {
    let firstBar = Math.max(0, Math.floor(xToBar(0)));
    let lastBar = Math.min(timeIndex.length - 1, Math.ceil(rightmostIndex));

    if (timeIndex.length > 0) {
      const minVisibleBars = Math.max(2, Math.ceil(cw() / MAX_BAR_WIDTH));
      const neededBars = Math.min(timeIndex.length, minVisibleBars);
      const currentBars = lastBar >= firstBar ? (lastBar - firstBar + 1) : 0;
      if (currentBars < neededBars) {
        lastBar = Math.max(lastBar, neededBars - 1);
        if (lastBar > timeIndex.length - 1) lastBar = timeIndex.length - 1;
        firstBar = Math.max(0, lastBar - neededBars + 1);
      }
    }

    const layout = computePaneLayout(panes, ch());

    const paneStates: PaneRenderState[] = layout.map(({ id, top, h }) => {
      let min = Infinity;
      let max = -Infinity;
      for (const s of seriesList) {
        if (s.opts.visible === false || s.paneId !== id || s.separateScale) continue;
        const r = computePriceRange(s, firstBar, lastBar);
        if (r) { min = Math.min(min, r.min); max = Math.max(max, r.max); }
      }
      if (!isFinite(min)) { min = 0; max = 100; }
      const scaleRange = resolvePriceScaleRange(id, min, max);
      return { id, top, h, min: scaleRange.min, max: scaleRange.max };
    });

    const seriesRanges = seriesList.map((s) =>
      s.separateScale ? computePriceRange(s, firstBar, lastBar) : null
    );

    return { firstBar, lastBar, paneStates, seriesRanges };
  }

  /** Look up the PaneRenderState for a given pane id (falls back to first pane). */
  function getPaneState(rs: RenderState, id: PaneId): PaneRenderState {
    return rs.paneStates.find((p) => p.id === id) ?? rs.paneStates[0];
  }

  // ── render ────────────────────────────────────────────────────────────────

  function drawBackground(): void {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(rs: RenderState): void {
    const w = cw();
    const totalH = ch();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([]);

    // Horizontal grid lines — per pane
    for (const pane of rs.paneStates) {
      const ticks = gridPriceTicks(pane, 6);
      for (const p of ticks) {
        const y = snapCssPixel(p2y(p, pane));
        if (y >= pane.top && y <= pane.top + pane.h) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
      }
    }

    // Vertical grid lines — span full chart area
    let interval = 86400;
    if (timeIndex.length >= 2) interval = timeIndex.interval();
    const tickBars = resolveTimeTickBars(
      rs.firstBar,
      rs.lastBar,
      interval,
      barWidth,
      60,
      (i) => timeIndex.at(i) ?? null,
    );
    for (const i of tickBars) {
      const x = snapCssPixel(barToX(i));
      if (x >= 0 && x <= w) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, totalH); ctx.stroke();
      }
    }
  }

  function drawAxesBorder(rs: RenderState): void {
    const w = cw();
    const h = ch();
    ctx.strokeStyle = axisBorderColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    // Right border (price axis left edge)
    ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w, height); ctx.stroke();
    // Bottom border (time axis top edge)
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(width, h); ctx.stroke();
    // Pane dividers — drawn in the gap between adjacent panes.
    for (const pane of rs.paneStates) {
      if (pane.top === 0) continue; // no divider above the first pane
      // The gap starts at (previous pane bottom) = pane.top - PANE_DIVIDER_H.
      // Draw a line through the vertical centre of the gap.
      const divY = snapCssPixel(pane.top - Math.round(PANE_DIVIDER_H / 2));
      ctx.beginPath(); ctx.moveTo(0, divY); ctx.lineTo(w + priceAxisWidth, divY); ctx.stroke();
    }
  }

  function drawTimeAxis(rs: RenderState): void {
    const w = cw();
    const h = ch();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, h, w, TIME_AXIS_H);

    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let interval = 86400;
    if (timeIndex.length >= 2) {
      interval = timeIndex.interval();
    }

    // ── Forced tick mode (e.g. 1D NSE 30-min IST boundaries) ──────────
    if (forcedTimeTicks && forcedTimeTicks.length > 0 && timeIndex.length > 0) {
      const firstT = timeIndex.at(rs.firstBar);
      const lastT = timeIndex.at(rs.lastBar);
      const rangeSec = firstT != null && lastT != null ? Math.max(0, lastT - firstT) : interval;

      for (const targetSec of forcedTimeTicks) {
        // Find the bar whose timestamp is nearest to this target second
        let bestBar = -1;
        let bestDist = Infinity;
        for (let i = rs.firstBar; i <= rs.lastBar; i++) {
          const t = timeIndex.at(i);
          if (t == null) continue;
          const dist = Math.abs((t as number) - targetSec);
          if (dist < bestDist) { bestDist = dist; bestBar = i; }
        }
        if (bestBar < 0) continue;

        const x = barToX(bestBar);
        if (x < 10 || x > w - 10) continue;
        const t = timeIndex.at(bestBar);
        if (t == null) continue;
        // Use the TARGET timestamp for the label (not the nearest bar's timestamp)
        // so labels always read exactly 09:30, 10:00, etc.
        ctx.fillText(fmtTime(targetSec as UTCTimestamp, interval, rangeSec), x, h + TIME_AXIS_H / 2);
      }
      return;
    }

    // ── Default automatic tick mode ────────────────────────────────────
    const tickBars = resolveTimeTickBars(
      rs.firstBar,
      rs.lastBar,
      interval,
      barWidth,
      70,
      (i) => timeIndex.at(i) ?? null,
    );
    const firstT = timeIndex.at(rs.firstBar);
    const lastT = timeIndex.at(rs.lastBar);
    const rangeSec = firstT != null && lastT != null ? Math.max(0, lastT - firstT) : interval;
    let prevTickT: UTCTimestamp | undefined;
    for (const i of tickBars) {
      const x = barToX(i);
      if (x < 10 || x > w - 10) continue;
      const t = timeIndex.at(i);
      if (t == null) continue;
      ctx.fillText(resolvedTimeFormatter(t, interval, rangeSec, prevTickT), x, h + TIME_AXIS_H / 2);
      prevTickT = t;
    }
  }

  function drawPriceAxis(rs: RenderState): void {
    const w = cw();
    ctx.fillStyle = bgColor;
    ctx.fillRect(w, 0, priceAxisWidth, height);

    const hideParityPriceTicks = parityEnabled
      && width <= PARITY_COMPACT_PRICE_AXIS_MAX_VIEWPORT_WIDTH;
    if (hideParityPriceTicks) return;

    ctx.fillStyle = textColor;
    ctx.font = `500 ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const pane of rs.paneStates) {
      const ticks = gridPriceTicks(pane, 6);
      for (const p of ticks) {
        const y = snapCssPixel(p2y(p, pane));
        if (y >= pane.top && y <= pane.top + pane.h) {
          ctx.fillText(resolvedPriceFormatter(p), w + 6, y);
        }
      }
    }
  }

  function findLastSeriesRow<T extends TimedRow>(s: SeriesState): { row: T; index: number } | null {
    const upper = Math.min(timeIndex.length - 1, s.store.length - 1);
    for (let i = upper; i >= 0; i -= 1) {
      const row = s.store.getAt(i) as T | null;
      if (row) return { row, index: i };
    }
    return null;
  }

  function findLastSeriesRowWhere<T extends TimedRow>(
    s: SeriesState,
    predicate: (row: T, index: number) => boolean,
  ): { row: T; index: number } | null {
    const upper = Math.min(timeIndex.length - 1, s.store.length - 1);
    for (let i = upper; i >= 0; i -= 1) {
      const row = s.store.getAt(i) as T | null;
      if (!row) continue;
      if (predicate(row, i)) return { row, index: i };
    }
    return null;
  }

  function getPrimaryParityPriceSeries(): SeriesState | null {
    for (const s of seriesList) {
      if (s.opts.visible === false) continue;
      if (s.indicatorInstanceId) continue;
      if (s.paneId !== MAIN_PANE_ID) continue;
      if (s.type === 'Candlestick' || s.type === 'Bar') return s;
    }
    return null;
  }

  function getPrimaryParityVolumeSeries(): SeriesState | null {
    for (const s of seriesList) {
      if (s.opts.visible === false) continue;
      if (s.indicatorInstanceId) continue;
      if (s.paneId !== MAIN_PANE_ID) continue;
      if (s.type === 'Histogram' && s.separateScale) return s;
    }
    return null;
  }

  function drawParityLastValueMarkers(rs: RenderState): void {
    if (!showParityLastPriceLine && !showParityLastValueLabels) return;

    const w = cw();
    const paneBottom = ch();
    const labelH = 18;

    const drawAxisTag = (y: number, label: string, color: string): void => {
      const safeY = Math.max(labelH / 2 + 2, Math.min(paneBottom - labelH / 2 - 2, y));
      ctx.font = `${fontSize}px ${fontFamily}`;
      const boxW = Math.max(38, Math.ceil(ctx.measureText(label).width + 10));
      const boxX = width - boxW - 1;
      const boxY = Math.round(safeY - labelH / 2);

      ctx.fillStyle = color;
      ctx.fillRect(boxX, boxY, boxW, labelH);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, boxX + boxW / 2, boxY + labelH / 2);
    };

    const volumeSeries = getPrimaryParityVolumeSeries();
    const latestNonZeroVolume = volumeSeries
      ? findLastSeriesRowWhere<HistogramData>(volumeSeries, (row) => Math.abs(row.value) > 1e-6)
      : null;

    const priceSeries = getPrimaryParityPriceSeries();
    if (priceSeries) {
      const preferredPriceIndex = latestNonZeroVolume?.index;
      let latestPrice: { row: CandlestickData; index: number } | null = null;
      if (preferredPriceIndex != null) {
        const preferred = priceSeries.store.getAt(preferredPriceIndex) as CandlestickData | null;
        if (preferred) {
          latestPrice = { row: preferred, index: preferredPriceIndex };
        }
      }
      if (!latestPrice) {
        latestPrice = findLastSeriesRow<CandlestickData>(priceSeries);
      }

      if (latestPrice) {
        const pane = getPaneState(rs, priceSeries.paneId);
        const lastClose = latestPrice.row.close;
        const upColor = priceSeries.opts.upColor ?? '#00c2b8';
        const downColor = priceSeries.opts.downColor ?? '#ff4d4f';
        let markerColor = downColor;
        let comparisonPrice = latestPrice.row.open;
        for (let i = latestPrice.index - 1; i >= 0; i -= 1) {
          const prev = priceSeries.store.getAt(i) as CandlestickData | null;
          if (!prev) continue;
          comparisonPrice = prev.close;
          break;
        }
        if (lastClose > comparisonPrice) markerColor = upColor;
        const markerY = snapCssPixel(p2y(lastClose, pane));

        if (showParityLastPriceLine) {
          ctx.save();
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([1, 2]);
          ctx.beginPath();
          ctx.moveTo(0, markerY);
          ctx.lineTo(w, markerY);
          ctx.stroke();
          ctx.restore();
        }

        if (showParityLastValueLabels) {
          drawAxisTag(markerY, resolvedPriceFormatter(lastClose), markerColor);
        }
      }
    }

    if (!showParityLastValueLabels) return;

    if (!volumeSeries) return;
    const latestVolume = latestNonZeroVolume ?? findLastSeriesRow<HistogramData>(volumeSeries);
    if (!latestVolume) return;
    const seriesIndex = seriesList.indexOf(volumeSeries);
    if (seriesIndex < 0) return;
    const range = rs.seriesRanges[seriesIndex];
    if (!range) return;
    const pane = getPaneState(rs, volumeSeries.paneId);
    const markerY = snapCssPixel(
      sepPriceToY(
        latestVolume.row.value,
        range.min,
        range.max,
        volumeSeries.scaleMargins,
        pane.top,
        pane.h,
      ),
    );
    const color = latestVolume.row.color
      ?? volumeSeries.opts.color
      ?? (latestVolume.row.value >= 0 ? '#26a69a' : '#ef5350');
    drawAxisTag(markerY, fmtCompactVolume(latestVolume.row.value), color);
  }

  function drawParityWatermark(): void {
    if (!showParityWatermark) return;

    const centerX = 22;
    const centerY = Math.max(18, ch() - 22);
    const radius = 14;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 17, 0.95)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 0.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.93)';
    ctx.font = `bold ${Math.max(10, fontSize)}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TV', centerX, centerY + 0.5);
    ctx.restore();
  }

  function drawParityDebugOverlay(rs: RenderState): void {
    const debug = resolveParityDebugConfig();
    if (!debug.enabled) return;

    ctx.save();
    ctx.setLineDash([]);

    if (debug.showPaneBounds) {
      ctx.strokeStyle = 'rgba(255, 203, 70, 0.9)';
      ctx.lineWidth = 1;
      for (const pane of rs.paneStates) {
        ctx.strokeRect(0.5, pane.top + 0.5, Math.max(1, cw() - 1), Math.max(1, pane.h - 1));
      }

      ctx.strokeStyle = 'rgba(255, 120, 120, 0.85)';
      ctx.beginPath();
      ctx.moveTo(snapCssPixel(cw()), 0);
      ctx.lineTo(snapCssPixel(cw()), height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, snapCssPixel(ch()));
      ctx.lineTo(width, snapCssPixel(ch()));
      ctx.stroke();
    }

    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 230, 170, 0.95)';

    if (debug.showScaleValues) {
      const barCount = rs.lastBar >= rs.firstBar ? rs.lastBar - rs.firstBar + 1 : 0;
      const header = `bars=${barCount} bw=${barWidth.toFixed(3)} right=${rightmostIndex.toFixed(3)} dpr=${canvasDpr.toFixed(3)} seq=${renderSeq}`;
      ctx.fillText(header, 8, 8);
      rs.paneStates.forEach((pane, index) => {
        const line = `pane[${index}] ${pane.id} y=${pane.top.toFixed(1)} h=${pane.h.toFixed(1)} min=${pane.min.toFixed(3)} max=${pane.max.toFixed(3)}`;
        ctx.fillText(line, 8, 24 + index * 14);
      });
    }

    if (debug.showCursor && crosshairX != null && crosshairY != null) {
      const cursorText = `cursor x=${crosshairX.toFixed(1)} y=${crosshairY.toFixed(1)}`;
      ctx.fillText(cursorText, 8, Math.max(8, ch() - 22));
    }

    ctx.restore();
  }

  function drawCandlestick(s: SeriesState, rs: RenderState, pane: PaneRenderState): void {
    const bw = barWidth;
    const bodyW = resolveCandleBodyWidth(bw);
    const bodyHalf = bodyW / 2;
    const { firstBar, lastBar } = rs;
    const w = cw();

    for (let i = firstBar; i <= lastBar; i++) {
      const row = s.store.getAt(i) as CandlestickData | null;
      if (!row) continue;
      const xCenter = snapCssPixel(barToX(i));
      if (xCenter < -bw || xCenter > w + bw) continue;

      const isUp = row.close >= row.open;
      const wickColor = isUp
        ? (s.opts.wickUpColor ?? s.opts.upColor ?? '#17c964')
        : (s.opts.wickDownColor ?? s.opts.downColor ?? '#ff4d4f');
      const bodyColor = isUp
        ? (s.opts.upColor ?? '#17c964')
        : (s.opts.downColor ?? '#ff4d4f');

      const openY = Math.round(p2y(row.open, pane));
      const closeY = Math.round(p2y(row.close, pane));
      const highY = snapCssPixel(p2y(row.high, pane));
      const lowY = snapCssPixel(p2y(row.low, pane));

      // Wick
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(xCenter, highY);
      ctx.lineTo(xCenter, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyH = Math.max(1, Math.abs(closeY - openY));
      const bodyLeft = Math.round(xCenter - bodyHalf);
      ctx.fillStyle = bodyColor;
      ctx.fillRect(bodyLeft, bodyTop, bodyW, bodyH);
    }
  }

  function drawBar(s: SeriesState, rs: RenderState, pane: PaneRenderState): void {
    const bw = barWidth;
    const w = cw();
    const { firstBar, lastBar } = rs;

    for (let i = firstBar; i <= lastBar; i++) {
      const row = s.store.getAt(i) as CandlestickData | null;
      if (!row) continue;
      const x = snapCssPixel(barToX(i));
      if (x < -bw || x > w + bw) continue;

      const isUp = row.close >= row.open;
      const col = isUp ? (s.opts.upColor ?? '#17c964') : (s.opts.downColor ?? '#ff4d4f');
      const thin = s.opts.thinBars === true;
      const tick = Math.max(2, bw * (thin ? 0.3 : 0.4));

      ctx.strokeStyle = col;
      ctx.lineWidth = thin ? 1 : 1.5;
      ctx.setLineDash([]);

      const highY  = p2y(row.high,  pane);
      const lowY   = p2y(row.low,   pane);
      const openY  = p2y(row.open,  pane);
      const closeY = p2y(row.close, pane);

      ctx.beginPath(); ctx.moveTo(x, highY); ctx.lineTo(x, lowY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - tick, openY); ctx.lineTo(x, openY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, closeY); ctx.lineTo(x + tick, closeY); ctx.stroke();
    }
  }

  function drawHistogram(s: SeriesState, rs: RenderState, pane: PaneRenderState): void {
    const bw = barWidth;
    const hw = Math.max(0.5, bw * 0.4);
    const w = cw();
    const { firstBar, lastBar } = rs;
    const sIdx = seriesList.indexOf(s);

    const baseVal = s.opts.base ?? 0;
    let baseY: number;
    if (s.separateScale) {
      const range = rs.seriesRanges[sIdx];
      if (!range) return;
      baseY = sepPriceToY(baseVal, range.min, range.max, s.scaleMargins, pane.top, pane.h);
    } else {
      baseY = p2y(baseVal, pane);
    }

    for (let i = firstBar; i <= lastBar; i++) {
      const row = s.store.getAt(i) as HistogramData | null;
      if (!row) continue;
      const x = barToX(i);
      if (x < -bw || x > w + bw) continue;

      let valY: number;
      if (s.separateScale) {
        const range = rs.seriesRanges[sIdx];
        if (!range) continue;
        valY = sepPriceToY(row.value, range.min, range.max, s.scaleMargins, pane.top, pane.h);
      } else {
        valY = p2y(row.value, pane);
      }

      const top = Math.min(valY, baseY);
      const barH = Math.max(1, Math.abs(valY - baseY));
      ctx.fillStyle = row.color ?? s.opts.color ?? 'rgba(0,209,255,0.5)';
      ctx.fillRect(x - hw, top, hw * 2, barH);
    }
  }

  function drawLine(s: SeriesState, rs: RenderState, pane: PaneRenderState): void {
    const { firstBar, lastBar } = rs;
    ctx.strokeStyle = s.opts.color ?? '#00d1ff';
    ctx.lineWidth = s.opts.lineWidth ?? 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    let started = false;
    for (let i = firstBar; i <= lastBar; i++) {
      const row = s.store.getAt(i) as LineData | null;
      if (!row) continue;
      const x = snapCssPixel(barToX(i));
      const y = p2y(row.value, pane);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    if (started) ctx.stroke();
  }

  function drawArea(s: SeriesState, rs: RenderState, pane: PaneRenderState): void {
    const { firstBar, lastBar } = rs;
    const lineColor = s.opts.lineColor ?? s.opts.color ?? '#00d1ff';
    const topColor = s.opts.topColor ?? 'rgba(0,209,255,0.42)';
    const bottomColor = s.opts.bottomColor ?? 'rgba(0,209,255,0.02)';
    const paneBottom = pane.top + pane.h;

    // Fill
    ctx.beginPath();
    let started = false;
    let firstX = 0;
    let lastX = 0;
    for (let i = firstBar; i <= lastBar; i++) {
      const row = s.store.getAt(i) as LineData | null;
      if (!row) continue;
      const x = snapCssPixel(barToX(i));
      const y = p2y(row.value, pane);
      if (!started) { ctx.moveTo(x, y); firstX = x; started = true; }
      else ctx.lineTo(x, y);
      lastX = x;
    }
    if (started) {
      ctx.lineTo(lastX, paneBottom);
      ctx.lineTo(firstX, paneBottom);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, pane.top, 0, paneBottom);
      g.addColorStop(0, topColor);
      g.addColorStop(1, bottomColor);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // Line
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = s.opts.lineWidth ?? 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    started = false;
    for (let i = firstBar; i <= lastBar; i++) {
      const row = s.store.getAt(i) as LineData | null;
      if (!row) continue;
      const x = barToX(i);
      const y = p2y(row.value, pane);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    if (started) ctx.stroke();
  }

  function drawBaseline(s: SeriesState, rs: RenderState, pane: PaneRenderState): void {
    const { firstBar, lastBar } = rs;
    const basePrice = s.opts.baseValue?.price ?? 0;
    const baseY = p2y(basePrice, pane);
    const topFill1 = s.opts.topFillColor1 ?? 'rgba(23,201,100,0.35)';
    const topFill2 = s.opts.topFillColor2 ?? 'rgba(23,201,100,0.04)';
    const botFill1 = s.opts.bottomFillColor1 ?? 'rgba(255,77,79,0.25)';
    const botFill2 = s.opts.bottomFillColor2 ?? 'rgba(255,77,79,0.03)';
    const topLineColor = s.opts.topLineColor ?? '#17c964';
    const paneBottom = pane.top + pane.h;

    // Top fill (values above base → visually above baseY)
    ctx.beginPath();
    let started = false;
    let firstX = 0;
    let lastX = 0;
    for (let i = firstBar; i <= lastBar; i++) {
      const row = s.store.getAt(i) as LineData | null;
      if (!row) continue;
      const x = barToX(i);
      const rawY = p2y(row.value, pane);
      const y = Math.min(rawY, baseY); // clip to above base
      if (!started) { ctx.moveTo(x, baseY); ctx.lineTo(x, y); firstX = x; started = true; }
      else ctx.lineTo(x, y);
      lastX = x;
    }
    if (started) {
      ctx.lineTo(lastX, baseY);
      ctx.lineTo(firstX, baseY);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, pane.top, 0, baseY);
      g.addColorStop(0, topFill1);
      g.addColorStop(1, topFill2);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // Bottom fill (values below base → visually below baseY)
    ctx.beginPath();
    started = false;
    firstX = 0; lastX = 0;
    for (let i = firstBar; i <= lastBar; i++) {
      const row = s.store.getAt(i) as LineData | null;
      if (!row) continue;
      const x = barToX(i);
      const rawY = p2y(row.value, pane);
      const y = Math.max(rawY, baseY); // clip to below base
      if (!started) { ctx.moveTo(x, baseY); ctx.lineTo(x, y); firstX = x; started = true; }
      else ctx.lineTo(x, y);
      lastX = x;
    }
    if (started) {
      ctx.lineTo(lastX, baseY);
      ctx.lineTo(firstX, baseY);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, baseY, 0, paneBottom);
      g.addColorStop(0, botFill1);
      g.addColorStop(1, botFill2);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // Line
    ctx.strokeStyle = topLineColor;
    ctx.lineWidth = s.opts.lineWidth ?? 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    started = false;
    for (let i = firstBar; i <= lastBar; i++) {
      const row = s.store.getAt(i) as LineData | null;
      if (!row) continue;
      const x = barToX(i);
      const y = p2y(row.value, pane);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    if (started) ctx.stroke();
  }

  function drawSeries(s: SeriesState, rs: RenderState, pane: PaneRenderState): void {
    if (s.opts.visible === false || s.store.length === 0) return;
    switch (s.type) {
      case 'Candlestick': drawCandlestick(s, rs, pane); break;
      case 'Bar':         drawBar(s, rs, pane); break;
      case 'Histogram':   drawHistogram(s, rs, pane); break;
      case 'Line':        drawLine(s, rs, pane); break;
      case 'Area':        drawArea(s, rs, pane); break;
      case 'Baseline':    drawBaseline(s, rs, pane); break;
    }
  }

  function drawCrosshair(rs: RenderState): void {
    canvas.dataset.crosshairPrice = '';
    canvas.dataset.crosshairTime = '';
    if (crosshairX == null || crosshairY == null) return;
    const w = cw();
    const totalH = ch();

    // Determine which pane the cursor is currently over.
    let activePane: PaneRenderState | null = null;
    for (const pane of rs.paneStates) {
      if (crosshairY >= pane.top && crosshairY < pane.top + pane.h) {
        activePane = pane;
        break;
      }
    }

    const snappedCrosshairX = snapCssPixel(crosshairX);
    const snappedCrosshairY = snapCssPixel(crosshairY);
    if (crosshairX < 0 || crosshairX > w) return;
    // If cursor is in the time axis strip or below, skip horizontal line.
    if (!activePane && crosshairY >= totalH) return;

    ctx.setLineDash([4, 4]);

    // Vertical line — spans entire chart area across all panes.
    ctx.strokeStyle = crosshairVColor;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(snappedCrosshairX, 0); ctx.lineTo(snappedCrosshairX, totalH); ctx.stroke();

    // Horizontal line — only within the active pane.
    if (activePane) {
      ctx.strokeStyle = crosshairHColor;
      ctx.beginPath(); ctx.moveTo(0, snappedCrosshairY); ctx.lineTo(w, snappedCrosshairY); ctx.stroke();

      ctx.setLineDash([]);

      // Price label on the right axis.
      const price = y2p(snappedCrosshairY, activePane);
      const pLabel = resolvedPriceFormatter(price);
      canvas.dataset.crosshairPrice = pLabel;
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'middle';
      const labelH = 16;
      ctx.fillStyle = crosshairHColor;
      ctx.fillRect(w + 2, snappedCrosshairY - labelH / 2, priceAxisWidth - 4, labelH);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(pLabel, w + 6, snappedCrosshairY);
    }

    ctx.setLineDash([]);

    // Time label at the bottom.
    const barIdx = Math.round(xToBar(crosshairX));
    if (barIdx >= 0 && barIdx < timeIndex.length) {
      const interval = timeIndex.interval();
      const t = timeIndex.at(barIdx);
      if (t != null) {
        const tLabel = fmtTime(t, interval);
        canvas.dataset.crosshairTime = tLabel;
        ctx.textAlign = 'center';
        const labelH = 16;
        const tlW = Math.max(50, ctx.measureText(tLabel).width + 12);
        ctx.fillStyle = crosshairVColor;
        ctx.fillRect(snappedCrosshairX - tlW / 2, totalH + 2, tlW, labelH);
        ctx.fillStyle = '#fff';
        ctx.fillText(tLabel, snappedCrosshairX, totalH + 2 + labelH / 2);
      }
    }
  }

  const renderLayers: RenderLayer[] = [
    {
      id: 'chart',
      order: 10,
      render: (rs) => {
        drawBackground();
        drawGrid(rs);

        // Draw all chart-series per pane and clip each pane once.
        for (const pane of rs.paneStates) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, pane.top, cw(), pane.h);
          ctx.clip();

          // 1. 'background' primitives — drawn before series
          drawPrimitivesForPane(pane, rs, 'background');

          // 2. Series themselves
          for (const s of seriesList) {
            if (s.paneId === pane.id) drawSeries(s, rs, pane);
          }

          // 3. Price lines (after series, before crosshair)
          for (const s of seriesList) {
            if (s.paneId === pane.id) drawPriceLinesForSeries(s, rs, pane);
          }

          // 4. Bar markers
          for (const s of seriesList) {
            if (s.paneId === pane.id) drawMarkersForSeries(s, rs, pane);
          }

          // 5. 'normal' primitives — after series
          drawPrimitivesForPane(pane, rs, 'normal');

          ctx.restore();
        }
      },
    },
    {
      id: 'interaction',
      order: 20,
      render: (rs) => {
        // Interaction layer is isolated so crosshair never mutates chart geometry.
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, cw(), ch());
        ctx.clip();
        drawCrosshair(rs);
        ctx.restore();
      },
    },
    {
      id: 'demo-cursor',
      order: 25,
      render: (_rs) => {
        // Demo cursor strokes fade over time — render every frame while active
        drawDemoCursor();
      },
    },
    {
      id: 'ui',
      order: 30,
      render: (rs) => {
        drawAxesBorder(rs);
        drawTimeAxis(rs);
        drawPriceAxis(rs);
        if (parityEnabled) {
          drawParityLastValueMarkers(rs);
          drawParityWatermark();
        }
        drawParityDebugOverlay(rs);

        // 'top' primitives — above crosshair and axes
        for (const pane of rs.paneStates) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, pane.top, cw(), pane.h);
          ctx.clip();
          drawPrimitivesForPane(pane, rs, 'top');
          ctx.restore();
        }
      },
    },
  ];

  const orderedRenderLayers = renderLayers.slice().sort((left, right) => left.order - right.order);

  function queueRenderMicrotask(callback: () => void): void {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(callback);
      return;
    }
    void Promise.resolve().then(callback);
  }

  function scheduleRender(reason = 'state-change'): void {
    renderQueued = true;
    renderReasons.add(reason);
    if (renderMicrotaskQueued) return;

    renderMicrotaskQueued = true;
    queueRenderMicrotask(() => {
      renderMicrotaskQueued = false;
      if (!renderQueued || rafId != null) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;
        const invalidationReasons = Array.from(renderReasons);
        renderReasons.clear();
        renderQueued = false;
        render(invalidationReasons);
      });
    });
  }

  function render(_invalidationReasons: string[] = []): void {
    if (destroyed) return;
    const renderStart = performance.now();
    const dpr = resolveDevicePixelRatio();
    if (Math.abs(dpr - canvasDpr) > 0.001) {
      resizeCanvas(dpr, 'render-dpr-change');
    }

    ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const rs = computeRenderState();
    const barCount = rs.lastBar >= rs.firstBar ? rs.lastBar - rs.firstBar + 1 : 0;
    renderSeq += 1;

    canvas.dataset.priceScale = rs.paneStates.length > 0
      ? `${rs.paneStates[0].min.toFixed(2)}:${rs.paneStates[0].max.toFixed(2)}`
      : '';
    canvas.dataset.paneLayout = rs.paneStates
      .map((pane) => `${pane.id}:${pane.top.toFixed(2)}:${pane.h.toFixed(2)}`)
      .join('|');
    canvas.dataset.barWindow = `${rs.firstBar}:${rs.lastBar}`;
    canvas.dataset.barCount = String(Math.max(0, barCount));
    canvas.dataset.totalBars = String(Math.max(0, timeIndex.length));
    canvas.dataset.timeIndexLength = String(Math.max(0, timeIndex.length));
    canvas.dataset.barWidth = barWidth.toFixed(4);
    canvas.dataset.rightmostIndex = rightmostIndex.toFixed(4);
    canvas.dataset.renderSeq = String(renderSeq);
    canvas.dataset.renderAt = String(Date.now());
    canvas.dataset.devicePixelRatio = canvasDpr.toFixed(4);

    if (indicatorInstances.size > 0 && indicatorVisibleRangeOnly && timeIndex.length > 0) {
      // Trigger recompute only when the visible range goes OUTSIDE the already-computed
      // window, not every time the centered-window boundaries shift.  This gives true
      // hysteresis: while the user pans/zooms within the ±padding band no extra compute
      // fires; only when we reach the edge of the buffer do we recompute.
      const needsRecompute = indicatorComputeWindow === null || (() => {
        const vis = getVisibleBarWindow();
        return vis.first < indicatorComputeWindow!.start || vis.last > indicatorComputeWindow!.end;
      })();
      if (needsRecompute) {
        scheduleIndicatorRecompute();
      }
    }

    for (const layer of orderedRenderLayers) {
      layer.render(rs);
    }

    const renderDurationMs = performance.now() - renderStart;
    debugHooks?.onRenderEnd?.({
      durationMs: renderDurationMs,
      barCount,
      indicatorCount: indicatorInstances.size,
    });
    perf?.record('render', renderDurationMs);

    notifyVisibleRangeChange();
  }

  // ── interaction ──────────────────────────────────────────────────────────

  const crosshairListeners = new Set<(param: CrosshairMoveEvent) => void>();
  let dragStart: { clientX: number; rightAtStart: number } | null = null;
  let wheelAccumDelta = 0;
  let wheelAnchorX: number | null = null;
  let wheelRafId: number | null = null;
  let paneResizeDrag: { dividerIndex: number; startY: number; startPanes: PaneDef[] } | null = null;
  let priceAxisDrag: {
    paneId: PaneId;
    startY: number;
    startMin: number;
    startMax: number;
  } | null = null;

  function getPaneAtY(rs: RenderState, y: number): PaneRenderState | null {
    return rs.paneStates.find((pane) => y >= pane.top && y < pane.top + pane.h) ?? null;
  }

  function emitCrosshairMove(source: CrosshairMoveEvent['source']): void {
    if (!crosshairListeners.size) return;

    const rs = computeRenderState();
    const activePane = crosshairY == null ? null : getPaneAtY(rs, crosshairY);
    const x = crosshairX == null ? null : snapCssPixel(crosshairX);
    const y = crosshairY == null ? null : snapCssPixel(crosshairY);

    const payload: CrosshairMoveEvent = {
      point: x == null || y == null ? null : { x, y },
      time: x == null ? null : timeScaleApi.coordinateToTime(x),
      price: activePane && y != null ? y2p(y, activePane) : null,
      paneId: activePane?.id ?? null,
      source,
    };

    for (const handler of crosshairListeners) {
      try {
        handler(payload);
      } catch {
        // Listener failures must not break chart interaction.
      }
    }
  }

  function updatePriceAxisDrag(y: number): void {
    if (!priceAxisDrag) return;
    const rs = computeRenderState();
    const pane = rs.paneStates.find((item) => item.id === priceAxisDrag?.paneId);
    if (!pane) return;

    const startRange = priceAxisDrag.startMax - priceAxisDrag.startMin || 1;
    const zoomFactor = Math.exp((y - priceAxisDrag.startY) * 0.01);
    const nextRange = Math.min(Math.max(startRange * zoomFactor, Math.max(Math.abs(priceAxisDrag.startMin), Math.abs(priceAxisDrag.startMax), 1) * 0.0001), startRange * 100);
    const anchorPrice = y2p(priceAxisDrag.startY, pane);
    const anchorRatio = (anchorPrice - priceAxisDrag.startMin) / startRange;
    const nextMin = anchorPrice - anchorRatio * nextRange;
    const nextMax = nextMin + nextRange;
    setPanePriceScaleManual(priceAxisDrag.paneId, nextMin, nextMax);
    scheduleRender();
  }

  function resetPriceAxisScale(y: number): void {
    const rs = computeRenderState();
    const pane = getPaneAtY(rs, y);
    if (!pane) return;
    setPanePriceScaleAuto(pane.id);
    scheduleRender();
  }

  function onWheel(e: WheelEvent): void {
    // If the consumer disabled BOTH wheel zoom AND wheel scroll, the chart must
    // be completely passive — do not preventDefault so the page can scroll.
    if (!allowWheelZoom && !allowWheelScroll) {
      return;
    }
    e.preventDefault();

    const deltaScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1;
    wheelAccumDelta += e.deltaY * deltaScale;
    wheelAnchorX = e.offsetX;

    if (wheelRafId != null) return;
    wheelRafId = requestAnimationFrame(() => {
      wheelRafId = null;

      const delta = wheelAccumDelta;
      const anchorX = wheelAnchorX ?? cw() / 2;
      wheelAccumDelta = 0;
      wheelAnchorX = null;

      if (Math.abs(delta) < 0.5) return;

      const zoomFactor = Math.exp(-delta * 0.0015);
      const nextBarWidth = Math.max(MIN_BAR_WIDTH, Math.min(maxBarWidthForViewport(), barWidth * zoomFactor));
      if (Math.abs(nextBarWidth - barWidth) < 0.001) return;

      const anchorBar = xToBar(anchorX);
      barWidth = nextBarWidth;
      // Keep the logical bar under the cursor anchored while zooming.
      rightmostIndex = clampRightmostIndex(anchorBar + 0.5 - (cw() - anchorX) / barWidth);
      scheduleRender();
    });
  }

  function onPointerDown(e: PointerEvent): void {
    // Stop any in-progress kinetic scroll
    if (kineticRafId != null) {
      cancelAnimationFrame(kineticRafId);
      kineticRafId = null;
    }
    kineticVelocity = 0;
    kineticLastClientX = e.clientX;
    kineticLastTs = Date.now();

    // ── Demo cursor: Alt+click (or "Demonstration" cursor mode) starts a freehand drawing stroke ──
    if ((e.altKey || demoCursorForceMode) && e.offsetX < cw()) {
      e.preventDefault();
      demoCursorActive = true;
      const stroke: DemoStroke = {
        points: [{ x: e.offsetX, y: e.offsetY }],
        startTime: performance.now(),
        endTime: null,
        color: demoCursorColor,
        lineWidth: demoCursorLineWidth,
        fadeDuration: demoCursorFadeDuration,
      };
      demoStrokes.push(stroke);
      canvas.setPointerCapture(e.pointerId);
      scheduleRender('demo-cursor');
      return;
    }

    const rs = computeRenderState();
    if (e.offsetX >= cw()) {
      const activePane = getPaneAtY(rs, e.offsetY);
      if (activePane) {
        priceAxisDrag = {
          paneId: activePane.id,
          startY: e.offsetY,
          startMin: activePane.min,
          startMax: activePane.max,
        };
        dragStart = null;
        paneResizeDrag = null;
        canvas.setPointerCapture(e.pointerId);
        scheduleRender();
        return;
      }
    }
    for (let i = 0; i < rs.paneStates.length - 1; i += 1) {
      const dividerTop = rs.paneStates[i].top + rs.paneStates[i].h;
      if (e.offsetY >= dividerTop && e.offsetY <= dividerTop + PANE_DIVIDER_H) {
        paneResizeDrag = { dividerIndex: i, startY: e.offsetY, startPanes: panes.map((pane) => ({ ...pane })) };
        canvas.setPointerCapture(e.pointerId);
        scheduleRender();
        return;
      }
    }

    dragStart = { clientX: e.clientX, rightAtStart: rightmostIndex };
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    // ── Demo cursor: append point to current stroke ──
    if (demoCursorActive && demoStrokes.length > 0) {
      const stroke = demoStrokes[demoStrokes.length - 1];
      if (stroke.endTime === null) {
        stroke.points.push({ x: e.offsetX, y: e.offsetY });
        scheduleRender('demo-cursor');
        return;
      }
    }

    if (priceAxisDrag != null) {
      updatePriceAxisDrag(e.offsetY);
      return;
    }

    if (paneResizeDrag != null) {
      const deltaY = e.offsetY - paneResizeDrag.startY;
      const resized = resizePaneHeights(paneResizeDrag.startPanes, ch(), paneResizeDrag.dividerIndex, deltaY, 48);
      panes.splice(0, panes.length, ...resized);
      scheduleRender();
      return;
    }

    crosshairX = e.offsetX;
    crosshairY = e.offsetY;
    emitCrosshairMove('local-pointer');
    if (dragStart != null && (mode === 'pan' || mode === 'scroll' || mode === 'idle')) {
      if (!allowPressedMouseMove) {
        dragStart = null;
      } else {
        const now = Date.now();
        const dt = now - kineticLastTs;
        if (dt > 0) {
          const rawVel = (e.clientX - kineticLastClientX) / dt; // px/ms
          // EMA smoothing to reduce noise
          kineticVelocity = kineticVelocity * 0.6 + rawVel * 0.4;
        }
        kineticLastClientX = e.clientX;
        kineticLastTs = now;
        const dx = e.clientX - dragStart.clientX;
        rightmostIndex = clampRightmostIndex(dragStart.rightAtStart - dx / barWidth);
      }
    }
    scheduleRender();
  }

  function onPointerUp(e: PointerEvent): void {
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);

    // ── Demo cursor: end the current stroke and start fade-out ──
    if (demoCursorActive) {
      demoCursorActive = false;
      if (demoStrokes.length > 0) {
        const stroke = demoStrokes[demoStrokes.length - 1];
        if (stroke.endTime === null) {
          stroke.endTime = performance.now();
        }
      }
      // Start fade RAF loop if not already running
      if (demoCursorRafId == null && demoStrokes.length > 0) {
        demoCursorRafId = requestAnimationFrame(demoCursorFadeLoop);
      }
      return;
    }

    priceAxisDrag = null;
    paneResizeDrag = null;

    // Start kinetic scroll if the user was panning with significant velocity
    if (dragStart != null && Math.abs(kineticVelocity) > 0.05) {
      const capturedBarWidth = barWidth;
      // Convert velocity (px/ms) → bars per frame (assuming ~16ms frames)
      let decay = (kineticVelocity * 16) / capturedBarWidth;

      function kineticStep(): void {
        decay *= 0.92; // dampen per frame (~60fps gives ~10 frames to stop)
        if (Math.abs(decay) < 0.005) {
          kineticRafId = null;
          return;
        }
        rightmostIndex = clampRightmostIndex(rightmostIndex - decay);
        scheduleRender();
        kineticRafId = requestAnimationFrame(kineticStep);
      }

      if (kineticRafId != null) cancelAnimationFrame(kineticRafId);
      kineticRafId = requestAnimationFrame(kineticStep);
    }

    kineticVelocity = 0;
    dragStart = null;
  }

  function onDoubleClick(e: MouseEvent): void {
    if (e.offsetX < cw()) {
      // Emit double-click event
      if (dblClickListeners.size) {
        const rs = computeRenderState();
        const activePane = getPaneAtY(rs, e.offsetY);
        const x = e.offsetX;
        const y = e.offsetY;
        const payload: CrosshairMoveEvent = {
          point: { x, y },
          time: timeScaleApi.coordinateToTime(x),
          price: activePane ? y2p(y, activePane) : null,
          paneId: activePane?.id ?? null,
          source: 'local-pointer',
        };
        for (const fn of dblClickListeners) { try { fn(payload); } catch { /* */ } }
      }
      return;
    }
    resetPriceAxisScale(e.offsetY);
  }

  function onCanvasClick(e: MouseEvent): void {
    if (!clickListeners.size) return;
    const rs = computeRenderState();
    const activePane = getPaneAtY(rs, e.offsetY);
    const x = e.offsetX;
    const y = e.offsetY;
    const payload: CrosshairMoveEvent = {
      point: { x, y },
      time: timeScaleApi.coordinateToTime(x),
      price: activePane ? y2p(y, activePane) : null,
      paneId: activePane?.id ?? null,
      source: 'local-pointer',
    };
    for (const fn of clickListeners) { try { fn(payload); } catch { /* */ } }
  }

  function onPointerLeave(): void {
    // If demo cursor was active, end the stroke and start fade
    if (demoCursorActive) {
      demoCursorActive = false;
      if (demoStrokes.length > 0) {
        const stroke = demoStrokes[demoStrokes.length - 1];
        if (stroke.endTime === null) stroke.endTime = performance.now();
      }
      if (demoCursorRafId == null && demoStrokes.length > 0) {
        demoCursorRafId = requestAnimationFrame(demoCursorFadeLoop);
      }
    }
    crosshairX = null;
    crosshairY = null;
    canvas.dataset.crosshairPrice = '';
    canvas.dataset.crosshairTime = '';
    emitCrosshairMove('leave');
    scheduleRender();
  }

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('dblclick', onDoubleClick);

  // ── Demo cursor: show crosshair cursor style when Alt is held ──
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Alt' || e.altKey) {
      canvas.style.cursor = 'crosshair';
    }
  }
  function onKeyUp(e: KeyboardEvent): void {
    if (e.key === 'Alt') {
      canvas.style.cursor = '';
      // If Alt released mid-stroke, end it
      if (demoCursorActive) {
        demoCursorActive = false;
        if (demoStrokes.length > 0) {
          const stroke = demoStrokes[demoStrokes.length - 1];
          if (stroke.endTime === null) stroke.endTime = performance.now();
        }
        if (demoCursorRafId == null && demoStrokes.length > 0) {
          demoCursorRafId = requestAnimationFrame(demoCursorFadeLoop);
        }
      }
    }
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // ── series factory ────────────────────────────────────────────────────────

  function makeSeries<T extends SeriesType>(sState: SeriesState): ISeriesApi<T> {
    return {
      setData(data: RowOf<T>[]): void {
        sState.store.setData(data as TimedRow[]);
        debugHooks?.onSeriesDataMutation?.({
          kind: 'setData',
          seriesId: sState.id,
          seriesType: sState.type,
          sourceLength: sState.store.rawRows.length,
        });
        rebuildIndex();
        scheduleRender();
      },
      update(row: RowOf<T>): void {
        const t = (row as { time: UTCTimestamp }).time;
        const result = sState.store.update(row as TimedRow);
        let outOfOrderInsert = false;

        if (result === 'appended') {
          // New timestamp: insert into the shared time index.
          const newBarIdx = timeIndex.insertOne(t);
          const newLen = timeIndex.length;

          if (newBarIdx === newLen - 1) {
            // Fast path: timestamp appended at the live edge.
            sState.store.setAt(newBarIdx, row as TimedRow);
            for (const other of seriesList) {
              if (other !== sState) other.store.grow(newLen);
            }
            // Advance viewport to the live edge if the user hasn't scrolled away.
            if (rightmostIndex >= newLen - LIVE_EDGE_THRESHOLD) {
              rightmostIndex = newLen - 1;
            }
          } else {
            // Slow path: out-of-order insert — realign all stores.
            outOfOrderInsert = true;
            for (const s of seriesList) {
              s.store.realign();
            }
          }
        }

        debugHooks?.onSeriesDataMutation?.({
          kind: 'update',
          seriesId: sState.id,
          seriesType: sState.type,
          result,
          outOfOrderInsert,
          sourceLength: sState.store.rawRows.length,
        });

        // Keep indicator outputs in sync with streaming source data.
        if (!sState.indicatorInstanceId && indicatorInstances.size > 0) {
          const src = getSourceOhlcv();
          if (src && src.times.length > 0) {
            recomputeIndicatorsIncremental(src);
          } else {
            scheduleIndicatorRecompute();
          }
        } else if (!sState.indicatorInstanceId) {
          scheduleIndicatorRecompute();
        }

        scheduleRender();
      },
      applyOptions(opts: Partial<SeriesOptions>): void {
        sState.opts = { ...sState.opts, ...opts };
        // Apply price scale mode if provided
        if (opts.priceScaleMode != null) {
          priceScaleModes.set(sState.paneId, opts.priceScaleMode);
        }
        scheduleRender();
      },
      priceScale(): IPriceScaleApi {
        return {
          applyOptions(opts: { scaleMargins?: ScaleMargins; mode?: PriceScaleMode }): void {
            if (opts.scaleMargins) {
              sState.scaleMargins = { ...sState.scaleMargins, ...opts.scaleMargins };
            }
            if (opts.mode != null) {
              priceScaleModes.set(sState.paneId, opts.mode);
            }
            scheduleRender();
          },
        };
      },
      coordinateToPrice(y: number): number | null {
        const rs = computeRenderState();
        const pane = getPaneState(rs, sState.paneId);
        if (sState.separateScale) {
          const range = rs.seriesRanges[seriesList.indexOf(sState)];
          if (!range) return null;
          return sepYToPrice(y, range.min, range.max, sState.scaleMargins, pane.top, pane.h);
        }
        return y2p(y, pane);
      },
      priceToCoordinate(price: number): number | null {
        const rs = computeRenderState();
        const pane = getPaneState(rs, sState.paneId);
        if (sState.separateScale) {
          const range = rs.seriesRanges[seriesList.indexOf(sState)];
          if (!range) return null;
          return sepPriceToY(price, range.min, range.max, sState.scaleMargins, pane.top, pane.h);
        }
        return p2y(price, pane);
      },
      getData(): RowOf<T>[] {
        return sState.store.rawRows.slice() as RowOf<T>[];
      },
      createPriceLine(options: PriceLineOptions): IPriceLine {
        const id = options.id ?? `pl-${++nextPriceLineSeq}`;
        const stored: PriceLineOptions & { id: string } = { ...options, id };
        sState.priceLines.set(id, stored);
        scheduleRender();

        const priceLine: IPriceLine = {
          applyOptions(opts: Partial<PriceLineOptions>): void {
            const existing = sState.priceLines.get(id);
            if (!existing) return;
            sState.priceLines.set(id, { ...existing, ...opts, id });
            scheduleRender();
          },
          options(): PriceLineOptions {
            return { ...(sState.priceLines.get(id) ?? stored) };
          },
          remove(): void {
            sState.priceLines.delete(id);
            scheduleRender();
          },
        };
        return priceLine;
      },
      setMarkers(markers: SeriesMarker[]): void {
        sState.markers = markers.slice();
        scheduleRender();
      },
      attachPrimitive(primitive: ISeriesPrimitive): void {
        if (!sState.primitives.includes(primitive)) {
          sState.primitives.push(primitive);
          primitive.attached?.({
            chart: api,
            requestUpdate: () => scheduleRender('primitive-update'),
          });
        }
        scheduleRender();
      },
      detachPrimitive(primitive: ISeriesPrimitive): void {
        const idx = sState.primitives.indexOf(primitive);
        if (idx >= 0) {
          sState.primitives.splice(idx, 1);
          primitive.detached?.();
          scheduleRender();
        }
      },
    };
  }

  // ── time scale API ────────────────────────────────────────────────────────

  const visibleRangeListeners = new Set<() => void>();

  function notifyVisibleRangeChange(): void {
    if (!visibleRangeListeners.size) return;
    for (const fn of visibleRangeListeners) {
      try { fn(); } catch { /* listener error */ }
    }
  }

  const timeScaleApi: ITimeScaleApi = {
    scrollPosition(): number {
      return (timeIndex.length - 1) - rightmostIndex;
    },
    getVisibleLogicalRange(): LogicalRange | null {
      if (!timeIndex.length) return null;
      return { from: xToBar(0), to: rightmostIndex };
    },
    setVisibleLogicalRange(range: LogicalRange): void {
      const bars = Math.abs(range.to - range.from) + 1;
      if (bars > 0) barWidth = Math.max(MIN_BAR_WIDTH, Math.min(maxBarWidthForViewport(), cw() / bars));
      rightmostIndex = clampRightmostIndex(range.to);
      scheduleRender();
    },
    applyOptions(opts: { rightOffset?: number; [key: string]: unknown }): void {
      if (typeof opts.rightOffset === 'number') {
        rightOffsetBars = Math.max(-MAX_RIGHT_OFFSET_BARS, Math.min(MAX_RIGHT_OFFSET_BARS, opts.rightOffset));
        rightmostIndex = clampRightmostIndex((timeIndex.length - 1) + rightOffsetBars);
        scheduleRender();
      }
    },
    scrollToPosition(pos: number, _animate: boolean): void {
      rightmostIndex = clampRightmostIndex((timeIndex.length - 1) - pos);
      scheduleRender();
    },
    scrollToRealTime(): void {
      rightmostIndex = clampRightmostIndex((timeIndex.length - 1) + rightOffsetBars);
      scheduleRender();
    },
    coordinateToTime(x: number): UTCTimestamp | null {
      if (!timeIndex.length) return null;
      const idx = Math.round(xToBar(x));
      if (idx < 0 || idx >= timeIndex.length) return null;
      return timeIndex.at(idx) ?? null;
    },
    timeToCoordinate(time: UTCTimestamp): number | null {
      if (!timeIndex.length) return null;
      const idx = timeIndex.indexOf(time);
      if (idx < 0) return null;
      return barToX(idx);
    },
    setVisibleRange(range: TimeRange): void {
      const fromIdx = timeIndex.closestIndex(range.from);
      const toIdx = timeIndex.closestIndex(range.to);
      const bars = toIdx - fromIdx + 1;
      if (bars > 0) barWidth = Math.max(MIN_BAR_WIDTH, Math.min(maxBarWidthForViewport(), cw() / bars));
      rightmostIndex = clampRightmostIndex(toIdx);
      scheduleRender();
    },
    subscribeVisibleTimeRangeChange(handler: () => void): void {
      visibleRangeListeners.add(handler);
    },
    unsubscribeVisibleTimeRangeChange(handler: () => void): void {
      visibleRangeListeners.delete(handler);
    },
    fitContent(): void {
      if (!timeIndex.length) return;
      const totalBars = timeIndex.length;
      // Fit all bars into the viewport
      const availableWidth = cw();
      barWidth = Math.max(MIN_BAR_WIDTH, Math.min(maxBarWidthForViewport(), availableWidth / totalBars));
      rightmostIndex = clampRightmostIndex(totalBars - 1);
      scheduleRender();
    },
  };

  // ── chart API ─────────────────────────────────────────────────────────────

  const api: IChartApi = {
    applyOptions(opts: Partial<ChartOptions>): void {
      if (opts.width != null) width = opts.width;
      if (opts.height != null) height = opts.height;
      if (opts.timeScale?.rightOffset != null && Number.isFinite(opts.timeScale.rightOffset)) {
        rightOffsetBars = Math.max(-MAX_RIGHT_OFFSET_BARS, Math.min(MAX_RIGHT_OFFSET_BARS, opts.timeScale.rightOffset));
      }
      if (opts.layout?.background?.color) bgColor = opts.layout.background.color;
      if (opts.layout?.textColor) textColor = opts.layout.textColor;
      if (opts.layout?.fontFamily) fontFamily = opts.layout.fontFamily;
      if (opts.layout?.fontSize != null) fontSize = opts.layout.fontSize;
      if (opts.grid?.vertLines?.color) gridColor = opts.grid.vertLines.color;
      if (opts.crosshair?.vertLine?.color) crosshairVColor = opts.crosshair.vertLine.color;
      if (opts.crosshair?.horzLine?.color) crosshairHColor = opts.crosshair.horzLine.color;
      if (opts.rightPriceScale?.borderColor) axisBorderColor = opts.rightPriceScale.borderColor;
      if ('forcedTimeTicks' in opts) forcedTimeTicks = opts.forcedTimeTicks ?? null;
      if (opts.priceFormatter != null) customPriceFormatter = opts.priceFormatter;
      if (opts.timeFormatter != null) customTimeFormatter = opts.timeFormatter;
      resizeCanvas(undefined, 'apply-options');
      scheduleRender();
    },
    addSeries<T extends SeriesType>(type: T, options?: Partial<SeriesOptions>, paneId?: string): ISeriesApi<T> {
      const resolvedPaneId: PaneId = paneId ?? MAIN_PANE_ID;
      // Ensure the target pane exists; if not, fall back to main.
      const paneExists = panes.some((p) => p.id === resolvedPaneId);
      const sState: SeriesState = {
        id: `series-${++nextSeriesSeq}`,
        type,
        opts: { visible: true, ...options },
        store: new SeriesStore<TimedRow>(timeIndex),
        paneId: paneExists ? resolvedPaneId : MAIN_PANE_ID,
        scaleMargins: { top: 0, bottom: 0 },
        separateScale: options?.priceScaleId === '',
        excludeFromTimeIndex: options?.excludeFromTimeIndex === true,
        priceLines: new Map(),
        markers: [],
        primitives: [],
      };
      // Apply initial price scale mode if provided
      if (options?.priceScaleMode != null) {
        priceScaleModes.set(sState.paneId, options.priceScaleMode);
      }
      seriesList.push(sState);
      return makeSeries<T>(sState);
    },
    timeScale(): ITimeScaleApi {
      return timeScaleApi;
    },
    getDimensions(): { width: number; height: number; priceAxisWidth: number; timeAxisHeight: number } {
      return { width, height, priceAxisWidth, timeAxisHeight: TIME_AXIS_H };
    },
    subscribeCrosshairMove(handler: (param: unknown) => void): void {
      crosshairListeners.add(handler as (param: CrosshairMoveEvent) => void);
    },
    unsubscribeCrosshairMove(handler: (param: unknown) => void): void {
      crosshairListeners.delete(handler as (param: CrosshairMoveEvent) => void);
    },
    subscribeClick(handler: (param: CrosshairMoveEvent) => void): void {
      clickListeners.add(handler);
    },
    unsubscribeClick(handler: (param: CrosshairMoveEvent) => void): void {
      clickListeners.delete(handler);
    },
    subscribeDblClick(handler: (param: CrosshairMoveEvent) => void): void {
      dblClickListeners.add(handler);
    },
    unsubscribeDblClick(handler: (param: CrosshairMoveEvent) => void): void {
      dblClickListeners.delete(handler);
    },
    panes(): IPaneApi[] {
      return panes.map((paneDef) => {
        const paneId = paneDef.id;
        const paneApi: IPaneApi = {
          id(): string {
            return paneId;
          },
          getSize(): { width: number; height: number } {
            const layout = computePaneLayout(panes, ch());
            const found = layout.find((l) => l.id === paneId);
            return {
              width: cw(),
              height: found?.h ?? 0,
            };
          },
          attachPrimitive(primitive: IPanePrimitive): void {
            let prims = panePrimitives.get(paneId);
            if (!prims) { prims = []; panePrimitives.set(paneId, prims); }
            if (!prims.includes(primitive)) {
              prims.push(primitive);
              primitive.attached?.({
                chart: api,
                requestUpdate: () => scheduleRender('primitive-update'),
              });
            }
            scheduleRender();
          },
          detachPrimitive(primitive: IPanePrimitive): void {
            const prims = panePrimitives.get(paneId);
            if (!prims) return;
            const idx = prims.indexOf(primitive);
            if (idx >= 0) {
              prims.splice(idx, 1);
              primitive.detached?.();
              scheduleRender();
            }
          },
          moveTo(targetIndex: number): void {
            const currentIdx = panes.findIndex((p) => p.id === paneId);
            if (currentIdx < 0 || currentIdx === targetIndex) return;
            const [paneDef2] = panes.splice(currentIdx, 1);
            const clampedTarget = Math.max(0, Math.min(panes.length, targetIndex));
            panes.splice(clampedTarget, 0, paneDef2);
            scheduleRender();
          },
        };
        return paneApi;
      });
    },
    setInteractionMode(newMode: InteractionMode): void {
      mode = newMode;
    },
    addIndicator(indicatorId: string, params?: Record<string, number>): string {
      const def = getIndicator(indicatorId);
      if (!def) throw new Error(`Unknown indicator id "${indicatorId}". Check the id or call listIndicators() to see registered indicators.`);

      const instanceId: IndicatorInstanceId = `ind-${++nextIndicatorSeq}`;

      // Merge caller params with definition defaults.
      const resolvedParams: Record<string, number> = {};
      for (const spec of def.inputs) {
        resolvedParams[spec.name] = spec.default;
      }
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          if (typeof v === 'number') resolvedParams[k] = v;
        }
      }

      // Determine whether any output goes to a subpane.
      const needsSubpane = def.outputs.some((o) => o.pane === 'subpane');
      let subpaneId: PaneId | undefined;
      if (needsSubpane) {
        subpaneId = `ind-pane-${instanceId}`;
        // Subpanes use a 0.35 height weight relative to the main pane (≈35% of chart).
        panes.push({ id: subpaneId, height: 0.35 });
      }

      const outputSeriesIds: string[] = [];

      for (let oi = 0; oi < def.outputs.length; oi++) {
        const outSpec = def.outputs[oi];
        const targetPaneId: PaneId =
          outSpec.pane === 'subpane' ? (subpaneId ?? MAIN_PANE_ID) : MAIN_PANE_ID;

        const seriesType: SeriesType = outSpec.seriesType as SeriesType;
        const seriesOpts: Partial<SeriesOptions> = {
          visible: true,
          color: outSpec.color,
          lineWidth: outSpec.lineWidth,
          ...(seriesType === 'Histogram' ? { base: outSpec.base ?? 0 } : {}),
        };

        const sState: SeriesState = {
          id: `series-${++nextSeriesSeq}`,
          type: seriesType,
          opts: { visible: true, ...seriesOpts },
          store: new SeriesStore<TimedRow>(timeIndex),
          paneId: targetPaneId,
          scaleMargins: { top: 0, bottom: 0 },
          separateScale: false,
          excludeFromTimeIndex: false,
          indicatorInstanceId: instanceId,
          priceLines: new Map(),
          markers: [],
          primitives: [],
        };
        seriesList.push(sState);
        outputSeriesIds.push(sState.id);
      }

      const instance: IndicatorInstance = {
        instanceId,
        indicatorId,
        definition: def,
        params: resolvedParams,
        ownedPaneId: subpaneId,
        outputSeriesIds,
      };
      indicatorInstances.set(instanceId, instance);

      // Coalesce indicator setup recomputes so attaching multiple indicators in one tick
      // does not trigger a full pass for every individual add.
      scheduleIndicatorRecompute();
      scheduleRender();

      return instanceId;
    },
    removeIndicator(instanceId: string): void {
      const inst = indicatorInstances.get(instanceId);
      if (!inst) return;

      // Remove output series.
      for (const sid of inst.outputSeriesIds) {
        const idx = seriesList.findIndex((s) => s.id === sid);
        if (idx >= 0) seriesList.splice(idx, 1);
      }

      // Remove the owned subpane (if any).
      if (inst.ownedPaneId) {
        const pIdx = panes.findIndex((p) => p.id === inst.ownedPaneId);
        if (pIdx >= 0) panes.splice(pIdx, 1);
        // Re-assign any non-indicator series that somehow ended up in this pane.
        for (const s of seriesList) {
          if (s.paneId === inst.ownedPaneId) s.paneId = MAIN_PANE_ID;
        }
      }

      indicatorInstances.delete(instanceId);
      if (indicatorInstances.size === 0) {
        indicatorComputeWindow = null;
      }
      scheduleRender();
    },
    addPane(opts?: { height?: number; id?: string }): string {
      const id: PaneId = opts?.id ?? `pane-${++nextPaneSeq}`;
      const normalizedHeight = Math.max(MIN_PANE_HEIGHT, opts?.height ?? 1);
      const existing = panes.find((p) => p.id === id);
      if (existing) {
        // If an explicit height was provided for an existing pane, update it.
        if (opts?.height != null) {
          existing.height = normalizedHeight;
          scheduleRender();
        }
      } else {
        panes.push({ id, height: normalizedHeight });
        scheduleRender();
      }
      return id;
    },
    removePane(id: string): void {
      if (id === MAIN_PANE_ID) return; // main pane is permanent
      const idx = panes.findIndex((p) => p.id === id);
      if (idx < 0) return;
      panes.splice(idx, 1);
      panePriceScales.delete(id);
      // Re-assign orphaned series to the main pane.
      for (const s of seriesList) {
        if (s.paneId === id) s.paneId = MAIN_PANE_ID;
      }
      scheduleRender();
    },
    setPaneHeights(heights: Record<string, number>): void {
      for (const pane of panes) {
        const h = heights[pane.id];
        if (typeof h === 'number' && h > 0) pane.height = Math.max(MIN_PANE_HEIGHT, h);
      }
      scheduleRender();
    },
    zoomPriceScale(deltaY: number, anchorY: number): void {
      const rs = computeRenderState();
      const pane = getPaneAtY(rs, anchorY);
      if (!pane) return;
      const startRange = pane.max - pane.min || 1;
      // Map wheel delta → zoom factor (same scale as drag: 0.001 per pixel-equivalent)
      const zoomFactor = Math.exp(deltaY * 0.001);
      const minRange = Math.max(Math.abs(pane.min), Math.abs(pane.max), 1) * 0.0001;
      const nextRange = Math.max(minRange, Math.min(startRange * 50, startRange * zoomFactor));
      const anchorPrice = yToPrice(anchorY, pane.min, pane.max, pane.top, pane.h);
      const anchorRatio = (anchorPrice - pane.min) / startRange;
      const nextMin = anchorPrice - anchorRatio * nextRange;
      const nextMax = nextMin + nextRange;
      setPanePriceScaleManual(pane.id, nextMin, nextMax);
      scheduleRender();
    },
    resetPriceScale(anchorY: number): void {
      const rs = computeRenderState();
      const pane = getPaneAtY(rs, anchorY);
      if (!pane) return;
      setPanePriceScaleAuto(pane.id);
      scheduleRender();
    },
    demoCursor(): IDemoCursorApi {
      return {
        clearStrokes(): void {
          demoStrokes.length = 0;
          if (demoCursorRafId != null) { cancelAnimationFrame(demoCursorRafId); demoCursorRafId = null; }
          scheduleRender('demo-cursor-clear');
        },
        setColor(color: string): void {
          demoCursorColor = color;
        },
        setLineWidth(width: number): void {
          demoCursorLineWidth = width;
        },
        setFadeDuration(ms: number): void {
          demoCursorFadeDuration = ms;
        },
        strokeCount(): number {
          return demoStrokes.length;
        },
        setActive(active: boolean): void {
          demoCursorForceMode = !!active;
          // When activated, show a crosshair cursor so the user knows brush is live.
          // When deactivated, restore the default.
          try {
            canvas.style.cursor = demoCursorForceMode ? 'crosshair' : '';
          } catch { /* noop for non-DOM env */ }
        },
        isActive(): boolean {
          return demoCursorForceMode;
        },
      };
    },
    remove(): void {
      destroyed = true;
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
      renderQueued = false;
      renderReasons.clear();
      if (indicatorRafId != null) { cancelAnimationFrame(indicatorRafId); indicatorRafId = null; }
      if (wheelRafId != null) { cancelAnimationFrame(wheelRafId); wheelRafId = null; }
      if (kineticRafId != null) { cancelAnimationFrame(kineticRafId); kineticRafId = null; }
      if (demoCursorRafId != null) { cancelAnimationFrame(demoCursorRafId); demoCursorRafId = null; }
      demoStrokes.length = 0;
      demoCursorActive = false;
      if (indicatorWorker) {
        indicatorWorker.terminate();
        indicatorWorker = null;
      }
      crosshairListeners.clear();
      clickListeners.clear();
      dblClickListeners.clear();
      indicatorWorkerInFlightRequestId = null;
      paneResizeDrag = null;
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('click', onCanvasClick);
      canvas.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (container.contains(canvas)) container.removeChild(canvas);
    },
  };

  scheduleRender();
  return api;
}
