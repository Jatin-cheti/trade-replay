/**
 * Core types for the tradereplay-charts drawing engine.
 *
 * All drawing logic lives in this library (library-first architecture).
 * React components delegate to the DrawingEngine rather than implementing
 * canvas drawing themselves.
 */

/** Unix timestamp in seconds (integer). */
export type UTCTimestamp = number & { readonly _brand: 'UTCTimestamp' };

/** A point in data space: bar time + price value. */
export interface DrawPoint {
  time: UTCTimestamp;
  price: number;
  /** Optional: pre-computed bar index in the visible data array for faster snapping. */
  barIndex?: number;
}

/** A point in canvas/screen pixel space. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** Axis-aligned bounding box in data space. */
export interface DataBounds {
  minTime: UTCTimestamp;
  maxTime: UTCTimestamp;
  minPrice: number;
  maxPrice: number;
}

/** Current viewport: how the chart maps data → screen coordinates. */
export interface Viewport {
  /** Width of the chart canvas in CSS pixels. */
  width: number;
  /** Height of the chart canvas in CSS pixels. */
  height: number;
  /** Width of the price (Y) axis panel in pixels. */
  priceAxisWidth: number;
  /** Height of the time (X) axis panel in pixels. */
  timeAxisHeight: number;
  /** The earliest visible time value on screen. */
  visibleFrom: UTCTimestamp;
  /** The latest visible time value on screen. */
  visibleTo: UTCTimestamp;
  /** The lowest visible price on screen (bottom of chart). */
  priceMin: number;
  /** The highest visible price on screen (top of chart). */
  priceMax: number;
  /** Pixel width per time unit (seconds). For bar-based charts this is barWidthPx / barIntervalSecs. */
  pxPerTime: number;
  /** Pixel height per one unit of price. Positive = price up → y decreases. */
  pxPerPrice: number;
  /** Canvas X pixel for the leftmost visible data point. */
  originX: number;
  /** Canvas Y pixel that corresponds to price 0. */
  originY: number;
}

/** Represents a single persistent drawing on the chart. */
export interface Drawing {
  /** Unique identifier. */
  id: string;
  /** Tool variant that created this drawing. */
  variant: DrawingVariant;
  /** Anchor points in data space. Most line tools have 2 anchors. */
  anchors: DrawPoint[];
  /** Tool-specific style options. */
  options: DrawingOptions;
  /** Whether this drawing is visible. */
  visible: boolean;
  /** Whether edits/moves are locked. */
  locked: boolean;
  /** Optional label text for text-type tools. */
  text?: string;
  /** Whether this drawing is currently selected. */
  selected?: boolean;
  /** Cached bounding box for fast viewport culling. */
  bounds?: DataBounds;
  /** Render layer index (higher = on top). */
  zIndex?: number;
  /** Monotonically-increasing creation counter for stable sort within same z-index. */
  renderOrder?: number;
}

/** Style options common to all drawing tools. */
export interface DrawingOptions {
  /** Line/stroke color as CSS hex string. */
  color: string;
  /** Line width in pixels. */
  lineWidth: number;
  /** Line style. */
  lineStyle: 'solid' | 'dashed' | 'dotted' | 'large-dashed' | 'sparse-dotted';
  /** Show a price label on the Y-axis. */
  showLabel: boolean;
  /** Show price label on the axis (left or right). */
  axisLabel: boolean;
  /** Fill color for shape tools (rgba or hex with alpha). */
  fillColor?: string;
  /** Extend line left beyond the first anchor. */
  extendLeft?: boolean;
  /** Extend line right beyond the last anchor. */
  extendRight?: boolean;
  /** Ray direction: 'forward' or 'backward'. */
  rayMode?: 'forward' | 'backward';
  /** Whether to snap placement to OHLC. */
  snapMode?: 'off' | 'ohlc' | 'candle';
  /** Border/outline for shape tools. */
  border?: boolean;
  /** Font for text-type tools. */
  font?: string;
  /** Text size in px. */
  textSize?: number;
  /** Bold text. */
  bold?: boolean;
  /** Italic text. */
  italic?: boolean;
  /** Text alignment. */
  align?: 'left' | 'center' | 'right';
  /** Show text background box. */
  textBackground?: boolean;
  /** Show text border. */
  textBorder?: boolean;
  /** Fib/Gann: explicit list of levels to render (e.g., [0, 0.382, 0.618, 1]). */
  fibLevels?: number[];
  /** Fib/Gann: how level labels are formatted. */
  fibLabelMode?: 'ratio-price' | 'price' | 'percent' | 'ratio';
  /** Fib/Gann: show price-tagged labels at each level. */
  priceLabel?: boolean;
  /** Fib/Gann: stroke/fill alpha (0..1). */
  opacity?: number;
}

/** Supported drawing tool variants. */
export type DrawingVariant =
  | 'trend'
  | 'ray'
  | 'infoLine'
  | 'extendedLine'
  | 'trendAngle'
  | 'hline'
  | 'horizontalRay'
  | 'vline'
  | 'crossLine'
  | 'channel'
  | 'regressionTrend'
  | 'rectangle'
  | 'brush'
  | 'highlighter'
  | 'arrowTool'
  | 'arrowMarker'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'path'
  | 'polyline'
  | 'arc'
  | 'curveTool'
  | 'doubleCurve'
  | 'plainText'
  | 'anchoredText'
  | 'note'
  | 'priceLabel'
  | 'fibRetracement'
  | 'fibExtension'
  | 'fibChannel'
  | 'fibTimeZone'
  | 'fibSpeedResistFan'
  | 'fibTrendTime'
  | 'fibCircles'
  | 'fibSpiral'
  | 'fibSpeedResistArcs'
  | 'fibWedge'
  | 'pitchfan'
  | 'parallelChannel'
  | 'disjointChannel'
  | 'flatTopBottom'
  | 'sineLine'
  | 'gannBox'
  | 'gannSquareFixed'
  | 'gannSquare'
  | 'gannFan'
  | 'longPosition'
  | 'shortPosition';

/** Drawing state machine states. */
export const DrawingState = {
  /** No active drawing, nothing selected. */
  IDLE: 'IDLE',
  /** First anchor placed, waiting for second pointer position. */
  STARTED: 'STARTED',
  /** Dragging with live preview of the drawing. */
  PREVIEW: 'PREVIEW',
  /** Drawing completed and committed to the list. */
  COMPLETED: 'COMPLETED',
  /** A committed drawing is selected (handles shown). */
  SELECTED: 'SELECTED',
  /** User is dragging a handle to edit an anchor. */
  EDITING: 'EDITING',
} as const;
export type DrawingState = typeof DrawingState[keyof typeof DrawingState];

/** Information about a drawing that was hit during pointer interaction. */
export interface HitResult {
  /** The drawing that was hit, or null for a miss. */
  drawing: Drawing | null;
  /** Anchor index that was hit (for edit mode), -1 if body hit. */
  anchorIndex: number;
  /** Distance in pixels from pointer to the nearest part of the drawing. */
  distancePx: number;
}

/**
 * Axis highlight ranges for a selected drawing.
 *
 * TV parity: when a drawing is selected, light-blue bands appear on:
 * - the time (X) axis covering the horizontal pixel range spanned by the drawing
 * - the price (Y) axis covering the vertical pixel range spanned by the drawing
 *
 * Either range can be null if the drawing does not bound that axis
 * (e.g., HorizontalLine has no xRange, VerticalLine has no yRange).
 */
export interface AxisHighlight {
  /** Pixel range [start, end] on the X (time) axis, or null if drawing is horizontally infinite. */
  xRange: [number, number] | null;
  /** Pixel range [start, end] on the Y (price) axis, or null if drawing is vertically infinite. */
  yRange: [number, number] | null;
}

/** Handle descriptor for rendering interactive anchor handles. */
export interface HandleDescriptor {
  /** Anchor index this handle corresponds to. */
  anchorIndex: number;
  /** Center of the handle in screen space. */
  center: ScreenPoint;
  /** Handle radius in pixels. */
  radius: number;
  /** Whether this handle is currently being dragged. */
  active: boolean;
}

/** Interface every drawing tool must implement. */
export interface IDrawingTool {
  /** Unique identifier matching DrawingVariant. */
  readonly variant: DrawingVariant;
  /** Human-readable name. */
  readonly label: string;
  /** Number of anchor points required. */
  readonly anchorCount: number;
  /** Whether the tool only needs one click (point-only). */
  readonly isPointOnly: boolean;

  /**
   * Create a new drawing with an initial anchor.
   * The second anchor is set to the same position initially (updated during preview).
   */
  createDraft(p1: DrawPoint, options: DrawingOptions): Drawing;

  /**
   * Update the in-progress draft as the pointer moves.
   * Returns a new drawing with updated anchors.
   */
  updateDraft(draft: Drawing, pointer: DrawPoint): Drawing;

  /**
   * Validate and finalize a completed draft before committing.
   * Returns null if the drawing should be discarded (e.g., zero-length line).
   */
  finalize(draft: Drawing): Drawing | null;

  /**
   * Hit test: determine if a point is close enough to this drawing to select/click it.
   * Returns distance in pixels, or Infinity for a miss.
   */
  hitTest(drawing: Drawing, pointer: ScreenPoint, viewport: Viewport): number;

  /**
   * Get the screen-space handles for this drawing (shown when selected).
   */
  getHandles(drawing: Drawing, viewport: Viewport): HandleDescriptor[];

  /**
   * Render this drawing to a canvas context.
   * Called every frame for visible drawings.
   */
  render(ctx: CanvasRenderingContext2D, drawing: Drawing, viewport: Viewport, selected: boolean, hovered: boolean): void;

  /**
   * Render a live preview while the drawing is in progress.
   * Called every pointer-move while state = PREVIEW.
   */
  renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void;

  /**
   * Optional: compute axis highlight ranges for this drawing (TV parity).
   * Returns null if the tool does not produce axis highlights.
   */
  getAxisHighlight?(drawing: Drawing, viewport: Viewport): AxisHighlight | null;
}

/** Default drawing options for new drawings. */
export const DEFAULT_DRAWING_OPTIONS: DrawingOptions = {
  color: '#2962ff',
  lineWidth: 1,
  lineStyle: 'solid',
  showLabel: true,
  axisLabel: true,
  extendLeft: false,
  extendRight: false,
  snapMode: 'ohlc',
};
