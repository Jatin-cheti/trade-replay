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
}

export interface ChartOptions {
  width?: number;
  height?: number;
  autoSize?: boolean;
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
  /**
   * Enable opt-in perf instrumentation.  Logs a throttled summary
   * (avg / p95 per metric) to the console every 5 s.
   * Can also be enabled at runtime: `window.__TRADEREPLAY_PERF_DEBUG__ = true`.
   */
  perfDebug?: boolean;
}

export interface IChartApi {
  applyOptions(opts: Partial<ChartOptions>): void;
  addSeries<T extends SeriesType>(type: T, options?: Partial<SeriesOptions>, paneId?: string): ISeriesApi<T>;
  timeScale(): ITimeScaleApi;
  subscribeCrosshairMove(handler: (param: unknown) => void): void;
  unsubscribeCrosshairMove(handler: (param: unknown) => void): void;
  setInteractionMode(mode: InteractionMode): void;
  remove(): void;
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
}

// ─── Internal constants ───────────────────────────────────────────────────────
const PRICE_AXIS_W = 68;
const TIME_AXIS_H = 28;
const DEFAULT_BAR_WIDTH = 8;
const MIN_BAR_WIDTH = 2;
const MAX_BAR_WIDTH = 60;
const PRICE_PADDING = 0.1;
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function niceStep(range: number, steps: number): number {
  const rough = range / steps;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return nice * mag;
}

function fmtPrice(p: number): string {
  if (Math.abs(p) >= 10000) return p.toFixed(0);
  if (Math.abs(p) >= 1000) return p.toFixed(1);
  if (Math.abs(p) >= 1) return p.toFixed(2);
  return p.toPrecision(4);
}

function fmtTime(ts: UTCTimestamp, interval: number): string {
  const d = new Date(ts * 1000);
  if (interval >= 86400) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function snapCssPixel(value: number): number {
  return Math.round(value) + 0.5;
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
  /**
   * If set, this series was created as indicator output.
   * It is excluded from TimeIndex rebuilds (its timestamps are always a
   * subset of the source series' timestamps).
   */
  indicatorInstanceId?: IndicatorInstanceId;
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

// ─── createChart ─────────────────────────────────────────────────────────────

export function createChart(
  container: HTMLElement,
  initOpts?: Partial<ChartOptions>
): IChartApi {
  // ── dimensions ──
  let width = (initOpts?.width ?? container.clientWidth) || 800;
  let height = (initOpts?.height ?? container.clientHeight) || 400;

  // ── theme ──
  let bgColor = 'rgba(9, 17, 32, 0.85)';
  let textColor = 'rgba(173, 192, 225, 0.88)';
  let fontFamily = 'JetBrains Mono, monospace';
  let fontSize = 11;
  let gridColor = 'rgba(38, 56, 84, 0.48)';
  let crosshairVColor = 'rgba(0, 209, 255, 0.72)';
  let crosshairHColor = 'rgba(255, 0, 0, 0.65)';
  let axisBorderColor = 'rgba(56, 80, 117, 0.55)';

  // ── chart state ──
  let barWidth = DEFAULT_BAR_WIDTH;
  /** Index into timeIndex for the bar at the right edge of the chart area. */
  let rightmostIndex = 0;
  const timeIndex = new TimeIndex();
  let mode: InteractionMode = 'idle';
  let crosshairX: number | null = null;
  let crosshairY: number | null = null;

  /** Ordered list of pane definitions; main pane is always first. */
  const panes: PaneDef[] = [{ id: MAIN_PANE_ID, height: 1 }];
  const panePriceScales = new Map<PaneId, PanePriceScaleState>();
  let nextPaneSeq = 0;
  let nextSeriesSeq = 0;
  let nextIndicatorSeq = 0;

  const seriesList: SeriesState[] = [];
  const indicatorInstances = new Map<IndicatorInstanceId, IndicatorInstance>();
  let rafId: number | null = null;
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

  function resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();

  // ── layout helpers ──
  function cw(): number { return width - PRICE_AXIS_W; }
  function ch(): number { return height - TIME_AXIS_H; }
  function vbars(): number { return cw() / barWidth; }

  function clampRightmostIndex(next: number): number {
    if (!timeIndex.length) return 0;
    const max = (timeIndex.length - 1) + MAX_RIGHT_OFFSET_BARS;
    const min = Math.min(timeIndex.length - 1, Math.max(0, vbars() - 0.5));
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
        .filter((s) => !s.indicatorInstanceId)
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
      rightmostIndex = clampRightmostIndex(newLen - 1);
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
        if (s.type === 'Baseline' || s.type === 'Histogram') min = Math.min(min, 0);
        max = Math.max(max, v);
      }
    }
    if (!isFinite(min) || !isFinite(max)) return null;
    return padPriceRange(min, max, PRICE_PADDING);
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
    const firstBar = Math.max(0, Math.floor(xToBar(0)));
    const lastBar = Math.min(timeIndex.length - 1, Math.ceil(rightmostIndex));

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
      const priceRange = pane.max - pane.min;
      const hStep = niceStep(priceRange, 6);
      let p = Math.ceil(pane.min / hStep) * hStep;
      while (p <= pane.max) {
        const y = snapCssPixel(priceToY(p, pane.min, pane.max, pane.top, pane.h));
        if (y >= pane.top && y <= pane.top + pane.h) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        p += hStep;
      }
    }

    // Vertical grid lines — span full chart area
    const minSpacing = 60;
    const bpl = Math.max(1, Math.ceil(minSpacing / barWidth));
    for (let i = Math.ceil(rs.firstBar / bpl) * bpl; i <= rs.lastBar; i += bpl) {
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
      ctx.beginPath(); ctx.moveTo(0, divY); ctx.lineTo(w + PRICE_AXIS_W, divY); ctx.stroke();
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

    const minSpacing = 70;
    const bpl = Math.max(1, Math.ceil(minSpacing / barWidth));
    for (let i = Math.ceil(rs.firstBar / bpl) * bpl; i <= rs.lastBar; i += bpl) {
      const x = barToX(i);
      if (x < 10 || x > w - 10) continue;
      const t = timeIndex.at(i);
      if (t == null) continue;
      ctx.fillText(fmtTime(t, interval), x, h + TIME_AXIS_H / 2);
    }
  }

  function drawPriceAxis(rs: RenderState): void {
    const w = cw();
    ctx.fillStyle = bgColor;
    ctx.fillRect(w, 0, PRICE_AXIS_W, height);

    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const pane of rs.paneStates) {
      const priceRange = pane.max - pane.min;
      const hStep = niceStep(priceRange, 6);
      let p = Math.ceil(pane.min / hStep) * hStep;
      while (p <= pane.max) {
        const y = snapCssPixel(priceToY(p, pane.min, pane.max, pane.top, pane.h));
        if (y >= pane.top && y <= pane.top + pane.h) {
          ctx.fillText(fmtPrice(p), w + 6, y);
        }
        p += hStep;
      }
    }
  }

  function drawCandlestick(s: SeriesState, rs: RenderState, pane: PaneRenderState): void {
    const bw = barWidth;
    const hw = Math.max(0.5, bw * 0.4);
    const { firstBar, lastBar } = rs;
    const w = cw();

    for (let i = firstBar; i <= lastBar; i++) {
      const row = s.store.getAt(i) as CandlestickData | null;
      if (!row) continue;
      const x = snapCssPixel(barToX(i));
      if (x < -bw || x > w + bw) continue;

      const isUp = row.close >= row.open;
      const wickColor = isUp
        ? (s.opts.wickUpColor ?? s.opts.upColor ?? '#17c964')
        : (s.opts.wickDownColor ?? s.opts.downColor ?? '#ff4d4f');
      const borderColor = isUp
        ? (s.opts.borderUpColor ?? s.opts.upColor ?? '#17c964')
        : (s.opts.borderDownColor ?? s.opts.downColor ?? '#ff4d4f');
      const bodyColor = isUp
        ? (s.opts.upColor ?? '#17c964')
        : (s.opts.downColor ?? '#ff4d4f');

      const openY  = priceToY(row.open,  pane.min, pane.max, pane.top, pane.h);
      const closeY = priceToY(row.close, pane.min, pane.max, pane.top, pane.h);
      const highY  = priceToY(row.high,  pane.min, pane.max, pane.top, pane.h);
      const lowY   = priceToY(row.low,   pane.min, pane.max, pane.top, pane.h);

      // Wick
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body
      const bodyTop = Math.min(openY, closeY);
      const bodyH = Math.max(1, Math.abs(closeY - openY));
      ctx.fillStyle = bodyColor;
      ctx.fillRect(x - hw, bodyTop, hw * 2, bodyH);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - hw, bodyTop, hw * 2, bodyH);
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

      const highY  = priceToY(row.high,  pane.min, pane.max, pane.top, pane.h);
      const lowY   = priceToY(row.low,   pane.min, pane.max, pane.top, pane.h);
      const openY  = priceToY(row.open,  pane.min, pane.max, pane.top, pane.h);
      const closeY = priceToY(row.close, pane.min, pane.max, pane.top, pane.h);

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
      baseY = priceToY(baseVal, pane.min, pane.max, pane.top, pane.h);
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
        valY = priceToY(row.value, pane.min, pane.max, pane.top, pane.h);
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
      const y = priceToY(row.value, pane.min, pane.max, pane.top, pane.h);
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
      const y = priceToY(row.value, pane.min, pane.max, pane.top, pane.h);
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
      const y = priceToY(row.value, pane.min, pane.max, pane.top, pane.h);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    if (started) ctx.stroke();
  }

  function drawBaseline(s: SeriesState, rs: RenderState, pane: PaneRenderState): void {
    const { firstBar, lastBar } = rs;
    const basePrice = s.opts.baseValue?.price ?? 0;
    const baseY = priceToY(basePrice, pane.min, pane.max, pane.top, pane.h);
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
      const rawY = priceToY(row.value, pane.min, pane.max, pane.top, pane.h);
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
      const rawY = priceToY(row.value, pane.min, pane.max, pane.top, pane.h);
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
      const y = priceToY(row.value, pane.min, pane.max, pane.top, pane.h);
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
      const price = yToPrice(snappedCrosshairY, activePane.min, activePane.max, activePane.top, activePane.h);
      const pLabel = fmtPrice(price);
      canvas.dataset.crosshairPrice = pLabel;
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'middle';
      const labelH = 16;
      ctx.fillStyle = crosshairHColor;
      ctx.fillRect(w + 2, snappedCrosshairY - labelH / 2, PRICE_AXIS_W - 4, labelH);
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

  function scheduleRender(): void {
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      render();
    });
  }

  function render(): void {
      const renderStart = performance.now();
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const rs = computeRenderState();
    canvas.dataset.priceScale = rs.paneStates.length > 0
      ? `${rs.paneStates[0].min.toFixed(2)}:${rs.paneStates[0].max.toFixed(2)}`
      : '';

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

    drawBackground();
    drawGrid(rs);

    // Draw series per pane, each clipped to its own pane rect.
    for (const pane of rs.paneStates) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, pane.top, cw(), pane.h);
      ctx.clip();
      for (const s of seriesList) {
        if (s.paneId === pane.id) drawSeries(s, rs, pane);
      }
      ctx.restore();
    }

    // Crosshair: vertical line spans all panes, horizontal only in active pane.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw(), ch());
    ctx.clip();
    drawCrosshair(rs);
    ctx.restore();

    drawAxesBorder(rs);
    drawTimeAxis(rs);
    drawPriceAxis(rs);

    const renderDurationMs = performance.now() - renderStart;
    debugHooks?.onRenderEnd?.({
      durationMs: renderDurationMs,
      barCount: rs.lastBar >= rs.firstBar ? rs.lastBar - rs.firstBar + 1 : 0,
      indicatorCount: indicatorInstances.size,
    });
    perf?.record('render', renderDurationMs);

    notifyVisibleRangeChange();
  }

  // ── interaction ──────────────────────────────────────────────────────────

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

  function updatePriceAxisDrag(y: number): void {
    if (!priceAxisDrag) return;
    const rs = computeRenderState();
    const pane = rs.paneStates.find((item) => item.id === priceAxisDrag?.paneId);
    if (!pane) return;

    const startRange = priceAxisDrag.startMax - priceAxisDrag.startMin || 1;
    const zoomFactor = Math.exp((y - priceAxisDrag.startY) * 0.01);
    const nextRange = Math.min(Math.max(startRange * zoomFactor, Math.max(Math.abs(priceAxisDrag.startMin), Math.abs(priceAxisDrag.startMax), 1) * 0.0001), startRange * 100);
    const anchorPrice = yToPrice(priceAxisDrag.startY, priceAxisDrag.startMin, priceAxisDrag.startMax, pane.top, pane.h);
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
      const nextBarWidth = Math.max(MIN_BAR_WIDTH, Math.min(MAX_BAR_WIDTH, barWidth * zoomFactor));
      if (Math.abs(nextBarWidth - barWidth) < 0.001) return;

      const anchorBar = xToBar(anchorX);
      barWidth = nextBarWidth;
      // Keep the logical bar under the cursor anchored while zooming.
      rightmostIndex = clampRightmostIndex(anchorBar + 0.5 - (cw() - anchorX) / barWidth);
      scheduleRender();
    });
  }

  function onPointerDown(e: PointerEvent): void {
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
    if (dragStart != null && (mode === 'pan' || mode === 'scroll' || mode === 'idle')) {
      const dx = e.clientX - dragStart.clientX;
      rightmostIndex = clampRightmostIndex(dragStart.rightAtStart - dx / barWidth);
    }
    scheduleRender();
  }

  function onPointerUp(e: PointerEvent): void {
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    priceAxisDrag = null;
    dragStart = null;
    paneResizeDrag = null;
  }

  function onDoubleClick(e: MouseEvent): void {
    if (e.offsetX < cw()) return;
    resetPriceAxisScale(e.offsetY);
  }

  function onPointerLeave(): void {
    crosshairX = null;
    crosshairY = null;
    canvas.dataset.crosshairPrice = '';
    canvas.dataset.crosshairTime = '';
    scheduleRender();
  }

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('dblclick', onDoubleClick);

  // ── series factory ────────────────────────────────────────────────────────

  function makeSeries<T extends SeriesType>(sState: SeriesState): ISeriesApi<T> {
    return {
      setData(data: RowOf<T>[]): void {
        sState.store.setData(data as TimedRow[]);
        rebuildIndex();
        scheduleRender();
      },
      update(row: RowOf<T>): void {
        const t = (row as { time: UTCTimestamp }).time;
        const result = sState.store.update(row as TimedRow);

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
            for (const s of seriesList) {
              s.store.realign();
            }
          }
        }

        // Keep indicator outputs in sync with streaming source data.
        if (!sState.indicatorInstanceId) {
          scheduleIndicatorRecompute();
        }

        scheduleRender();
      },
      applyOptions(opts: Partial<SeriesOptions>): void {
        sState.opts = { ...sState.opts, ...opts };
        scheduleRender();
      },
      priceScale(): IPriceScaleApi {
        return {
          applyOptions(opts: { scaleMargins?: ScaleMargins }): void {
            if (opts.scaleMargins) {
              sState.scaleMargins = { ...sState.scaleMargins, ...opts.scaleMargins };
              scheduleRender();
            }
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
        return yToPrice(y, pane.min, pane.max, pane.top, pane.h);
      },
      priceToCoordinate(price: number): number | null {
        const rs = computeRenderState();
        const pane = getPaneState(rs, sState.paneId);
        if (sState.separateScale) {
          const range = rs.seriesRanges[seriesList.indexOf(sState)];
          if (!range) return null;
          return sepPriceToY(price, range.min, range.max, sState.scaleMargins, pane.top, pane.h);
        }
        return priceToY(price, pane.min, pane.max, pane.top, pane.h);
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
      const bars = Math.abs(range.to - range.from);
      if (bars > 0) barWidth = Math.max(MIN_BAR_WIDTH, Math.min(MAX_BAR_WIDTH, cw() / bars));
      rightmostIndex = clampRightmostIndex(range.to);
      scheduleRender();
    },
    applyOptions(opts: { rightOffset?: number; [key: string]: unknown }): void {
      if (typeof opts.rightOffset === 'number') {
        rightmostIndex = clampRightmostIndex((timeIndex.length - 1) - opts.rightOffset);
        scheduleRender();
      }
    },
    scrollToPosition(pos: number, _animate: boolean): void {
      rightmostIndex = clampRightmostIndex((timeIndex.length - 1) - pos);
      scheduleRender();
    },
    scrollToRealTime(): void {
      rightmostIndex = clampRightmostIndex(timeIndex.length - 1);
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
      if (bars > 0) barWidth = Math.max(MIN_BAR_WIDTH, Math.min(MAX_BAR_WIDTH, cw() / bars));
      rightmostIndex = clampRightmostIndex(toIdx);
      scheduleRender();
    },
    subscribeVisibleTimeRangeChange(handler: () => void): void {
      visibleRangeListeners.add(handler);
    },
    unsubscribeVisibleTimeRangeChange(handler: () => void): void {
      visibleRangeListeners.delete(handler);
    },
  };

  // ── chart API ─────────────────────────────────────────────────────────────

  const api: IChartApi = {
    applyOptions(opts: Partial<ChartOptions>): void {
      if (opts.width != null) width = opts.width;
      if (opts.height != null) height = opts.height;
      if (opts.layout?.background?.color) bgColor = opts.layout.background.color;
      if (opts.layout?.textColor) textColor = opts.layout.textColor;
      if (opts.layout?.fontFamily) fontFamily = opts.layout.fontFamily;
      if (opts.layout?.fontSize != null) fontSize = opts.layout.fontSize;
      if (opts.grid?.vertLines?.color) gridColor = opts.grid.vertLines.color;
      if (opts.crosshair?.vertLine?.color) crosshairVColor = opts.crosshair.vertLine.color;
      if (opts.crosshair?.horzLine?.color) crosshairHColor = opts.crosshair.horzLine.color;
      if (opts.rightPriceScale?.borderColor) axisBorderColor = opts.rightPriceScale.borderColor;
      resizeCanvas();
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
      };
      seriesList.push(sState);
      return makeSeries<T>(sState);
    },
    timeScale(): ITimeScaleApi {
      return timeScaleApi;
    },
    subscribeCrosshairMove(_handler: (param: unknown) => void): void {
      // optional: no-op for now
    },
    unsubscribeCrosshairMove(_handler: (param: unknown) => void): void {
      // optional: no-op
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
          indicatorInstanceId: instanceId,
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
    remove(): void {
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
      if (indicatorRafId != null) { cancelAnimationFrame(indicatorRafId); indicatorRafId = null; }
      if (wheelRafId != null) { cancelAnimationFrame(wheelRafId); wheelRafId = null; }
      if (indicatorWorker) {
        indicatorWorker.terminate();
        indicatorWorker = null;
      }
      indicatorWorkerInFlightRequestId = null;
      paneResizeDrag = null;
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('dblclick', onDoubleClick);
      if (container.contains(canvas)) container.removeChild(canvas);
    },
  };

  scheduleRender();
  return api;
}
