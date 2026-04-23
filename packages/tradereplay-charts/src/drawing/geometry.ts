/**
 * Geometry utilities for drawing tools.
 *
 * Pure functions — no DOM, no canvas, no state.
 * All calculations operate in screen (pixel) space unless noted.
 */

import type { ScreenPoint, Viewport, DrawPoint } from './types.ts';

/** Clamp a number to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Euclidean distance between two screen points. */
export function distancePx(a: ScreenPoint, b: ScreenPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Convert a data-space DrawPoint to screen pixels using the current Viewport. */
export function dataToScreen(point: DrawPoint, vp: Viewport): ScreenPoint {
  const x = vp.originX + (Number(point.time) - Number(vp.visibleFrom)) * vp.pxPerTime;
  const y = vp.originY - (point.price - 0) * vp.pxPerPrice;
  // Recalculate using price axis offset
  const chartW = vp.width - vp.priceAxisWidth;
  const chartH = vp.height - vp.timeAxisHeight;
  const px = ((Number(point.time) - Number(vp.visibleFrom)) / (Number(vp.visibleTo) - Number(vp.visibleFrom))) * chartW;
  const py = chartH - ((point.price - vp.priceMin) / (vp.priceMax - vp.priceMin)) * chartH;
  return { x: px, y: py };
}

/** Convert screen pixels back to data-space price/time. */
export function screenToData(point: ScreenPoint, vp: Viewport): DrawPoint {
  const chartW = vp.width - vp.priceAxisWidth;
  const chartH = vp.height - vp.timeAxisHeight;
  const tFrac = point.x / chartW;
  const pFrac = 1 - point.y / chartH;
  const time = (vp.visibleFrom + tFrac * (Number(vp.visibleTo) - Number(vp.visibleFrom))) as DrawPoint['time'];
  const price = vp.priceMin + pFrac * (vp.priceMax - vp.priceMin);
  return { time, price };
}

/**
 * Distance from a screen point P to an infinite line through A and B.
 */
export function distanceToLine(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return distancePx(p, a);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

/**
 * Distance from a screen point P to a finite line segment A→B.
 * Returns the shortest distance to the segment (endpoint clamped).
 */
export function distanceToSegment(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return distancePx(p, a);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);
  return distancePx(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * Extend a ray starting at `origin` through `through` to hit the canvas boundary.
 * Returns the endpoint on the canvas edge.
 */
export function rayEndpoint(origin: ScreenPoint, through: ScreenPoint, canvasW: number, canvasH: number): ScreenPoint {
  const dx = through.x - origin.x;
  const dy = through.y - origin.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return through;

  let tMin = Infinity;
  // Right edge
  if (dx > 1e-9) tMin = Math.min(tMin, (canvasW - origin.x) / dx);
  // Left edge
  if (dx < -1e-9) tMin = Math.min(tMin, (0 - origin.x) / dx);
  // Bottom edge
  if (dy > 1e-9) tMin = Math.min(tMin, (canvasH - origin.y) / dy);
  // Top edge
  if (dy < -1e-9) tMin = Math.min(tMin, (0 - origin.y) / dy);

  if (!Number.isFinite(tMin) || tMin < 0) return through;
  return { x: origin.x + dx * tMin, y: origin.y + dy * tMin };
}

/**
 * Extend a line segment [a, b] to the left canvas edge (reverse ray from a through b extended back).
 */
export function reverseRayEndpoint(a: ScreenPoint, b: ScreenPoint, canvasW: number, canvasH: number): ScreenPoint {
  // Same as rayEndpoint but reversed direction
  return rayEndpoint(a, { x: 2 * a.x - b.x, y: 2 * a.y - b.y }, canvasW, canvasH);
}

/**
 * Clip a line segment to the canvas rectangle [0,0]→[w,h].
 * Returns null if the segment is entirely outside.
 */
export function clipSegment(
  a: ScreenPoint,
  b: ScreenPoint,
  w: number,
  h: number,
): [ScreenPoint, ScreenPoint] | null {
  // Cohen–Sutherland line clipping
  const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;

  const code = (p: ScreenPoint): number => {
    let c = INSIDE;
    if (p.x < 0) c |= LEFT;
    else if (p.x > w) c |= RIGHT;
    if (p.y < 0) c |= TOP;
    else if (p.y > h) c |= BOTTOM;
    return c;
  };

  let [ax, ay] = [a.x, a.y];
  let [bx, by] = [b.x, b.y];
  let ca = code({ x: ax, y: ay });
  let cb = code({ x: bx, y: by });

  for (let iterations = 0; iterations < 10; iterations++) {
    if (!(ca | cb)) return [{ x: ax, y: ay }, { x: bx, y: by }]; // both inside
    if (ca & cb) return null; // both outside same region

    const c = ca !== INSIDE ? ca : cb;
    let x = 0, y = 0;
    const dx = bx - ax, dy = by - ay;

    if (c & BOTTOM) { x = ax + (dx * (h - ay)) / dy; y = h; }
    else if (c & TOP) { x = ax + (dx * (0 - ay)) / dy; y = 0; }
    else if (c & RIGHT) { y = ay + (dy * (w - ax)) / dx; x = w; }
    else if (c & LEFT) { y = ay + (dy * (0 - ax)) / dx; x = 0; }

    if (c === ca) { ax = x; ay = y; ca = code({ x: ax, y: ay }); }
    else { bx = x; by = y; cb = code({ x: bx, y: by }); }
  }
  return null;
}

/**
 * Snap an angle to the nearest 15-degree increment (Shift key behavior in TradingView).
 * Given a base point and a raw endpoint, returns a new endpoint snapped to N×15°.
 */
export function snapAngle15(base: ScreenPoint, raw: ScreenPoint): ScreenPoint {
  const dx = raw.x - base.x;
  const dy = raw.y - base.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-9) return raw;
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
  return {
    x: base.x + dist * Math.cos(snapped),
    y: base.y + dist * Math.sin(snapped),
  };
}

/**
 * Snap a point to a horizontal or vertical axis (Shift key for H/V lines).
 * Returns a point adjusted to share the same X or Y as the base.
 */
export function snapHV(base: ScreenPoint, raw: ScreenPoint): ScreenPoint {
  const dx = Math.abs(raw.x - base.x);
  const dy = Math.abs(raw.y - base.y);
  if (dx >= dy) return { x: raw.x, y: base.y }; // snap horizontal
  return { x: base.x, y: raw.y }; // snap vertical
}

/**
 * Draw a standard dashed/dotted line on the canvas context.
 * Applies the line style via setLineDash before calling stroke.
 */
export function applyLineStyle(ctx: CanvasRenderingContext2D, style: 'solid' | 'dashed' | 'dotted' | 'large-dashed' | 'sparse-dotted', width: number): void {
  switch (style) {
    case 'solid':
      ctx.setLineDash([]);
      break;
    case 'dashed':
      ctx.setLineDash([4 * width, 4 * width]);
      break;
    case 'large-dashed':
      ctx.setLineDash([8 * width, 4 * width]);
      break;
    case 'dotted':
      ctx.setLineDash([width, 4 * width]);
      break;
    case 'sparse-dotted':
      ctx.setLineDash([width, 8 * width]);
      break;
    default:
      ctx.setLineDash([]);
  }
}

/**
 * Draw a filled circle handle at position `center` with radius `r`.
 * Uses TradingView-style white fill with color border.
 */
export function drawCircleHandle(
  ctx: CanvasRenderingContext2D,
  center: ScreenPoint,
  r: number,
  color: string,
  active = false,
): void {
  ctx.beginPath();
  ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
  ctx.fillStyle = active ? color : '#ffffff';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/**
 * Draw the Y-axis price label for a drawing (e.g., the horizontal line price label).
 */
export function drawPriceLabel(
  ctx: CanvasRenderingContext2D,
  price: number,
  y: number,
  canvasW: number,
  color: string,
  priceAxisWidth: number,
): void {
  const text = price.toFixed(2);
  const labelX = canvasW - priceAxisWidth;
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Background
  ctx.fillStyle = color;
  const metrics = ctx.measureText(text);
  const pad = 4;
  ctx.fillRect(labelX, y - 9, metrics.width + pad * 2, 18);

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, labelX + pad, y);
}

/**
 * Convert a hex color string to rgba with the given alpha.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const len = clean.length;
  let r: number, g: number, b: number;
  if (len === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Returns true if the point is within the chart drawing area (excludes axis panels).
 */
export function isInsideDrawingArea(p: ScreenPoint, vp: Viewport): boolean {
  return p.x >= 0 && p.x <= vp.width - vp.priceAxisWidth
    && p.y >= 0 && p.y <= vp.height - vp.timeAxisHeight;
}
