/**
 * TrendLine tool — draws a finite line segment between two anchor points.
 *
 * TV parity features:
 * - Drag to create (pointerdown → drag → pointerup)
 * - Click-click to create (pointerdown at p1, pointerdown at p2)
 * - Extend left / extend right options (continuous line beyond anchors)
 * - Show price label on Y-axis for both endpoints
 * - Selection: 2 circle handles at endpoints
 * - Hit test: within 6px of the line segment (or extended line)
 * - Shift key: snap to 15° angle increments
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
  clipSegment,
  rayEndpoint,
  reverseRayEndpoint,
  applyLineStyle,
  drawCircleHandle,
  drawPriceLabel,
} from '../geometry.ts';
import { BaseTool } from './base.ts';

export class TrendLineTool extends BaseTool {
  readonly variant = 'trend' as const;
  readonly label = 'Trend Line';
  readonly anchorCount = 2;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;

    const { extendLeft = false, extendRight = false } = drawing.options;

    if (extendLeft && extendRight) {
      // Infinite line
      return distanceToLine(pointer, a, b);
    }

    if (extendRight) {
      // Ray from a through b
      const end = rayEndpoint(a, b, w, h);
      return distanceToSegment(pointer, a, end);
    }

    if (extendLeft) {
      // Ray from b back through a
      const start = reverseRayEndpoint(a, b, w, h);
      return distanceToSegment(pointer, start, b);
    }

    // Finite segment
    return distanceToSegment(pointer, a, b);
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

    const { extendLeft = false, extendRight = false } = drawing.options;

    let start = a;
    let end = b;

    if (extendRight) end = rayEndpoint(a, b, w, h);
    if (extendLeft) start = reverseRayEndpoint(a, b, w, h);

    // Clip to drawing area
    const clipped = clipSegment(start, end, w, h);
    if (!clipped) return;
    [start, end] = clipped;

    ctx.save();

    // Selection/hover highlight
    if (selected || hovered) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = drawing.options.color;
      ctx.lineWidth = 9;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Main line
    ctx.strokeStyle = drawing.options.color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Price labels on Y-axis
    if (drawing.options.axisLabel) {
      const canvasW = viewport.width;
      const pw = viewport.priceAxisWidth;
      drawPriceLabel(ctx, drawing.anchors[0].price, a.y, canvasW, drawing.options.color, pw);
      drawPriceLabel(ctx, drawing.anchors[1].price, b.y, canvasW, drawing.options.color, pw);
    }

    ctx.restore();
  }

  override renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.globalAlpha = 1;

    // Draw anchor handles during preview
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
