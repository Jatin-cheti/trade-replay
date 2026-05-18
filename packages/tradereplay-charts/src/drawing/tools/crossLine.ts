/**
 * CrossLine tool — a crosshair (plus sign) through a single anchor.
 *
 * TV parity:
 * - Single-anchor click-commit
 * - Renders full-width horizontal line + full-height vertical line through anchor
 * - Price label on Y-axis; time label on X-axis
 * - Hit test: click near either axis
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

export class CrossLineTool extends BaseTool {
  readonly variant = 'crossLine' as const;
  readonly label = 'Cross Line';
  readonly anchorCount = 1;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (!drawing.anchors.length) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    // Hit if near the horizontal OR the vertical component
    return Math.min(Math.abs(pointer.y - a.y), Math.abs(pointer.x - a.x));
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
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = drawing.options.color;
      ctx.lineWidth = 9;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, a.y);
      ctx.lineTo(w, a.y);
      ctx.moveTo(a.x, 0);
      ctx.lineTo(a.x, h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = drawing.options.color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);
    ctx.beginPath();
    // Horizontal
    ctx.moveTo(0, a.y);
    ctx.lineTo(w, a.y);
    // Vertical
    ctx.moveTo(a.x, 0);
    ctx.lineTo(a.x, h);
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
      xRange: [0, viewport.width - viewport.priceAxisWidth],
      yRange: [0, viewport.height - viewport.timeAxisHeight],
    };
  }
}
