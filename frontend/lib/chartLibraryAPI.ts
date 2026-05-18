/**
 * chartLibraryAPI.ts
 * ==================
 * Public programmatic API for the TradeReplay chart library.
 *
 * Mirrors the lightweight-charts + TradingView pattern:
 *   const api = getChartAPI();                 // connect to mounted chart
 *   api.setActiveTool("trend");                 // activate drawing tool
 *   api.addDrawing("trend", [p1, p2]);          // add drawing programmatically
 *   api.removeDrawing(id);                      // remove by id
 *   api.clearDrawings();                        // clear all drawings
 *   api.undo(); api.redo();                     // history navigation
 *   api.getDrawings();                          // inspect all drawings
 *   api.on("drawing:added", handler);           // subscribe to events
 *
 * All 27 tools tested in the 13,500 automation suite are supported.
 *
 * ── Tool Variants supported ───────────────────────────────────────────────────
 *
 *  FORECASTING
 *    longPosition       - Long position (entry + target + stop, 3 anchors)
 *    shortPosition      - Short position (entry + target + stop, 3 anchors)
 *    positionForecast   - Position forecast (3 anchors)
 *    barPattern         - Bar pattern (2 anchors, shows mini candlesticks)
 *    ghostFeed          - Ghost feed (2 anchors, dashed projection)
 *    anchoredVwap       - Anchored VWAP (1 anchor, computes from candle data)
 *    fixedRangeVolumeProfile - Fixed range volume profile (2 anchors)
 *    anchoredVolumeProfile   - Anchored volume profile (1 anchor)
 *
 *  MEASURERS
 *    priceRange         - Price range box (2 anchors)
 *    dateRange          - Date range box (2 anchors)
 *    dateAndPriceRange  - Date & price range box (2 anchors)
 *
 *  BRUSH / ARROWS / SHAPES
 *    brush              - Freehand brush stroke (2+ anchors)
 *    highlighter        - Semi-transparent highlighter (2+ anchors)
 *    arrowMarker        - Arrow marker stamp (1 anchor, points up)
 *    arrowTool          - Arrow with arrowhead (2 anchors)
 *    arrowMarkUp        - Green up arrow stamp (1 anchor)
 *    arrowMarkDown      - Red down arrow stamp (1 anchor)
 *    rectangle          - Rectangle (2 anchors)
 *    rotatedRectangle   - Rotated rectangle (2 anchors)
 *    path               - Freehand path (3+ anchors, click-sequence)
 *    circle             - Circle (2 anchors)
 *    ellipse            - Ellipse (2 anchors)
 *    polyline           - Polyline (3+ anchors, click-sequence)
 *    triangle           - Triangle (3 anchors, click-sequence)
 *    arc                - Arc (2 anchors)
 *    curveTool          - Smooth curve (3+ anchors, click-sequence)
 *    doubleCurve        - Double-offset curve (3+ anchors, click-sequence)
 *
 *  LINES
 *    trend, ray, infoLine, extendedLine, trendAngle,
 *    hline, horizontalRay, vline, crossLine,
 *    channel, regressionTrend, flatTopBottom, disjointChannel
 *
 *  FIBONACCI
 *    fibRetracement, fibExtension, fibChannel, fibTimeZone,
 *    fibSpeedResistFan, fibTrendTime, fibCircles, fibSpiral,
 *    fibSpeedResistArcs, fibWedge, pitchfan,
 *    pitchfork, schiffPitchfork, modifiedSchiffPitchfork, insidePitchfork
 *
 *  GANN
 *    gannBox, gannSquareFixed, gannSquare, gannFan
 *
 *  PATTERNS
 *    xabcd, cypherPattern, headAndShoulders, abcdPattern,
 *    trianglePattern, threeDrives,
 *    elliottImpulse, elliottCorrection, elliottTriangle,
 *    elliottDoubleCombo, elliottTripleCombo,
 *    cyclicLines, timeCycles, sineLine
 *
 *  TEXT / NOTES
 *    plainText, anchoredText, note, priceNote, pin, table, callout,
 *    comment, priceLabel, signpost, flagMark, image, post, idea
 *
 *  ICONS
 *    emoji, sticker, iconTool
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** A point on the chart in data space (time is seconds since epoch, UTC). */
export interface ChartPoint {
  /** Unix timestamp in seconds (UTC). */
  time: number;
  /** Price value. */
  price: number;
}

/** Style options for a drawing. All fields are optional — defaults are used otherwise. */
export interface DrawingOptions {
  /** Hex color string, e.g. "#2962ff". */
  color?: string;
  /** Line thickness in pixels (1–8). */
  thickness?: number;
  /** Line style: "solid" | "dashed" | "dotted". */
  style?: "solid" | "dashed" | "dotted";
  /** Opacity (0–1). */
  opacity?: number;
  /** Whether to show price label at each level (Fib, measures). */
  priceLabel?: boolean;
  /** Font family for text drawings. */
  font?: string;
  /** Font size in pixels for text drawings. */
  textSize?: number;
  /** Text alignment: "left" | "center" | "right". */
  align?: "left" | "center" | "right";
  /** Bold text. */
  bold?: boolean;
  /** Italic text. */
  italic?: boolean;
  /** Draw background behind text. */
  textBackground?: boolean;
  /** Draw border around text background. */
  textBorder?: boolean;
  /** Extend line to left edge of chart. */
  extendLeft?: boolean;
  /** Extend line to right edge of chart. */
  extendRight?: boolean;
  /** Ray mode (line shoots from anchor in one direction indefinitely). */
  rayMode?: boolean;
  /** VWAP interval: "session" | "week" | "month". */
  vwapInterval?: "session" | "week" | "month";
  /** Position label mode: "rr" | "price" | "both". */
  positionLabelMode?: "rr" | "price" | "both";
  /** Fibonacci levels as comma-separated string, e.g. "0,0.236,0.382,0.618,1". */
  fibLevels?: string;
  /** Fibonacci label mode: "percent" | "price" | "both". */
  fibLabelMode?: "percent" | "price" | "both";
  /** Brush smoothness (0–1). */
  brushSmoothness?: number;
}

/** A committed drawing returned by getDrawings() or addDrawing(). */
export interface ChartDrawing {
  /** Unique drawing id. */
  id: string;
  /** Tool variant that created this drawing. */
  variant: string;
  /** Anchor points in data space. */
  anchors: ChartPoint[];
  /** Resolved style options. */
  options: Record<string, unknown>;
  /** Whether the drawing is currently selected. */
  selected: boolean;
  /** Whether the drawing is visible. */
  visible: boolean;
  /** Whether the drawing is locked (not interactable). */
  locked: boolean;
  /** Optional text content (for text/note drawings). */
  text?: string;
}

/** Projected screen coordinates for a drawing's anchors. */
export interface DrawingScreenAnchors {
  id: string;
  variant: string;
  /** Client-relative screen coordinates for each anchor. */
  anchors: Array<{ x: number; y: number }>;
}

/** Floating toolbar position (rendered above selected drawing). */
export interface ToolbarState {
  visible: boolean;
  drawingId: string | null;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  centerX?: number;
  centerY?: number;
}

/** Chart bounding box in screen (client) coordinates. */
export interface ChartBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Events the chart API can emit. */
export type ChartAPIEvent =
  | "drawing:added"
  | "drawing:removed"
  | "drawing:selected"
  | "drawing:deselected"
  | "drawing:updated"
  | "tool:changed"
  | "history:change"
  | "drawings:cleared";

export type ChartAPIEventHandler = (payload: unknown) => void;

// ── Internal bridge to __chartDebug ──────────────────────────────────────────

type ChartDebug = {
  getDrawings: () => ChartDrawing[];
  getDrawingsCount: () => number;
  getDrawingById: (id: string) => ChartDrawing | null;
  getLatestDrawingId: () => string | null;
  getSelectedDrawingId: () => string | null;
  getActiveVariant: () => string;
  getHistoryLength: () => number;
  getHoverPoint: () => ChartPoint | null;
  getToolOptions: () => Record<string, unknown>;
  getChartBounds: () => ChartBounds | null;
  getScrollPosition: () => number | null;
  getVisibleLogicalRange: () => { from: number; to: number } | null;
  getProjectedAnchors: (id?: string) => DrawingScreenAnchors | null;
  getFloatingToolbarState: () => ToolbarState;
  getDraftVariant: () => string | null;
  forceSelectDrawing: (id: string | null) => string | null;
  clearAllDrawings: () => number;
  clearDrawingsFast: () => number;
  addSyntheticDrawings: (count: number, variant?: string) => number;
  dataPointToClient: (time: number, price: number) => { x: number; y: number } | null;
  pointerToDataPoint: (x: number, y: number, snap: boolean) => ChartPoint | null;
  scrollToPosition: (pos: number) => number | null;
};

function getDebug(): ChartDebug | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as Record<string, unknown>).__chartDebug as ChartDebug | null ?? null;
}

// ── Event bus (lightweight internal pub/sub) ──────────────────────────────────

class EventBus {
  private readonly handlers = new Map<string, Set<ChartAPIEventHandler>>();

  on(event: ChartAPIEvent, handler: ChartAPIEventHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
  }

  off(event: ChartAPIEvent, handler: ChartAPIEventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: ChartAPIEvent, payload?: unknown): void {
    this.handlers.get(event)?.forEach((h) => {
      try { h(payload); } catch { /* ignore handler errors */ }
    });
  }

  clear(): void {
    this.handlers.clear();
  }
}

// ── ChartLibraryAPI class ─────────────────────────────────────────────────────

/**
 * TradeReplay Chart Library API
 *
 * Connect to a mounted TradingChart instance and interact with it
 * programmatically — draw tools, manage drawings, navigate history.
 *
 * @example
 * ```ts
 * const api = getChartAPI();
 * if (!api) { console.warn("Chart not mounted yet"); return; }
 *
 * // Draw a trend line
 * const id = api.addDrawing("trend", [
 *   { time: 1700000000, price: 2500 },
 *   { time: 1700086400, price: 2600 },
 * ]);
 *
 * // Activate a tool for user interaction
 * api.setActiveTool("rectangle");
 *
 * // Subscribe to events
 * api.on("drawing:added", (d) => console.log("New drawing", d));
 *
 * // Clear everything
 * api.clearDrawings();
 * ```
 */
export class ChartLibraryAPI {
  private readonly bus = new EventBus();
  private pollingId: ReturnType<typeof setInterval> | null = null;
  private lastDrawingCount = 0;
  private lastHistoryLength = 0;
  private lastVariant = "none";
  private lastSelectedId: string | null = null;

  constructor() {
    // Poll for state changes to fire events (no intrusive React changes needed)
    if (typeof window !== "undefined") {
      this.pollingId = setInterval(() => this.poll(), 120);
    }
  }

  private poll(): void {
    const debug = getDebug();
    if (!debug) return;

    const count = debug.getDrawingsCount();
    const histLen = debug.getHistoryLength();
    const variant = debug.getActiveVariant();
    const selectedId = debug.getSelectedDrawingId();

    if (count > this.lastDrawingCount) {
      const latest = debug.getLatestDrawingId();
      this.bus.emit("drawing:added", latest ? debug.getDrawingById(latest) : null);
    } else if (count < this.lastDrawingCount) {
      this.bus.emit("drawing:removed", null);
    }

    if (histLen !== this.lastHistoryLength) {
      this.bus.emit("history:change", { length: histLen });
    }

    if (variant !== this.lastVariant) {
      this.bus.emit("tool:changed", { variant });
    }

    if (selectedId !== this.lastSelectedId) {
      if (selectedId) {
        this.bus.emit("drawing:selected", debug.getDrawingById(selectedId));
      } else {
        this.bus.emit("drawing:deselected", null);
      }
    }

    this.lastDrawingCount = count;
    this.lastHistoryLength = histLen;
    this.lastVariant = variant;
    this.lastSelectedId = selectedId;
  }

  /** Stop the event polling loop. Call when chart is unmounted. */
  destroy(): void {
    if (this.pollingId !== null) {
      clearInterval(this.pollingId);
      this.pollingId = null;
    }
    this.bus.clear();
  }

  // ── Tool activation ──────────────────────────────────────────────────────

  /**
   * Activate a drawing tool so the next user click/drag creates a drawing.
   *
   * Supported variants — all 27 prod-parity tools:
   * "longPosition" | "shortPosition" | "positionForecast" | "barPattern" |
   * "ghostFeed" | "anchoredVwap" | "fixedRangeVolumeProfile" |
   * "anchoredVolumeProfile" | "priceRange" | "dateRange" | "dateAndPriceRange" |
   * "brush" | "highlighter" | "arrowMarker" | "arrowTool" | "arrowMarkUp" |
   * "arrowMarkDown" | "rectangle" | "rotatedRectangle" | "path" | "circle" |
   * "ellipse" | "polyline" | "triangle" | "arc" | "curveTool" | "doubleCurve" |
   * "trend" | "ray" | "infoLine" | "extendedLine" | "trendAngle" | "hline" |
   * "horizontalRay" | "vline" | "crossLine" | "channel" | "regressionTrend" |
   * "flatTopBottom" | "disjointChannel" | "fibRetracement" | "fibExtension" |
   * "fibChannel" | "fibTimeZone" | "fibSpeedResistFan" | "fibTrendTime" |
   * "fibCircles" | "fibSpiral" | "fibSpeedResistArcs" | "fibWedge" | "pitchfan" |
   * "pitchfork" | "schiffPitchfork" | "modifiedSchiffPitchfork" |
   * "insidePitchfork" | "gannBox" | "gannSquareFixed" | "gannSquare" |
   * "gannFan" | "xabcd" | "cypherPattern" | "headAndShoulders" |
   * "abcdPattern" | "trianglePattern" | "threeDrives" | "elliottImpulse" |
   * "elliottCorrection" | "elliottTriangle" | "elliottDoubleCombo" |
   * "elliottTripleCombo" | "cyclicLines" | "timeCycles" | "sineLine" |
   * "plainText" | "anchoredText" | "note" | "priceNote" | "pin" | "table" |
   * "callout" | "comment" | "priceLabel" | "signpost" | "flagMark" |
   * "emoji" | "sticker" | "iconTool" | "none"
   */
  setActiveTool(variant: string): void {
    if (typeof window === "undefined") return;
    const setter = (window as unknown as Record<string, unknown>).__tradereplaySetActiveTool as ((v: string) => void) | undefined;
    if (setter) {
      setter(variant);
      return;
    }
    // Fallback: dispatch a custom event the TradingChart listens to
    window.dispatchEvent(new CustomEvent("__tradereplay:setTool", { detail: { variant } }));
  }

  /** Return the currently active tool variant. */
  getActiveTool(): string {
    return getDebug()?.getActiveVariant() ?? "none";
  }

  // ── Drawing management ───────────────────────────────────────────────────

  /**
   * Programmatically add a drawing to the chart.
   *
   * @param variant  Tool variant string (e.g. "trend", "rectangle", "longPosition")
   * @param anchors  Array of {time, price} anchor points (1–N depending on tool)
   * @param options  Optional style overrides
   * @param text     Optional text content (for text/note drawings)
   * @returns        The id of the created drawing, or null if the chart is not ready
   *
   * @example
   * ```ts
   * // Add a trend line
   * api.addDrawing("trend", [
   *   { time: 1700000000, price: 2500 },
   *   { time: 1700086400, price: 2600 },
   * ], { color: "#00ff88", thickness: 2 });
   *
   * // Add a long position (3 anchors: entry, target, stop)
   * api.addDrawing("longPosition", [
   *   { time: 1700000000, price: 2500 },  // entry
   *   { time: 1700086400, price: 2700 },  // target
   *   { time: 1700086400, price: 2400 },  // stop
   * ]);
   *
   * // Add a rectangle
   * api.addDrawing("rectangle", [
   *   { time: 1700000000, price: 2400 },
   *   { time: 1700172800, price: 2600 },
   * ], { color: "#2962ff", opacity: 0.5 });
   * ```
   */
  addDrawing(
    variant: string,
    anchors: ChartPoint[],
    options?: DrawingOptions,
    text?: string,
  ): string | null {
    if (typeof window === "undefined" || !anchors.length) return null;
    const adder = (window as unknown as Record<string, unknown>).__tradereplayAddDrawing as
      | ((variant: string, anchors: ChartPoint[], options?: DrawingOptions, text?: string) => string | null)
      | undefined;
    if (adder) {
      const id = adder(variant, anchors, options, text);
      if (id) this.bus.emit("drawing:added", { id, variant });
      return id;
    }
    return null;
  }

  /**
   * Remove a drawing by its id.
   * @returns true if the drawing was found and removed
   */
  removeDrawing(id: string): boolean {
    if (typeof window === "undefined") return false;
    const remover = (window as unknown as Record<string, unknown>).__tradereplayRemoveDrawing as
      | ((id: string) => boolean)
      | undefined;
    if (remover) {
      const removed = remover(id);
      if (removed) this.bus.emit("drawing:removed", { id });
      return removed;
    }
    return false;
  }

  /**
   * Clear all drawings from the chart.
   * Pushes a history checkpoint so undo restores them.
   */
  clearDrawings(): void {
    getDebug()?.clearAllDrawings();
    this.bus.emit("drawings:cleared");
  }

  /** Return all drawings currently on the chart. */
  getDrawings(): ChartDrawing[] {
    return getDebug()?.getDrawings() ?? [];
  }

  /** Return a single drawing by id, or null if not found. */
  getDrawingById(id: string): ChartDrawing | null {
    return getDebug()?.getDrawingById(id) ?? null;
  }

  /** Return the id of the most recently committed drawing. */
  getLatestDrawingId(): string | null {
    return getDebug()?.getLatestDrawingId() ?? null;
  }

  /** Return the id of the currently selected drawing. */
  getSelectedDrawingId(): string | null {
    return getDebug()?.getSelectedDrawingId() ?? null;
  }

  /** Programmatically select (highlight) a drawing by id. */
  selectDrawing(id: string | null): void {
    getDebug()?.forceSelectDrawing(id);
  }

  /**
   * Return the screen (client) coordinates of each anchor for a drawing.
   * Useful for positioning custom overlays or tooltips over a drawing.
   */
  getDrawingScreenAnchors(id?: string): DrawingScreenAnchors | null {
    return getDebug()?.getProjectedAnchors(id) ?? null;
  }

  /** Return the floating toolbar position of the currently selected drawing. */
  getToolbarState(): ToolbarState {
    return getDebug()?.getFloatingToolbarState() ?? { visible: false, drawingId: null };
  }

  // ── History ──────────────────────────────────────────────────────────────

  /**
   * Undo the last drawing action.
   * Dispatches keyboard Ctrl+Z to the chart overlay.
   */
  undo(): void {
    this.dispatchKey("Control+z");
  }

  /**
   * Redo the last undone action.
   * Dispatches keyboard Ctrl+Shift+Z to the chart overlay.
   */
  redo(): void {
    this.dispatchKey("Control+Shift+z");
  }

  /** Return the number of items in the undo history stack. */
  getHistoryLength(): number {
    return getDebug()?.getHistoryLength() ?? 0;
  }

  // ── Viewport ─────────────────────────────────────────────────────────────

  /** Return the chart container's bounding box in client coordinates. */
  getChartBounds(): ChartBounds | null {
    return getDebug()?.getChartBounds() ?? null;
  }

  /** Return the current horizontal scroll position of the time scale. */
  getScrollPosition(): number | null {
    return getDebug()?.getScrollPosition() ?? null;
  }

  /** Return the visible logical range (bar indices). */
  getVisibleLogicalRange(): { from: number; to: number } | null {
    return getDebug()?.getVisibleLogicalRange() ?? null;
  }

  /**
   * Scroll the chart to a given position.
   * @param position Bar offset from right edge (0 = last bar at right)
   */
  scrollToPosition(position: number): void {
    getDebug()?.scrollToPosition(position);
  }

  // ── Coordinate conversion ─────────────────────────────────────────────────

  /**
   * Convert a data point (time + price) to screen (client) coordinates.
   * Returns null if the chart is not ready or the point is off-screen.
   */
  dataPointToScreen(time: number, price: number): { x: number; y: number } | null {
    return getDebug()?.dataPointToClient(time, price) ?? null;
  }

  /**
   * Convert screen (client) coordinates to chart data point.
   * @param snap Whether to snap to nearest OHLC values
   */
  screenToDataPoint(x: number, y: number, snap = false): ChartPoint | null {
    return getDebug()?.pointerToDataPoint(x, y, snap) ?? null;
  }

  // ── Tool options ─────────────────────────────────────────────────────────

  /** Return the current tool options (color, thickness, style, etc.). */
  getToolOptions(): Record<string, unknown> {
    return getDebug()?.getToolOptions() ?? {};
  }

  // ── Synthetic drawings (for testing / demos) ──────────────────────────────

  /**
   * Add N synthetic drawings of the given variant for testing or demo purposes.
   * All drawings are positioned within the visible OHLC history.
   *
   * @param count   Number of drawings to add (1–2000)
   * @param variant Tool variant (default: "trend")
   * @returns       Number of drawings actually added
   */
  addSyntheticDrawings(count: number, variant = "trend"): number {
    return getDebug()?.addSyntheticDrawings(count, variant) ?? 0;
  }

  // ── Events ───────────────────────────────────────────────────────────────

  /**
   * Subscribe to a chart event.
   *
   * Events:
   *  "drawing:added"    — a new drawing was committed
   *  "drawing:removed"  — a drawing was deleted
   *  "drawing:selected" — a drawing was selected
   *  "drawing:deselected" — selection was cleared
   *  "drawing:updated"  — a drawing's options changed
   *  "tool:changed"     — active tool variant changed
   *  "history:change"   — undo/redo stack changed
   *  "drawings:cleared" — all drawings were cleared
   */
  on(event: ChartAPIEvent, handler: ChartAPIEventHandler): void {
    this.bus.on(event, handler);
  }

  /** Unsubscribe from a chart event. */
  off(event: ChartAPIEvent, handler: ChartAPIEventHandler): void {
    this.bus.off(event, handler);
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  /** Return true if the chart is currently mounted and the API is available. */
  isReady(): boolean {
    return getDebug() !== null;
  }

  /** Return the current hover point (cursor position in data space). */
  getHoverPoint(): ChartPoint | null {
    return getDebug()?.getHoverPoint() ?? null;
  }

  private dispatchKey(key: string): void {
    if (typeof window === "undefined") return;
    const overlay = document.querySelector<HTMLElement>("[aria-label='chart-drawing-overlay']");
    if (!overlay) return;
    const [modifier, ...rest] = key.split("+");
    const actualKey = rest.length ? rest.join("+") : modifier;
    const mods = rest.length ? modifier.toLowerCase() : "";
    const kbEvent = new KeyboardEvent("keydown", {
      key: actualKey,
      ctrlKey: mods.includes("control"),
      shiftKey: mods.includes("shift"),
      altKey: mods.includes("alt"),
      bubbles: true,
      cancelable: true,
    });
    overlay.dispatchEvent(kbEvent);
  }
}

// ── Module-level singleton helpers ────────────────────────────────────────────

let _instance: ChartLibraryAPI | null = null;

/**
 * Get (or create) the shared ChartLibraryAPI instance.
 *
 * This is the recommended entry point for library consumers.
 * The instance is reused across calls — call `destroy()` only when
 * the entire chart page is unmounted.
 *
 * @example
 * ```ts
 * import { getChartAPI } from "@/lib/chartLibraryAPI";
 *
 * const api = getChartAPI();
 * api.setActiveTool("trend");
 * const drawings = api.getDrawings();
 * ```
 */
export function getChartAPI(): ChartLibraryAPI {
  if (!_instance) _instance = new ChartLibraryAPI();
  return _instance;
}

/**
 * Destroy the shared instance (stop polling, remove all listeners).
 * Call this when the chart component unmounts.
 */
export function destroyChartAPI(): void {
  _instance?.destroy();
  _instance = null;
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * React hook that returns the chart API instance.
 * Safe to call before the chart is mounted — `api.isReady()` will return false.
 *
 * @example
 * ```tsx
 * function MyPanel() {
 *   const api = useChartAPI();
 *   return (
 *     <button onClick={() => api.setActiveTool("trend")}>
 *       Draw trend line
 *     </button>
 *   );
 * }
 * ```
 */
export function useChartAPI(): ChartLibraryAPI {
  return getChartAPI();
}

// ── Tool variant constants (for IDE autocomplete) ────────────────────────────

/** All 27 prod-parity tool variants (the ones covered by the 13,500 automation tests). */
export const PROD_PARITY_TOOLS = [
  "longPosition",
  "shortPosition",
  "positionForecast",
  "barPattern",
  "ghostFeed",
  "anchoredVwap",
  "fixedRangeVolumeProfile",
  "anchoredVolumeProfile",
  "priceRange",
  "dateRange",
  "dateAndPriceRange",
  "brush",
  "highlighter",
  "arrowMarker",
  "arrowTool",
  "arrowMarkUp",
  "arrowMarkDown",
  "rectangle",
  "rotatedRectangle",
  "path",
  "circle",
  "ellipse",
  "polyline",
  "triangle",
  "arc",
  "curveTool",
  "doubleCurve",
] as const;

export type ProdParityTool = typeof PROD_PARITY_TOOLS[number];

/** All supported tool variants. */
export const ALL_TOOL_VARIANTS = [
  ...PROD_PARITY_TOOLS,
  // Lines
  "trend", "ray", "infoLine", "extendedLine", "trendAngle",
  "hline", "horizontalRay", "vline", "crossLine",
  "channel", "regressionTrend", "flatTopBottom", "disjointChannel",
  // Fibonacci
  "fibRetracement", "fibExtension", "fibChannel", "fibTimeZone",
  "fibSpeedResistFan", "fibTrendTime", "fibCircles", "fibSpiral",
  "fibSpeedResistArcs", "fibWedge", "pitchfan",
  "pitchfork", "schiffPitchfork", "modifiedSchiffPitchfork", "insidePitchfork",
  // Gann
  "gannBox", "gannSquareFixed", "gannSquare", "gannFan",
  // Patterns
  "xabcd", "cypherPattern", "headAndShoulders", "abcdPattern",
  "trianglePattern", "threeDrives",
  "elliottImpulse", "elliottCorrection", "elliottTriangle",
  "elliottDoubleCombo", "elliottTripleCombo",
  "cyclicLines", "timeCycles", "sineLine",
  // Text / Notes
  "plainText", "anchoredText", "note", "priceNote", "pin", "table",
  "callout", "comment", "priceLabel", "signpost", "flagMark",
  "image", "post", "idea",
  // Icons
  "emoji", "sticker", "iconTool",
] as const;

export type AnyToolVariant = typeof ALL_TOOL_VARIANTS[number];
