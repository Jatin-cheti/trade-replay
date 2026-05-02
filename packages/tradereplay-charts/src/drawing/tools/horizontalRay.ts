/**
 * HorizontalRay tool — a horizontal half-line starting at anchor[0] extending right.
 *
 * TV parity:
 * - Single-anchor click-commit
 * - Renders as horizontal line from anchor to right canvas edge
 * - Price label on Y-axis
 * - Axis highlight: full canvas width x-range, single y point
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
  applyLineStyle,
  drawCircleHandle,
  drawPriceLabel,
} from '../geometry.ts';
import { BaseTool } from './base.ts';

export class HorizontalRayTool extends BaseTool {
  readonly variant = 'horizontalRay' as const;
  readonly label = 'Horizontal Ray';
  readonly anchorCount = 1;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (!drawing.anchors.length) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const dy = Math.abs(pointer.y - a.y);
    // Only hit if pointer is to the right of the anchor
    if (pointer.x < a.x) return dy + (a.x - pointer.x);
    return dy;
  }

  override render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    viewport: Viewport,
    selected: boolean,
    hovered: boolean,
  ): void {
    if (!drawing.anchors.length) return;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;

    ctx.save();

    if (selected || hovered) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = drawing.options.color;
      ctx.lineWidth = 9;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(w, a.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = drawing.options.color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(w, a.y);
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
    if (draft.anchors.length) {
      drawCircleHandle(ctx, dataToScreen(draft.anchors[0], viewport), 5, draft.options.color, false);
    }
    ctx.restore();
  }

  override getHandles(drawing: Drawing, viewport: Viewport): HandleDescriptor[] {
    if (!drawing.anchors.length) return [];
    return [{
      anchorIndex: 0,
      center: dataToScreen(drawing.anchors[0], viewport),
      radius: 5,
      active: false,
    }];
  }

  override getAxisHighlight(drawing: Drawing, viewport: Viewport): AxisHighlight | null {
    if (!drawing.anchors.length) return null;
    const a = dataToScreen(drawing.anchors[0], viewport);
    return {
      xRange: [a.x, viewport.width - viewport.priceAxisWidth],
      yRange: [a.y, a.y],
    };
  }
}
