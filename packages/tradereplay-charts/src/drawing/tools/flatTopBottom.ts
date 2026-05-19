/**
 * FlatTopBottom tool — flat top/bottom channel (horizontal bounding box).
 *
 * TV parity:
 * - Two anchors define a horizontal price band (flat top + flat bottom)
 * - Default color: yellow (#FFD60A)
 * - Renders: top horizontal line, bottom horizontal line, translucent fill
 * - Hit test: near top or bottom line, or inside the band
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

const FLAT_TOP_BOTTOM_COLOR = '#FFD60A';

export class FlatTopBottomTool extends BaseTool {
  readonly variant = 'flatTopBottom' as const;
  readonly label = 'Flat Top/Bottom';
  readonly anchorCount = 2;
  readonly isPointOnly = false;

  override createDraft(p1: DrawPoint, options: DrawingOptions): Drawing {
    return super.createDraft(p1, { ...options, color: options.color === '#2962ff' ? FLAT_TOP_BOTTOM_COLOR : options.color });
  }

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const topY = Math.min(a.y, b.y);
    const botY = Math.max(a.y, b.y);
    if (pointer.y >= topY && pointer.y <= botY) return 0;
    return Math.min(Math.abs(pointer.y - topY), Math.abs(pointer.y - botY));
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
    const topY = Math.min(a.y, b.y);
    const botY = Math.max(a.y, b.y);
    const color = drawing.options.color || FLAT_TOP_BOTTOM_COLOR;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);

    // Translucent fill
    ctx.globalAlpha = selected ? 0.14 : 0.08;
    ctx.fillStyle = color;
    ctx.fillRect(0, topY, w, botY - topY);
    ctx.globalAlpha = 1;

    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);

    // Top line
    ctx.beginPath();
    ctx.moveTo(0, topY);
    ctx.lineTo(w, topY);
    ctx.stroke();

    // Bottom line
    ctx.beginPath();
    ctx.moveTo(0, botY);
    ctx.lineTo(w, botY);
    ctx.stroke();

    if (drawing.options.axisLabel) {
      const canvasW = viewport.width;
      const pw = viewport.priceAxisWidth;
      drawPriceLabel(ctx, drawing.anchors[0].price, a.y, canvasW, color, pw);
      drawPriceLabel(ctx, drawing.anchors[1].price, b.y, canvasW, color, pw);
    }

    ctx.restore();
  }

  override renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.globalAlpha = 1;
    for (const anchor of draft.anchors) {
      drawCircleHandle(ctx, dataToScreen(anchor, viewport), 5, draft.options.color || FLAT_TOP_BOTTOM_COLOR, false);
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
    return {
      xRange: [0, w],
      yRange: [Math.min(a.y, b.y), Math.max(a.y, b.y)],
    };
  }
}
