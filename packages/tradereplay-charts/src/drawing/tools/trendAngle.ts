/**
 * TrendAngle tool — trend line with angle display and Shift-key snap.
 *
 * TV parity:
 * - Two-anchor drag-commit line segment
 * - Shift key snaps to 15° increments during draw
 * - Renders the line + a small angle badge near anchor[0]
 * - Arc indicator showing the angle at anchor[0]
 * - Price labels on Y-axis
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
  distanceToSegment,
  clipSegment,
  snapAngle15,
  applyLineStyle,
  drawCircleHandle,
  drawPriceLabel,
  hexToRgba,
} from '../geometry.ts';
import { BaseTool } from './base.ts';

export class TrendAngleTool extends BaseTool {
  readonly variant = 'trendAngle' as const;
  readonly label = 'Trend Angle';
  readonly anchorCount = 2;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
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

    const clipped = clipSegment(a, b, w, h);
    if (!clipped) return;
    const [cs, ce] = clipped;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    // Canvas Y grows down; TV convention: positive angle = upward slope
    const angleDeg = Math.round(Math.atan2(-dy, dx) * (180 / Math.PI));

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

    // Angle arc at anchor[0]
    const arcR = 22;
    const lineAngle = Math.atan2(dy, dx);
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = drawing.options.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(a.x, a.y, arcR, 0, lineAngle, lineAngle < 0);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Angle label badge
    const labelText = `${angleDeg >= 0 ? '+' : ''}${angleDeg}°`;
    ctx.font = `bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const metrics = ctx.measureText(labelText);
    const padX = 4, padY = 3;
    const bw = metrics.width + padX * 2;
    const bh = 16;
    const bx = a.x + arcR + 4;
    const by = a.y - bh / 2;

    ctx.fillStyle = hexToRgba(drawing.options.color, 0.85);
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, bw, bh, 2);
    } else {
      ctx.rect(bx, by, bw, bh);
    }
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, bx + padX, by + bh / 2);

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
      xRange: [Math.min(a.x, b.x), Math.max(a.x, b.x)],
      yRange: [Math.min(a.y, b.y), Math.max(a.y, b.y)],
    };
  }
}
