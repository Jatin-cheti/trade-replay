/**
 * InfoLine tool — a trend line segment with a measurement info overlay.
 *
 * TV parity:
 * - Two anchor drag-commit line segment
 * - Renders the line + a tooltip/badge near the midpoint showing:
 *   price change (Δ), % change, bar count, time delta
 * - Price labels on Y-axis for both anchors
 * - Same selection/hit-test as TrendLine
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
  hexToRgba,
} from '../geometry.ts';
import { BaseTool } from './base.ts';

function formatDuration(deltaSeconds: number): string {
  const abs = Math.abs(deltaSeconds);
  if (abs < 60) return `${Math.round(abs)}s`;
  if (abs < 3600) return `${Math.round(abs / 60)}m`;
  if (abs < 86400) return `${Math.round(abs / 3600)}h`;
  return `${Math.round(abs / 86400)}d`;
}

export class InfoLineTool extends BaseTool {
  readonly variant = 'infoLine' as const;
  readonly label = 'Info Line';
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

    // Measurement badge at midpoint (TV parity info overlay)
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const p0 = drawing.anchors[0];
    const p1 = drawing.anchors[1];
    const priceDelta = p1.price - p0.price;
    const pctChange = p0.price !== 0 ? (priceDelta / Math.abs(p0.price)) * 100 : 0;
    const timeDelta = Number(p1.time) - Number(p0.time);
    const sign = priceDelta >= 0 ? '+' : '';
    const infoText = `${sign}${priceDelta.toFixed(2)} (${sign}${pctChange.toFixed(2)}%)  ${formatDuration(timeDelta)}`;

    ctx.font = `11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const metrics = ctx.measureText(infoText);
    const padX = 6, padY = 4;
    const bw = metrics.width + padX * 2;
    const bh = 18;
    const bx = midX - bw / 2;
    const by = midY - bh - 6;

    // Badge background
    ctx.fillStyle = hexToRgba(drawing.options.color, 0.88);
    ctx.beginPath();
    ctx.roundRect?.(bx, by, bw, bh, 3) ?? ctx.rect(bx, by, bw, bh);
    ctx.fill();

    // Badge text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(infoText, midX, by + bh / 2);

    if (drawing.options.axisLabel) {
      const canvasW = viewport.width;
      const pw = viewport.priceAxisWidth;
      drawPriceLabel(ctx, p0.price, a.y, canvasW, drawing.options.color, pw);
      drawPriceLabel(ctx, p1.price, b.y, canvasW, drawing.options.color, pw);
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
