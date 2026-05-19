/**
 * ParallelChannel tool — 3-anchor channel with baseline + parallel rail.
 *
 * TV parity:
 * - Anchor[0] = baseline start, anchor[1] = baseline end, anchor[2] = rail offset
 * - Renders: center baseline, upper rail, lower rail (parallel), translucent fill
 * - 3-click wizard: click baseline-start → click baseline-end → click rail position
 * - Hit test: near any of the three lines
 * - Selection handles at all 3 anchors
 */

import type {
  Drawing,
  DrawPoint,
  HandleDescriptor,
  DrawingOptions,
  Viewport,
  AxisHighlight,
} from '../types.ts';
import {
  dataToScreen,
  distanceToLine,
  distanceToSegment,
  clipSegment,
  rayEndpoint,
  reverseRayEndpoint,
  applyLineStyle,
  drawCircleHandle,
  drawPriceLabel,
  hexToRgba,
} from '../geometry.ts';
import type { ScreenPoint } from '../types.ts';
import { BaseTool } from './base.ts';

function perpNormalize(dx: number, dy: number): { nx: number; ny: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { nx: -dy / len, ny: dx / len };
}

function signedDist(point: ScreenPoint, lineStart: ScreenPoint, lineEnd: ScreenPoint): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return 0;
  return ((point.x - lineStart.x) * dy - (point.y - lineStart.y) * dx) / len;
}

function offsetLine(
  start: ScreenPoint,
  end: ScreenPoint,
  offset: number,
  w: number,
  h: number,
): [ScreenPoint, ScreenPoint] | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const { nx, ny } = perpNormalize(dx, dy);
  const os = { x: start.x + nx * offset, y: start.y + ny * offset };
  const oe = { x: end.x + nx * offset, y: end.y + ny * offset };
  const extStart = reverseRayEndpoint(os, oe, w, h);
  const extEnd = rayEndpoint(os, oe, w, h);
  return clipSegment(extStart, extEnd, w, h);
}

export class ParallelChannelTool extends BaseTool {
  readonly variant = 'channel' as const;
  readonly label = 'Parallel Channel';
  readonly anchorCount = 3;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;

    const centerDist = distanceToLine(pointer, a, b);

    if (drawing.anchors.length < 3) return centerDist;

    const c = dataToScreen(drawing.anchors[2], viewport);
    const offset = signedDist(c, a, b);

    const upperDist = (() => {
      const seg = offsetLine(a, b, offset, w, h);
      if (!seg) return Infinity;
      return distanceToLine(pointer, seg[0], seg[1]);
    })();

    const lowerDist = (() => {
      const seg = offsetLine(a, b, -offset, w, h);
      if (!seg) return Infinity;
      return distanceToLine(pointer, seg[0], seg[1]);
    })();

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

    // Compute offset from 3rd anchor or fallback
    let offset: number;
    if (drawing.anchors.length >= 3) {
      const c = dataToScreen(drawing.anchors[2], viewport);
      offset = signedDist(c, a, b);
    } else {
      const span = Math.max(12, Math.hypot(b.x - a.x, b.y - a.y));
      offset = span * 0.24;
    }

    const centerSeg = (() => {
      const s = reverseRayEndpoint(a, b, w, h);
      const e = rayEndpoint(a, b, w, h);
      return clipSegment(s, e, w, h);
    })();
    const upperSeg = offsetLine(a, b, offset, w, h);
    const lowerSeg = offsetLine(a, b, -offset, w, h);

    ctx.save();
    ctx.strokeStyle = drawing.options.color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);

    // Translucent fill between rails
    if (upperSeg && lowerSeg) {
      ctx.globalAlpha = selected ? 0.14 : 0.08;
      ctx.fillStyle = drawing.options.color;
      ctx.beginPath();
      ctx.moveTo(upperSeg[0].x, upperSeg[0].y);
      ctx.lineTo(upperSeg[1].x, upperSeg[1].y);
      ctx.lineTo(lowerSeg[1].x, lowerSeg[1].y);
      ctx.lineTo(lowerSeg[0].x, lowerSeg[0].y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);

    if (centerSeg) {
      ctx.beginPath();
      ctx.moveTo(centerSeg[0].x, centerSeg[0].y);
      ctx.lineTo(centerSeg[1].x, centerSeg[1].y);
      ctx.stroke();
    }
    if (upperSeg) {
      ctx.beginPath();
      ctx.moveTo(upperSeg[0].x, upperSeg[0].y);
      ctx.lineTo(upperSeg[1].x, upperSeg[1].y);
      ctx.stroke();
    }
    if (lowerSeg) {
      ctx.beginPath();
      ctx.moveTo(lowerSeg[0].x, lowerSeg[0].y);
      ctx.lineTo(lowerSeg[1].x, lowerSeg[1].y);
      ctx.stroke();
    }

    ctx.restore();
  }

  override renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.globalAlpha = 1;
    for (const anchor of draft.anchors) {
      drawCircleHandle(ctx, dataToScreen(anchor, viewport), 5, draft.options.color, false);
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

  override getAxisHighlight(drawing: Drawing, viewport: Viewport): AxisHighlight | null {
    if (drawing.anchors.length < 2) return null;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;

    if (drawing.anchors.length < 3) {
      return {
        xRange: [0, w],
        yRange: [Math.min(a.y, b.y), Math.max(a.y, b.y)],
      };
    }

    const c = dataToScreen(drawing.anchors[2], viewport);
    const offset = Math.abs(signedDist(c, a, b));
    const midY = (a.y + b.y) / 2;

    return {
      xRange: [0, w],
      yRange: [midY - offset, midY + offset],
    };
  }
}
