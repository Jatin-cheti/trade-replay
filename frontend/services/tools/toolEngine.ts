import type { UTCTimestamp } from '@tradereplay/charts';
import { buildToolOptions, getToolDefinition, type BoundingBox, type DrawPoint, type Drawing, type ToolFamily, type ToolVariant } from './toolRegistry.ts';
import type { ToolOptions } from './toolOptions.ts';
import { interpolateDrawPoint } from './drawingGeometry.ts';

export function isWizardVariant(variant: ToolVariant): boolean {
  const definition = getToolDefinition(variant);
  return Boolean(definition && definition.family === 'pattern' && definition.capabilities.anchors > 2);
}

export function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const HIT_TEST_TIME_SCALE = 172800;
const HIT_TEST_PRICE_SCALE_FLOOR = 0.5;
let DRAWING_RENDER_ORDER_SEQ = 0;

const FAMILY_Z_INDEX: Record<ToolFamily, number> = {
  line: 20,
  fib: 25,
  pattern: 30,
  shape: 35,
  measure: 40,
  position: 45,
  text: 50,
  system: 10,
};

const FAMILY_INTERACTION_PRIORITY: Record<ToolFamily, number> = {
  line: 20,
  fib: 24,
  pattern: 28,
  shape: 32,
  measure: 36,
  position: 40,
  text: 44,
  system: 10,
};

function drawingBounds(anchors: DrawPoint[]): BoundingBox | undefined {
  if (!anchors.length) return undefined;
  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = Number.NEGATIVE_INFINITY;

  for (const anchor of anchors) {
    const time = Number(anchor.time);
    const price = anchor.price;
    if (!Number.isFinite(time) || !Number.isFinite(price)) continue;
    minTime = Math.min(minTime, time);
    maxTime = Math.max(maxTime, time);
    minPrice = Math.min(minPrice, price);
    maxPrice = Math.max(maxPrice, price);
  }

  if (!Number.isFinite(minTime) || !Number.isFinite(maxTime) || !Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
    return undefined;
  }

  return {
    minTime,
    maxTime,
    minPrice,
    maxPrice,
  };
}

function resolveDrawingLayerDefaults(variant: Exclude<ToolVariant, 'none'>, family: ToolFamily): { zIndex: number; interactionPriority: number } {
  const definition = getToolDefinition(variant);
  const familyKey = definition?.family ?? family;
  let zIndex = FAMILY_Z_INDEX[familyKey] ?? 20;
  let interactionPriority = FAMILY_INTERACTION_PRIORITY[familyKey] ?? 20;

  if (variant === 'priceLabel' || variant === 'plainText' || variant === 'anchoredText' || variant === 'emoji' || variant === 'sticker' || variant === 'iconTool') {
    zIndex += 10;
    interactionPriority += 10;
  }
  if (variant === 'longPosition' || variant === 'shortPosition') {
    zIndex += 6;
    interactionPriority += 6;
  }

  return { zIndex, interactionPriority };
}

export function normalizeDrawing(drawing: Drawing, fallbackRenderOrder?: number): Drawing {
  const layerDefaults = resolveDrawingLayerDefaults(drawing.variant, drawing.type);
  const renderOrder = Number.isFinite(drawing.renderOrder) && drawing.renderOrder > 0
    ? drawing.renderOrder
    : (fallbackRenderOrder && fallbackRenderOrder > 0 ? fallbackRenderOrder : ++DRAWING_RENDER_ORDER_SEQ);

  if (renderOrder > DRAWING_RENDER_ORDER_SEQ) {
    DRAWING_RENDER_ORDER_SEQ = renderOrder;
  }

  return {
    ...drawing,
    zIndex: Number.isFinite(drawing.zIndex) ? drawing.zIndex : layerDefaults.zIndex,
    renderOrder,
    interactionPriority: Number.isFinite(drawing.interactionPriority)
      ? drawing.interactionPriority
      : layerDefaults.interactionPriority,
    bounds: drawingBounds(drawing.anchors),
  };
}

export function normalizeDrawings(drawings: Drawing[]): Drawing[] {
  return drawings.map((drawing, index) => normalizeDrawing(drawing, index + 1));
}

export function compareDrawingRenderOrder(left: Drawing, right: Drawing): number {
  if (left.zIndex !== right.zIndex) return left.zIndex - right.zIndex;
  if (left.renderOrder !== right.renderOrder) return left.renderOrder - right.renderOrder;
  if (left.interactionPriority !== right.interactionPriority) return left.interactionPriority - right.interactionPriority;
  return left.id.localeCompare(right.id);
}

export function compareDrawingInteractionOrder(left: Drawing, right: Drawing): number {
  if (left.zIndex !== right.zIndex) return right.zIndex - left.zIndex;
  if (left.interactionPriority !== right.interactionPriority) return right.interactionPriority - left.interactionPriority;
  if (left.renderOrder !== right.renderOrder) return right.renderOrder - left.renderOrder;
  return right.id.localeCompare(left.id);
}

type TimeLike = UTCTimestamp | string | { year: number; month: number; day: number };

export function toTimestampFromTime(value: TimeLike | null): UTCTimestamp | null {
  if (value == null) return null;
  if (typeof value === 'number') return value as UTCTimestamp;
  if (typeof value === 'string') {
    const parsed = Math.floor(new Date(value).getTime() / 1000);
    return Number.isFinite(parsed) ? (parsed as UTCTimestamp) : null;
  }
  if (typeof value === 'object' && 'year' in value && 'month' in value && 'day' in value) {
    return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 1000) as UTCTimestamp;
  }
  return null;
}

export function nearestCandleIndex(times: UTCTimestamp[], target: UTCTimestamp): number {
  if (!times.length) return -1;
  let lo = 0;
  let hi = times.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] === target) return mid;
    if (times[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  const left = Math.max(0, hi);
  const right = Math.min(times.length - 1, lo);
  return Math.abs(times[left] - target) <= Math.abs(times[right] - target) ? left : right;
}

export function isPointOnlyVariant(variant: ToolVariant): boolean {
  const def = getToolDefinition(variant);
  return Boolean(def && def.capabilities.anchors <= 1);
}

// TV-parity: variants that use CLICK-CLICK drawing (click once to start, move
// freely with no button pressed, click again to finish). Applies to 2-anchor
// "line" family tools. Point-only (hline/vline/crossLine/horizontalRay) commit
// on the single click; pattern/wizard (>=3 anchors) use multi-click via the
// existing wizard pathway in useTools.
export function isClickClickVariant(variant: ToolVariant): boolean {
  const def = getToolDefinition(variant);
  if (!def) return false;
  if (def.family !== 'line') return false;
  return def.capabilities.anchors === 2;
}

export function createDrawing(variant: Exclude<ToolVariant, 'none'>, options: ToolOptions, p1: DrawPoint, p2?: DrawPoint, text?: string): Drawing {
  const definition = getToolDefinition(variant);
  const anchorCount = definition?.capabilities.anchors ?? 2;
  const anchors: DrawPoint[] = [p1];
  while (anchors.length < anchorCount) {
    anchors.push(p2 || p1);
  }

  const layerDefaults = resolveDrawingLayerDefaults(variant, definition?.family ?? 'line');
  const renderOrder = ++DRAWING_RENDER_ORDER_SEQ;

  return normalizeDrawing({
    id: makeId(),
    type: definition?.family ?? 'line',
    variant,
    anchors,
    bounds: drawingBounds(anchors),
    text,
    options: { ...buildToolOptions(variant), ...options },
    zIndex: layerDefaults.zIndex,
    renderOrder,
    interactionPriority: layerDefaults.interactionPriority,
    selected: false,
    locked: options.locked,
    visible: options.visible,
  }, renderOrder);
}

export function updateDraftDrawing(draft: Drawing, point: DrawPoint, activeAnchorIndex?: number): Drawing {
  const withAnchors = (anchors: DrawPoint[]): Drawing => normalizeDrawing({ ...draft, anchors }, draft.renderOrder);

  if (isWizardVariant(draft.variant)) {
    const anchors = [...draft.anchors];
    const targetIndex = Math.max(1, Math.min(anchors.length - 1, activeAnchorIndex ?? anchors.length - 1));
    anchors[targetIndex] = point;
    for (let index = targetIndex + 1; index < anchors.length; index += 1) {
      anchors[index] = point;
    }
    return withAnchors(anchors);
  }

  if (draft.variant === 'brush' || draft.variant === 'highlighter') {
    const last = draft.anchors[draft.anchors.length - 1];
    const smoothness = Math.max(0, Math.min(1, Number(draft.options.brushSmoothness) || 0));
    const minTimeDelta = Math.max(0.5, smoothness * 2.2);
    const minPriceDelta = Math.max(0.00005, Math.abs(point.price) * (0.00001 + smoothness * 0.00006));

    if (
      last
      && Math.abs(last.time - point.time) < minTimeDelta
      && Math.abs(last.price - point.price) < minPriceDelta
    ) {
      return draft;
    }
    return withAnchors([...draft.anchors, point]);
  }

  const definition = getToolDefinition(draft.variant);
  if (definition?.family === 'position' && draft.anchors.length >= 3) {
    const entry = draft.anchors[0];
    const mirrored = {
      time: point.time,
      price: entry.price - (point.price - entry.price),
    };
    return withAnchors([entry, { time: point.time, price: point.price }, mirrored]);
  }

  const anchors = [...draft.anchors];
  if (anchors.length > 2) {
    const first = anchors[0];
    const lastIndex = anchors.length - 1;
    for (let index = 1; index < lastIndex; index += 1) {
      anchors[index] = interpolateDrawPoint(first, point, index / lastIndex);
    }
    anchors[lastIndex] = point;
    return withAnchors(anchors);
  }

  anchors[anchors.length - 1] = point;
  return withAnchors(anchors);
}

type NormalizedPoint = { x: number; y: number };
type SelectionIntent = 'select' | 'erase';

type HitTestStats = {
  enabled: boolean;
  count: number;
  totalMs: number;
  maxMs: number;
  avgMs: number;
  totalCandidates: number;
  maxCandidates: number;
  avgCandidates: number;
  selectCount: number;
  selectAvgMs: number;
  selectMaxMs: number;
  eraseCount: number;
  eraseAvgMs: number;
  eraseMaxMs: number;
};

type MutableHitTestStats = {
  enabled: boolean;
  count: number;
  totalMs: number;
  maxMs: number;
  totalCandidates: number;
  maxCandidates: number;
  selectCount: number;
  selectTotalMs: number;
  selectMaxMs: number;
  eraseCount: number;
  eraseTotalMs: number;
  eraseMaxMs: number;
};

type HitTestGlobal = typeof globalThis & {
  __TRADEREPLAY_HITTEST_DEBUG__?: MutableHitTestStats;
};

function makeHitTestStats(enabled = false): MutableHitTestStats {
  return {
    enabled,
    count: 0,
    totalMs: 0,
    maxMs: 0,
    totalCandidates: 0,
    maxCandidates: 0,
    selectCount: 0,
    selectTotalMs: 0,
    selectMaxMs: 0,
    eraseCount: 0,
    eraseTotalMs: 0,
    eraseMaxMs: 0,
  };
}

function hitTestStore(create: boolean): MutableHitTestStats | null {
  const g = globalThis as HitTestGlobal;
  if (!g.__TRADEREPLAY_HITTEST_DEBUG__) {
    if (!create) return null;
    g.__TRADEREPLAY_HITTEST_DEBUG__ = makeHitTestStats(false);
  }
  return g.__TRADEREPLAY_HITTEST_DEBUG__;
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function setHitTestTelemetryEnabled(enabled: boolean): void {
  const store = hitTestStore(true);
  if (!store) return;
  store.enabled = enabled;
}

export function resetHitTestTelemetry(): void {
  const store = hitTestStore(true);
  if (!store) return;
  const enabled = store.enabled;
  Object.assign(store, makeHitTestStats(enabled));
}

export function getHitTestTelemetrySnapshot(): HitTestStats {
  const store = hitTestStore(false) ?? makeHitTestStats(false);
  const avgMs = store.count > 0 ? store.totalMs / store.count : 0;
  const avgCandidates = store.count > 0 ? store.totalCandidates / store.count : 0;
  const selectAvgMs = store.selectCount > 0 ? store.selectTotalMs / store.selectCount : 0;
  const eraseAvgMs = store.eraseCount > 0 ? store.eraseTotalMs / store.eraseCount : 0;
  return {
    enabled: store.enabled,
    count: store.count,
    totalMs: store.totalMs,
    maxMs: store.maxMs,
    avgMs,
    totalCandidates: store.totalCandidates,
    maxCandidates: store.maxCandidates,
    avgCandidates,
    selectCount: store.selectCount,
    selectAvgMs,
    selectMaxMs: store.selectMaxMs,
    eraseCount: store.eraseCount,
    eraseAvgMs,
    eraseMaxMs: store.eraseMaxMs,
  };
}

function normalizePoint(point: DrawPoint, timeScale: number, priceScale: number): NormalizedPoint {
  return {
    x: Number(point.time) / timeScale,
    y: point.price / priceScale,
  };
}

function distance(a: NormalizedPoint, b: NormalizedPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointToSegmentDistance(point: NormalizedPoint, start: NormalizedPoint, end: NormalizedPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const span = dx * dx + dy * dy;
  if (span === 0) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / span));
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

function pointToRayDistance(point: NormalizedPoint, start: NormalizedPoint, through: NormalizedPoint): number {
  const dx = through.x - start.x;
  const dy = through.y - start.y;
  const span = dx * dx + dy * dy;
  if (span === 0) return distance(point, start);
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / span;
  if (t < 0) return distance(point, start) + Math.abs(t);
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

function pointToLineDistance(point: NormalizedPoint, start: NormalizedPoint, end: NormalizedPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const span = Math.hypot(dx, dy);
  if (span === 0) return distance(point, start);
  return Math.abs(((point.x - start.x) * dy - (point.y - start.y) * dx) / span);
}

function pointToRectDistance(point: NormalizedPoint, a: NormalizedPoint, b: NormalizedPoint): number {
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);

  if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) return 0;

  const dx = point.x < left ? left - point.x : point.x > right ? point.x - right : 0;
  const dy = point.y < top ? top - point.y : point.y > bottom ? point.y - bottom : 0;
  return Math.hypot(dx, dy);
}

function pointToCircleDistance(point: NormalizedPoint, center: NormalizedPoint, edge: NormalizedPoint): number {
  const radius = Math.max(1e-6, distance(center, edge));
  const dist = distance(point, center);
  if (dist <= radius) return 0;
  return dist - radius;
}

function signedDistanceToLine(point: NormalizedPoint, start: NormalizedPoint, end: NormalizedPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const span = Math.hypot(dx, dy);
  if (span === 0) return 0;
  return ((point.x - start.x) * dy - (point.y - start.y) * dx) / span;
}

function scorePolyline(point: NormalizedPoint, anchors: NormalizedPoint[]): number {
  if (anchors.length === 0) return Number.POSITIVE_INFINITY;
  if (anchors.length === 1) return distance(point, anchors[0]);

  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < anchors.length - 1; index += 1) {
    best = Math.min(best, pointToSegmentDistance(point, anchors[index], anchors[index + 1]));
  }
  return best;
}

function scoreLineLikeDrawing(drawing: Drawing, point: DrawPoint): number {
  const timeScale = HIT_TEST_TIME_SCALE;
  const priceScale = Math.max(HIT_TEST_PRICE_SCALE_FLOOR, Math.abs(point.price) * 0.03);
  const normalizedPoint = normalizePoint(point, timeScale, priceScale);
  const anchors = drawing.anchors.map((anchor) => normalizePoint(anchor, timeScale, priceScale));
  const definition = getToolDefinition(drawing.variant);

  if (!anchors.length) return Number.POSITIVE_INFINITY;

  const [a, b, c, d] = anchors;
  const variant = drawing.variant;

  if (variant === 'hline') {
    return Math.abs(normalizedPoint.y - a.y);
  }

  if (variant === 'horizontalRay') {
    const score = Math.abs(normalizedPoint.y - a.y);
    return normalizedPoint.x < a.x ? score + (a.x - normalizedPoint.x) : score;
  }

  if (variant === 'vline') {
    return Math.abs(normalizedPoint.x - a.x);
  }

  if (variant === 'crossLine') {
    return Math.min(Math.abs(normalizedPoint.y - a.y), Math.abs(normalizedPoint.x - a.x));
  }

  if (variant === 'ray' && a && b) {
    return pointToRayDistance(normalizedPoint, a, b);
  }

  if (drawing.options.rayMode && a && b) {
    return pointToRayDistance(normalizedPoint, a, b);
  }

  if (drawing.options.extendLeft || drawing.options.extendRight) {
    if (a && b) return pointToLineDistance(normalizedPoint, a, b);
  }

  if (variant === 'channel' && a && b) {
    const span = Math.max(0.1, distance(a, b));
    const offset = span * 0.24;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / magnitude, y: dx / magnitude };
    const upperStart = { x: a.x + normal.x * offset, y: a.y + normal.y * offset };
    const upperEnd = { x: b.x + normal.x * offset, y: b.y + normal.y * offset };
    const lowerStart = { x: a.x - normal.x * offset, y: a.y - normal.y * offset };
    const lowerEnd = { x: b.x - normal.x * offset, y: b.y - normal.y * offset };
    return Math.min(
      pointToLineDistance(normalizedPoint, a, b),
      pointToLineDistance(normalizedPoint, upperStart, upperEnd),
      pointToLineDistance(normalizedPoint, lowerStart, lowerEnd),
    );
  }

  if (variant === 'regressionTrend' && a && b) {
    return pointToSegmentDistance(normalizedPoint, a, b);
  }

  if (variant === 'flatTopBottom' && a && b) {
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    if (normalizedPoint.y >= top && normalizedPoint.y <= bottom) return 0;
    return Math.min(Math.abs(normalizedPoint.y - top), Math.abs(normalizedPoint.y - bottom));
  }

  if (variant === 'disjointChannel' && a && b && c && d) {
    return Math.min(
      pointToSegmentDistance(normalizedPoint, a, b),
      pointToSegmentDistance(normalizedPoint, c, d),
      pointToSegmentDistance(normalizedPoint, a, c),
      pointToSegmentDistance(normalizedPoint, b, d),
    );
  }

  if (variant === 'pitchfork' && a && b && c) {
    const target = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const offsetUpper = signedDistanceToLine(b, a, target);
    const offsetLower = signedDistanceToLine(c, a, target);
    const dx = target.x - a.x;
    const dy = target.y - a.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / magnitude, y: dx / magnitude };
    const upperStart = { x: a.x + normal.x * offsetUpper, y: a.y + normal.y * offsetUpper };
    const upperEnd = { x: target.x + normal.x * offsetUpper, y: target.y + normal.y * offsetUpper };
    const lowerStart = { x: a.x + normal.x * offsetLower, y: a.y + normal.y * offsetLower };
    const lowerEnd = { x: target.x + normal.x * offsetLower, y: target.y + normal.y * offsetLower };
    return Math.min(
      pointToRayDistance(normalizedPoint, a, target),
      pointToRayDistance(normalizedPoint, upperStart, upperEnd),
      pointToRayDistance(normalizedPoint, lowerStart, lowerEnd),
    );
  }

  if (variant === 'schiffPitchfork' && a && b && c) {
    const origin = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const target = c;
    const offsetUpper = signedDistanceToLine(a, origin, target);
    const offsetLower = signedDistanceToLine(b, origin, target);
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / magnitude, y: dx / magnitude };
    const upperStart = { x: origin.x + normal.x * offsetUpper, y: origin.y + normal.y * offsetUpper };
    const upperEnd = { x: target.x + normal.x * offsetUpper, y: target.y + normal.y * offsetUpper };
    const lowerStart = { x: origin.x + normal.x * offsetLower, y: origin.y + normal.y * offsetLower };
    const lowerEnd = { x: target.x + normal.x * offsetLower, y: target.y + normal.y * offsetLower };
    return Math.min(
      pointToRayDistance(normalizedPoint, origin, target),
      pointToRayDistance(normalizedPoint, upperStart, upperEnd),
      pointToRayDistance(normalizedPoint, lowerStart, lowerEnd),
    );
  }

  if (variant === 'modifiedSchiffPitchfork' && a && b && c) {
    const origin = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const target = c;
    const offsetUpper = signedDistanceToLine(a, origin, target) * 0.82;
    const offsetLower = signedDistanceToLine(b, origin, target) * 0.82;
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / magnitude, y: dx / magnitude };
    const upperStart = { x: origin.x + normal.x * offsetUpper, y: origin.y + normal.y * offsetUpper };
    const upperEnd = { x: target.x + normal.x * offsetUpper, y: target.y + normal.y * offsetUpper };
    const lowerStart = { x: origin.x + normal.x * offsetLower, y: origin.y + normal.y * offsetLower };
    const lowerEnd = { x: target.x + normal.x * offsetLower, y: target.y + normal.y * offsetLower };
    return Math.min(
      pointToRayDistance(normalizedPoint, origin, target),
      pointToRayDistance(normalizedPoint, upperStart, upperEnd),
      pointToRayDistance(normalizedPoint, lowerStart, lowerEnd),
    );
  }

  if (variant === 'insidePitchfork' && a && b && c) {
    const origin = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const target = c;
    const offsetUpper = signedDistanceToLine(a, origin, target) * 0.62;
    const offsetLower = signedDistanceToLine(b, origin, target) * 0.62;
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / magnitude, y: dx / magnitude };
    const upperStart = { x: origin.x + normal.x * offsetUpper, y: origin.y + normal.y * offsetUpper };
    const upperEnd = { x: target.x + normal.x * offsetUpper, y: target.y + normal.y * offsetUpper };
    const lowerStart = { x: origin.x + normal.x * offsetLower, y: origin.y + normal.y * offsetLower };
    const lowerEnd = { x: target.x + normal.x * offsetLower, y: target.y + normal.y * offsetLower };
    return Math.min(
      pointToRayDistance(normalizedPoint, origin, target),
      pointToRayDistance(normalizedPoint, upperStart, upperEnd),
      pointToRayDistance(normalizedPoint, lowerStart, lowerEnd),
    );
  }

  if (variant === 'fibCircles' && a && b) {
    return pointToCircleDistance(normalizedPoint, a, b);
  }

  if (variant === 'fibTimeZone' && a && b) {
    const spacing = Math.abs(b.x - a.x);
    if (spacing > 1e-6) {
      const sequence = [1, 2, 3, 5, 8, 13];
      let best = Number.POSITIVE_INFINITY;
      for (const n of sequence) {
        best = Math.min(best, Math.abs(normalizedPoint.x - (a.x + spacing * n)));
      }
      return best;
    }
  }

  if (variant === 'fibTrendTime' && a && b) {
    const base = pointToSegmentDistance(normalizedPoint, a, b);
    const spacing = Math.abs(b.x - a.x);
    if (spacing > 1e-6) {
      const sequence = [1, 2, 3, 5, 8];
      let bestVertical = Number.POSITIVE_INFINITY;
      for (const n of sequence) {
        bestVertical = Math.min(bestVertical, Math.abs(normalizedPoint.x - (b.x + spacing * n)));
      }
      return Math.min(base, bestVertical);
    }
    return base;
  }

  if ((variant === 'gannBox' || variant === 'gannSquare' || variant === 'gannSquareFixed' || variant === 'fixedRangeVolumeProfile') && a && b) {
    return pointToRectDistance(normalizedPoint, a, b);
  }

  if (variant === 'anchoredVolumeProfile' && a) {
    const approxB = { x: a.x + 0.22, y: a.y + 0.4 };
    return pointToRectDistance(normalizedPoint, { x: a.x, y: a.y - 0.4 }, approxB);
  }

  if (variant === 'anchoredVwap' && anchors.length >= 1) {
    return distance(normalizedPoint, anchors[0]);
  }

  if (definition?.family === 'text') {
    const anchor = anchors[0];
    const text = (drawing.text && drawing.text.trim()) || drawing.variant;
    const fontSize = Math.max(10, Number(drawing.options.textSize) || 14);
    const pad = Math.max(3, Number(drawing.options.textPadding) || 4);
    const approxWidthPx = Math.max(fontSize * 0.9, text.length * fontSize * 0.58);
    const align = drawing.options.align ?? 'left';
    const anchorX = anchor.x + 4 / timeScale;
    const anchorY = anchor.y - 4 / priceScale;
    let leftX = anchorX;
    if (align === 'center') {
      leftX -= (approxWidthPx / 2) / timeScale;
    } else if (align === 'right') {
      leftX -= approxWidthPx / timeScale;
    }
    const topY = anchorY - (fontSize + pad) / priceScale;
    const rightX = leftX + (approxWidthPx + pad * 2) / timeScale;
    const bottomY = anchorY + pad / priceScale;
    const boxScore = pointToRectDistance(normalizedPoint, { x: leftX, y: topY }, { x: rightX, y: bottomY });
    return Math.min(boxScore, distance(normalizedPoint, anchor));
  }

  if (definition?.family === 'position' && a && b) {
    const third = anchors[2] ?? { x: b.x, y: a.y - (b.y - a.y) };
    const left = Math.min(a.x, b.x, third.x);
    const right = Math.max(a.x, b.x, third.x);
    const top = Math.min(b.y, third.y);
    const bottom = Math.max(b.y, third.y);
    const entryDistance = Math.abs(normalizedPoint.y - a.y);
    const bodyDistance = pointToRectDistance(normalizedPoint, { x: left, y: top }, { x: right, y: bottom });
    return Math.min(entryDistance, bodyDistance);
  }

  if ((definition?.family === 'shape' || definition?.family === 'measure') && a && b) {
    if (definition.behaviors?.shapeKind === 'circle') {
      return pointToCircleDistance(normalizedPoint, a, b);
    }
    return pointToRectDistance(normalizedPoint, a, b);
  }

  return scorePolyline(normalizedPoint, anchors);
}

type SpatialBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type SpatialEntry = {
  id: string;
  drawing: Drawing;
  bounds: SpatialBounds;
};

type SpatialNode = {
  bounds: SpatialBounds;
  depth: number;
  entries: SpatialEntry[];
  children: [SpatialNode, SpatialNode, SpatialNode, SpatialNode] | null;
};

export type DrawingSpatialIndexStats = {
  indexedCount: number;
  fallbackCount: number;
  nodeCount: number;
  depth: number;
};

export type HitTestResult = {
  id: string | null;
  score: number;
  limit: number;
  candidateCount: number;
  scannedCount: number;
};

type HitTestOptions = {
  intent?: SelectionIntent;
  spatialIndex?: DrawingSpatialIndex | null;
  preferredIds?: string[];
  includeIds?: Set<string> | null;
};

const MAX_SPATIAL_DEPTH = 7;
const MAX_SPATIAL_ENTRIES = 18;
const SPATIAL_QUERY_EXPANSION = 1.35;

const UNBOUNDED_VARIANTS = new Set<ToolVariant>([
  'hline',
  'horizontalRay',
  'vline',
  'crossLine',
  'ray',
  'fibTimeZone',
  'fibTrendTime',
]);

function createBounds(minX: number, minY: number, maxX: number, maxY: number): SpatialBounds {
  return {
    minX: Math.min(minX, maxX),
    minY: Math.min(minY, maxY),
    maxX: Math.max(minX, maxX),
    maxY: Math.max(minY, maxY),
  };
}

function normalizeBounds(bounds: SpatialBounds): SpatialBounds {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const padX = width <= 1e-6 ? 1 : 0;
  const padY = height <= 1e-9 ? Math.max(0.05, Math.abs(bounds.maxY) * 0.002) : 0;
  return {
    minX: bounds.minX - padX,
    minY: bounds.minY - padY,
    maxX: bounds.maxX + padX,
    maxY: bounds.maxY + padY,
  };
}

function mergeBounds(a: SpatialBounds, b: SpatialBounds): SpatialBounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function intersectsBounds(a: SpatialBounds, b: SpatialBounds): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function containsBounds(outer: SpatialBounds, inner: SpatialBounds): boolean {
  return (
    inner.minX >= outer.minX
    && inner.maxX <= outer.maxX
    && inner.minY >= outer.minY
    && inner.maxY <= outer.maxY
  );
}

function createSpatialNode(bounds: SpatialBounds, depth: number): SpatialNode {
  return {
    bounds,
    depth,
    entries: [],
    children: null,
  };
}

function splitSpatialNode(node: SpatialNode): [SpatialNode, SpatialNode, SpatialNode, SpatialNode] {
  const midX = (node.bounds.minX + node.bounds.maxX) / 2;
  const midY = (node.bounds.minY + node.bounds.maxY) / 2;
  const depth = node.depth + 1;
  return [
    createSpatialNode(createBounds(node.bounds.minX, node.bounds.minY, midX, midY), depth),
    createSpatialNode(createBounds(midX, node.bounds.minY, node.bounds.maxX, midY), depth),
    createSpatialNode(createBounds(node.bounds.minX, midY, midX, node.bounds.maxY), depth),
    createSpatialNode(createBounds(midX, midY, node.bounds.maxX, node.bounds.maxY), depth),
  ];
}

function childForEntry(node: SpatialNode, entry: SpatialEntry): SpatialNode | null {
  if (!node.children) return null;
  for (const child of node.children) {
    if (containsBounds(child.bounds, entry.bounds)) {
      return child;
    }
  }
  return null;
}

function insertSpatialEntry(node: SpatialNode, entry: SpatialEntry): void {
  const child = childForEntry(node, entry);
  if (child) {
    insertSpatialEntry(child, entry);
    return;
  }

  node.entries.push(entry);
  if (node.children || node.depth >= MAX_SPATIAL_DEPTH || node.entries.length <= MAX_SPATIAL_ENTRIES) return;

  node.children = splitSpatialNode(node);
  const retained: SpatialEntry[] = [];
  for (const current of node.entries) {
    const childNode = childForEntry(node, current);
    if (childNode) {
      insertSpatialEntry(childNode, current);
    } else {
      retained.push(current);
    }
  }
  node.entries = retained;
}

function querySpatialNode(node: SpatialNode, area: SpatialBounds, out: Set<string>): void {
  if (!intersectsBounds(node.bounds, area)) return;

  for (const entry of node.entries) {
    if (intersectsBounds(entry.bounds, area)) {
      out.add(entry.id);
    }
  }

  if (!node.children) return;
  for (const child of node.children) {
    querySpatialNode(child, area, out);
  }
}

function measureSpatialTree(node: SpatialNode): { nodes: number; maxDepth: number } {
  let nodes = 1;
  let maxDepth = node.depth;
  if (node.children) {
    for (const child of node.children) {
      const measured = measureSpatialTree(child);
      nodes += measured.nodes;
      maxDepth = Math.max(maxDepth, measured.maxDepth);
    }
  }
  return { nodes, maxDepth };
}

function isUnboundedForSpatialIndex(drawing: Drawing): boolean {
  if (UNBOUNDED_VARIANTS.has(drawing.variant)) return true;
  return Boolean(drawing.options.extendLeft || drawing.options.extendRight || drawing.options.rayMode);
}

function estimateDrawingBounds(drawing: Drawing): SpatialBounds | null {
  if (!drawing.anchors.length) return null;

  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = Number.NEGATIVE_INFINITY;

  for (const anchor of drawing.anchors) {
    const time = Number(anchor.time);
    if (!Number.isFinite(time) || !Number.isFinite(anchor.price)) continue;
    minTime = Math.min(minTime, time);
    maxTime = Math.max(maxTime, time);
    minPrice = Math.min(minPrice, anchor.price);
    maxPrice = Math.max(maxPrice, anchor.price);
  }

  if (!Number.isFinite(minTime) || !Number.isFinite(maxTime) || !Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
    return null;
  }

  const spanTime = Math.max(120, maxTime - minTime);
  const spanPrice = Math.max(1e-4, maxPrice - minPrice);
  const refPrice = Math.max(Math.abs(minPrice), Math.abs(maxPrice), spanPrice);

  const padTime = Math.max(1800, spanTime * 0.25);
  const padPrice = Math.max(0.05, spanPrice * 0.35, refPrice * 0.01);

  return normalizeBounds(createBounds(minTime - padTime, minPrice - padPrice, maxTime + padTime, maxPrice + padPrice));
}

function hitTestLimit(intent: SelectionIntent): number {
  return intent === 'erase' ? 4.2 : 2.5;
}

function buildSpatialSearchBounds(point: DrawPoint, intent: SelectionIntent): SpatialBounds {
  const limit = hitTestLimit(intent);
  const priceScale = Math.max(HIT_TEST_PRICE_SCALE_FLOOR, Math.abs(point.price) * 0.03);
  const timeRadius = limit * HIT_TEST_TIME_SCALE * SPATIAL_QUERY_EXPANSION;
  const priceRadius = limit * priceScale * SPATIAL_QUERY_EXPANSION;
  return createBounds(
    Number(point.time) - timeRadius,
    point.price - priceRadius,
    Number(point.time) + timeRadius,
    point.price + priceRadius,
  );
}

function buildVisiblePool(drawings: Drawing[], includeIds?: Set<string> | null): Drawing[] {
  const normalized = normalizeDrawings(drawings);
  const pool: Drawing[] = [];
  for (const drawing of normalized) {
    if (drawing.visible === false) continue;
    if (includeIds && !includeIds.has(drawing.id)) continue;
    pool.push(drawing);
  }
  return pool.sort(compareDrawingInteractionOrder);
}

function recordHitTestTelemetry(
  telemetry: MutableHitTestStats | null,
  intent: SelectionIntent,
  startedAt: number,
  candidateCount: number,
): void {
  if (!telemetry || !telemetry.enabled) return;
  const durationMs = Math.max(0, nowMs() - startedAt);
  telemetry.count += 1;
  telemetry.totalMs += durationMs;
  telemetry.maxMs = Math.max(telemetry.maxMs, durationMs);
  telemetry.totalCandidates += candidateCount;
  telemetry.maxCandidates = Math.max(telemetry.maxCandidates, candidateCount);
  if (intent === 'erase') {
    telemetry.eraseCount += 1;
    telemetry.eraseTotalMs += durationMs;
    telemetry.eraseMaxMs = Math.max(telemetry.eraseMaxMs, durationMs);
  } else {
    telemetry.selectCount += 1;
    telemetry.selectTotalMs += durationMs;
    telemetry.selectMaxMs = Math.max(telemetry.selectMaxMs, durationMs);
  }
}

export class DrawingSpatialIndex {
  private root: SpatialNode | null = null;

  private drawingsById = new Map<string, Drawing>();

  private orderedIdsDesc: string[] = [];

  private fallbackIds = new Set<string>();

  private stats: DrawingSpatialIndexStats = {
    indexedCount: 0,
    fallbackCount: 0,
    nodeCount: 0,
    depth: 0,
  };

  rebuild(drawings: Drawing[]): void {
    this.root = null;
    this.drawingsById.clear();
    this.orderedIdsDesc = [];
    this.fallbackIds.clear();
    this.stats = {
      indexedCount: 0,
      fallbackCount: 0,
      nodeCount: 0,
      depth: 0,
    };

    const visibleDrawings = normalizeDrawings(drawings)
      .filter((drawing) => drawing.visible !== false)
      .sort(compareDrawingInteractionOrder);
    if (!visibleDrawings.length) return;

    this.orderedIdsDesc = visibleDrawings.map((drawing) => drawing.id);

    const entries: SpatialEntry[] = [];
    for (const drawing of visibleDrawings) {
      this.drawingsById.set(drawing.id, drawing);
      if (isUnboundedForSpatialIndex(drawing)) {
        this.fallbackIds.add(drawing.id);
        continue;
      }
      const bounds = estimateDrawingBounds(drawing);
      if (!bounds) {
        this.fallbackIds.add(drawing.id);
        continue;
      }
      entries.push({
        id: drawing.id,
        drawing,
        bounds,
      });
    }

    if (!entries.length) {
      this.stats = {
        indexedCount: 0,
        fallbackCount: this.fallbackIds.size,
        nodeCount: 0,
        depth: 0,
      };
      return;
    }

    let merged = entries[0].bounds;
    for (let index = 1; index < entries.length; index += 1) {
      merged = mergeBounds(merged, entries[index].bounds);
    }

    this.root = createSpatialNode(normalizeBounds(merged), 0);
    for (const entry of entries) {
      insertSpatialEntry(this.root, entry);
    }

    const measured = measureSpatialTree(this.root);
    this.stats = {
      indexedCount: entries.length,
      fallbackCount: this.fallbackIds.size,
      nodeCount: measured.nodes,
      depth: measured.maxDepth,
    };
  }

  query(point: DrawPoint, intent: SelectionIntent, includeIds?: Set<string> | null): Drawing[] {
    if (!this.orderedIdsDesc.length) return [];

    const matchedIds = new Set<string>();
    if (this.root) {
      const searchBounds = buildSpatialSearchBounds(point, intent);
      querySpatialNode(this.root, searchBounds, matchedIds);
    }

    for (const id of this.fallbackIds) {
      matchedIds.add(id);
    }

    const result: Drawing[] = [];
    for (const id of this.orderedIdsDesc) {
      if (includeIds && !includeIds.has(id)) continue;
      if (!matchedIds.has(id)) continue;
      const drawing = this.drawingsById.get(id);
      if (!drawing || drawing.visible === false) continue;
      result.push(drawing);
    }

    return result;
  }

  getStats(): DrawingSpatialIndexStats {
    return { ...this.stats };
  }
}

export function resolveNearestDrawingHit(drawings: Drawing[], point: DrawPoint, options: HitTestOptions = {}): HitTestResult {
  if (!drawings.length) {
    return {
      id: null,
      score: Number.POSITIVE_INFINITY,
      limit: hitTestLimit(options.intent ?? 'select'),
      candidateCount: 0,
      scannedCount: 0,
    };
  }

  const intent = options.intent ?? 'select';
  const limit = hitTestLimit(intent);
  const telemetry = hitTestStore(false);
  const measure = telemetry?.enabled === true;
  const startedAt = measure ? nowMs() : 0;

  const includeIds = options.includeIds ?? null;
  const fallbackPool = buildVisiblePool(drawings, includeIds);
  let pool = options.spatialIndex?.query(point, intent, includeIds) ?? [];
  if (!pool.length) {
    pool = fallbackPool;
  }

  const visibleById = new Map<string, Drawing>();
  for (const drawing of fallbackPool) {
    visibleById.set(drawing.id, drawing);
  }

  let bestId: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let scannedCount = 0;
  const scannedIds = new Set<string>();

  if (options.preferredIds?.length) {
    for (const preferredId of options.preferredIds) {
      if (!preferredId || scannedIds.has(preferredId)) continue;
      const preferred = visibleById.get(preferredId);
      if (!preferred) continue;
      scannedIds.add(preferredId);
      scannedCount += 1;
      const score = scoreLineLikeDrawing(preferred, point);
      if (score <= limit) {
        bestId = preferredId;
        bestScore = score;
        recordHitTestTelemetry(telemetry ?? null, intent, startedAt, pool.length);
        return {
          id: bestId,
          score: bestScore,
          limit,
          candidateCount: pool.length,
          scannedCount,
        };
      }
    }
  }

  for (const drawing of pool) {
    if (scannedIds.has(drawing.id)) continue;
    scannedIds.add(drawing.id);
    scannedCount += 1;
    const score = scoreLineLikeDrawing(drawing, point);
    if (score < bestScore) {
      bestScore = score;
      bestId = drawing.id;
    }
  }

  const resolved = bestScore <= limit ? bestId : null;
  recordHitTestTelemetry(telemetry ?? null, intent, startedAt, pool.length);

  return {
    id: resolved,
    score: resolved ? bestScore : Number.POSITIVE_INFINITY,
    limit,
    candidateCount: pool.length,
    scannedCount,
  };
}

export function selectNearestDrawingId(drawings: Drawing[], point: DrawPoint, intent: SelectionIntent = 'select'): string | null {
  return resolveNearestDrawingHit(drawings, point, { intent }).id;
}
