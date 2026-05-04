/**
 * ParallelChannel tool — two parallel extended lines with a fill between them.
 *
 * TV parity:
 * - 3 anchors: anchor[0]+anchor[1] define the baseline (center line),
 *   anchor[2] controls the perpendicular offset of the parallel rail.
 * - All three lines extend across the full canvas.
 * - Semi-transparent fill between the upper and lower rails.
 * - Selection: 3 circle handles (one per anchor).
 */

import type {
  Drawing,
  DrawPoint,
  HandleDescriptor,
  DrawingOptions,
  Viewport,
} from '../types.ts';
import {
  dataToScreen,
  distanceToLine,
  distanceToSegment,
  rayEndpoint,
  reverseRayEndpoint,
  applyLineStyle,
  drawCircleHandle,
  hexToRgba,
} from '../geometry.ts';
import { BaseTool } from './base.ts';

type SP = { x: number; y: number };

const EPSILON = 1e-6;

function normalize(v: SP): SP {
  const mag = Math.hypot(v.x, v.y);
  return mag < EPSILON ? { x: 0, y: 0 } : { x: v.x / mag, y: v.y / mag };
}

function perpendicular(v: SP): SP {
  return { x: -v.y, y: v.x };
}

function signedDistanceToLine(pt: SP, a: SP, b: SP): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mag = Math.hypot(dx, dy);
  if (mag < EPSILON) return 0;
  return ((pt.x - a.x) * dy - (pt.y - a.y) * dx) / mag;
}

function shiftPoint(p: SP, normal: SP, offset: number): SP {
  return { x: p.x + normal.x * offset, y: p.y + normal.y * offset };
}

function extendedLine(a: SP, b: SP, w: number, h: number): [SP, SP] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return [a, b];

  // Find t values where line exits the [0,w] x [0,h] canvas
  const ts: number[] = [];
  if (Math.abs(dx) >= EPSILON) {
    ts.push((0 - a.x) / dx);
    ts.push((w - a.x) / dx);
  }
  if (Math.abs(dy) >= EPSILON) {
    ts.push((0 - a.y) / dy);
    ts.push((h - a.y) / dy);
  }

  const inBounds = (t: number) => {
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    return px >= -0.5 && px <= w + 0.5 && py >= -0.5 && py <= h + 0.5;
  };

  const valid = ts.filter(inBounds).sort((x, y) => x - y);
  if (valid.length < 2) return [a, b];
  const t0 = valid[0];
  const t1 = valid[valid.length - 1];
  return [
    { x: a.x + dx * t0, y: a.y + dy * t0 },
    { x: a.x + dx * t1, y: a.y + dy * t1 },
  ];
}

function shiftedExtendedLine(a: SP, b: SP, offset: number, w: number, h: number): [SP, SP] {
  const dir = normalize({ x: b.x - a.x, y: b.y - a.y });
  const perp = perpendicular(dir);
  const sa = shiftPoint(a, perp, offset);
  const sb = shiftPoint(b, perp, offset);
  return extendedLine(sa, sb, w, h);
}

export class ParallelChannelTool extends BaseTool {
  readonly variant = 'parallelChannel' as const;
  readonly label = 'Parallel Channel';
  readonly anchorCount = 3;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: SP, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;

    // Center line
    const centerDist = distanceToLine(pointer, a, b);

    // Offset rails
    let upperOffset = 0;
    let lowerOffset = 0;
    if (drawing.anchors.length >= 3) {
      const c = dataToScreen(drawing.anchors[2], viewport);
      const signed = signedDistanceToLine(c, a, b);
      upperOffset = signed;
      lowerOffset = -signed;
    } else {
      const span = Math.max(12, Math.hypot(b.x - a.x, b.y - a.y));
      upperOffset = span * 0.24;
      lowerOffset = -upperOffset;
    }

    const [ua, ub] = shiftedExtendedLine(a, b, upperOffset, w, h);
    const [la, lb] = shiftedExtendedLine(a, b, lowerOffset, w, h);

    const upperDist = distanceToLine(pointer, ua, ub);
    const lowerDist = distanceToLine(pointer, la, lb);

    return Math.min(centerDist, upperDist, lowerDist);
  }

  override render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    viewport: Viewport,
    selected: boolean,
    hovered: boolean,
  ): void {
    if (drawing.anchors.length < 2) return;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;

    let upperOffset = 0;
    let lowerOffset = 0;
    if (drawing.anchors.length >= 3) {
      const c = dataToScreen(drawing.anchors[2], viewport);
      const signed = signedDistanceToLine(c, a, b);
      upperOffset = signed;
      lowerOffset = -signed;
    } else {
      const span = Math.max(12, Math.hypot(b.x - a.x, b.y - a.y));
      upperOffset = span * 0.24;
      lowerOffset = -upperOffset;
    }

    const [ca, cb] = extendedLine(a, b, w, h);
    const [ua, ub] = shiftedExtendedLine(a, b, upperOffset, w, h);
    const [la, lb] = shiftedExtendedLine(a, b, lowerOffset, w, h);

    ctx.save();

    // Fill between upper and lower rails
    ctx.beginPath();
    ctx.moveTo(ua.x, ua.y);
    ctx.lineTo(ub.x, ub.y);
    ctx.lineTo(lb.x, lb.y);
    ctx.lineTo(la.x, la.y);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(drawing.options.color, 0.08);
    ctx.fill();

    const color = drawing.options.color;
    const lw = drawing.options.lineWidth + (selected ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, lw);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;

    // Upper rail
    ctx.beginPath();
    ctx.moveTo(ua.x, ua.y);
    ctx.lineTo(ub.x, ub.y);
    ctx.stroke();

    // Lower rail
    ctx.beginPath();
    ctx.moveTo(la.x, la.y);
    ctx.lineTo(lb.x, lb.y);
    ctx.stroke();

    // Center line (dashed by convention matching TV)
    ctx.setLineDash([6, 4]);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(ca.x, ca.y);
    ctx.lineTo(cb.x, cb.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    if (selected || hovered) {
      for (const anchor of drawing.anchors) {
        const sp = dataToScreen(anchor, viewport);
        drawCircleHandle(ctx, sp, 5, color, true);
      }
    }

    ctx.restore();
  }

  override renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.globalAlpha = 1;
    for (const anchor of draft.anchors) {
      const sp = dataToScreen(anchor, viewport);
      drawCircleHandle(ctx, sp, 5, draft.options.color, false);
    }
    ctx.restore();
  }

  override getHandles(drawing: Drawing, viewport: Viewport): HandleDescriptor[] {
    return drawing.anchors.map((anchor, index) => ({
      anchorIndex: index,
      center: dataToScreen(anchor, viewport),
      radius: 5,
      active: false,
    }));
  }
}
