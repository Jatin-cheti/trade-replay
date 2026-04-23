/**
 * RayLine tool — a line starting at anchor[0] and extending infinitely through anchor[1].
 *
 * TV parity:
 * - One anchor visible (the origin), extends to canvas edge
 * - Hit test on the visible ray segment only
 * - Price label at origin anchor
 */

import type { Drawing, HandleDescriptor, Viewport } from '../types.ts';
import {
  dataToScreen,
  distanceToSegment,
  clipSegment,
  rayEndpoint,
  applyLineStyle,
  drawCircleHandle,
  drawPriceLabel,
} from '../geometry.ts';
import { BaseTool } from './base.ts';

export class RayLineTool extends BaseTool {
  readonly variant = 'ray' as const;
  readonly label = 'Ray';
  readonly anchorCount = 2;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;
    const end = rayEndpoint(a, b, w, h);
    return distanceToSegment(pointer, a, end);
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

    const end = rayEndpoint(a, b, w, h);
    const clipped = clipSegment(a, end, w, h);
    if (!clipped) return;
    const [start, finish] = clipped;

    ctx.save();

    if (selected || hovered) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = drawing.options.color;
      ctx.lineWidth = 9;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(finish.x, finish.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = drawing.options.color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(finish.x, finish.y);
    ctx.stroke();

    if (drawing.options.axisLabel) {
      drawPriceLabel(ctx, drawing.anchors[0].price, a.y, viewport.width, drawing.options.color, viewport.priceAxisWidth);
    }

    ctx.restore();
  }

  override renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.globalAlpha = 1;
    if (draft.anchors.length >= 1) {
      drawCircleHandle(ctx, dataToScreen(draft.anchors[0], viewport), 5, draft.options.color, false);
    }
    ctx.restore();
  }

  override getHandles(drawing: Drawing, viewport: Viewport): HandleDescriptor[] {
    // Only show origin handle for ray (second anchor is just for direction)
    return [
      {
        anchorIndex: 0,
        center: dataToScreen(drawing.anchors[0], viewport),
        radius: 5,
        active: false,
      },
    ];
  }
}
