/**
 * ExtendedLine tool — a trend line that extends infinitely in both directions.
 *
 * TV parity:
 * - Identical to TrendLine but extendLeft=true + extendRight=true by default
 * - Renders as a full-width infinite line through both anchors
 * - Price labels on Y-axis at both anchor prices
 * - Axis highlight spans full canvas width
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
  clipSegment,
  rayEndpoint,
  reverseRayEndpoint,
  applyLineStyle,
  drawCircleHandle,
  drawPriceLabel,
} from '../geometry.ts';
import { BaseTool } from './base.ts';

export class ExtendedLineTool extends BaseTool {
  readonly variant = 'extendedLine' as const;
  readonly label = 'Extended Line';
  readonly anchorCount = 2;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    return distanceToLine(pointer, a, b);
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

    // Extend both directions to canvas edges
    const start = reverseRayEndpoint(a, b, w, h);
    const end = rayEndpoint(a, b, w, h);

    const clipped = clipSegment(start, end, w, h);
    if (!clipped) return;
    const [cs, ce] = clipped;

    ctx.save();

    if (selected || hovered) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = drawing.options.color;
      ctx.lineWidth = 9;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cs.x, cs.y);
      ctx.lineTo(ce.x, ce.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = drawing.options.color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);
    ctx.beginPath();
    ctx.moveTo(cs.x, cs.y);
    ctx.lineTo(ce.x, ce.y);
    ctx.stroke();

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

  override getAxisHighlight(drawing: Drawing, viewport: Viewport): AxisHighlight | null {
    if (drawing.anchors.length < 2) return null;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    return {
      // Extended line spans full canvas width
      xRange: [0, viewport.width - viewport.priceAxisWidth],
      yRange: [Math.min(a.y, b.y), Math.max(a.y, b.y)],
    };
  }
}
