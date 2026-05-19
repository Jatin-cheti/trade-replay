/**
 * DisjointChannel tool — two separate non-parallel line segments forming a channel.
 *
 * TV parity:
 * - 4 anchors: [topStart, topEnd, bottomStart, bottomEnd] — two independent segments
 * - Default color: green (#22C55E)
 * - Renders: two line segments + translucent fill quad between them
 * - 4-click wizard: click topStart → topEnd → bottomStart → bottomEnd
 * - Hit test: near either segment
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
  applyLineStyle,
  drawCircleHandle,
  drawPriceLabel,
} from '../geometry.ts';
import { BaseTool } from './base.ts';

const DISJOINT_CHANNEL_COLOR = '#22C55E';

export class DisjointChannelTool extends BaseTool {
  readonly variant = 'disjointChannel' as const;
  readonly label = 'Disjoint Channel';
  readonly anchorCount = 4;
  readonly isPointOnly = false;

  override createDraft(p1: DrawPoint, options: DrawingOptions): Drawing {
    return super.createDraft(p1, { ...options, color: options.color === '#2962ff' ? DISJOINT_CHANNEL_COLOR : options.color });
  }

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const pts = drawing.anchors.map((a) => dataToScreen(a, viewport));
    const [a, b, c, d] = pts;
    let best = distanceToSegment(pointer, a, b);
    if (c && d) best = Math.min(best, distanceToSegment(pointer, c, d));
    return best;
  }

  override render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    viewport: Viewport,
    selected: boolean,
    hovered: boolean,
  ): void {
    if (drawing.anchors.length < 2) return;
    const pts = drawing.anchors.map((a) => dataToScreen(a, viewport));
    const [a, b, c, d] = pts;

    const color = drawing.options.color || DISJOINT_CHANNEL_COLOR;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);

    // Fill quad if all 4 anchors present
    if (c && d) {
      ctx.globalAlpha = selected ? 0.14 : 0.08;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(d.x, d.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Top segment
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // Bottom segment (if placed)
    if (c && d) {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }

    if (drawing.options.axisLabel) {
      const canvasW = viewport.width;
      const pw = viewport.priceAxisWidth;
      drawPriceLabel(ctx, drawing.anchors[0].price, a.y, canvasW, color, pw);
      if (c) drawPriceLabel(ctx, drawing.anchors[2].price, c.y, canvasW, color, pw);
    }

    ctx.restore();
  }

  override renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.globalAlpha = 1;
    for (const anchor of draft.anchors) {
      drawCircleHandle(ctx, dataToScreen(anchor, viewport), 5, draft.options.color || DISJOINT_CHANNEL_COLOR, false);
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
    const pts = drawing.anchors.map((a) => dataToScreen(a, viewport));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      xRange: [Math.min(...xs), Math.max(...xs)],
      yRange: [Math.min(...ys), Math.max(...ys)],
    };
  }
}
