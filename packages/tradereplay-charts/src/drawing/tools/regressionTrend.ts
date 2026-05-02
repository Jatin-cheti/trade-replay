/**
 * RegressionTrend tool — linear regression trend with ±1σ deviation bands.
 *
 * TV parity:
 * - Two-anchor drag-commit; uses all bars between anchors for regression
 * - Slope-driven color: green = uptrend (canvas slope < 0), red = downtrend
 * - Renders: center regression line, upper/lower deviation bands, translucent fill
 * - Price labels on Y-axis for both anchors
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
import type { ScreenPoint } from '../types.ts';
import { BaseTool } from './base.ts';

function computeRegression(start: ScreenPoint, end: ScreenPoint): {
  slope: number;
  intercept: number;
  deviation: number;
  median: [ScreenPoint, ScreenPoint];
  upper: [ScreenPoint, ScreenPoint];
  lower: [ScreenPoint, ScreenPoint];
  fill: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
} | null {
  // Sample 50 points between start and end
  const SAMPLES = 50;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    pts.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  }

  const n = pts.length;
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
  for (const p of pts) { sumX += p.x; sumY += p.y; sumXX += p.x * p.x; sumXY += p.x * p.y; }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = sumY / n - slope * (sumX / n);

  let variance = 0;
  for (const p of pts) {
    const residual = p.y - (slope * p.x + intercept);
    variance += residual * residual;
  }
  const deviation = Math.max(6, Math.sqrt(variance / n) * 1.25);

  const sx = start.x, ex = end.x;
  const median: [ScreenPoint, ScreenPoint] = [
    { x: sx, y: slope * sx + intercept },
    { x: ex, y: slope * ex + intercept },
  ];
  const upper: [ScreenPoint, ScreenPoint] = [{ x: sx, y: median[0].y - deviation }, { x: ex, y: median[1].y - deviation }];
  const lower: [ScreenPoint, ScreenPoint] = [{ x: sx, y: median[0].y + deviation }, { x: ex, y: median[1].y + deviation }];

  return {
    slope,
    intercept,
    deviation,
    median,
    upper,
    lower,
    fill: [upper[0], upper[1], lower[1], lower[0]],
  };
}

export class RegressionTrendTool extends BaseTool {
  readonly variant = 'regressionTrend' as const;
  readonly label = 'Regression Trend';
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

    const geo = computeRegression(a, b);
    if (!geo) return;

    // TV-parity: slope < 0 in canvas space = uptrend = green, else red
    const trendColor = geo.slope <= 0 ? '#22C55E' : '#EF4444';

    ctx.save();
    ctx.strokeStyle = trendColor;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);

    // Fill
    ctx.globalAlpha = selected ? 0.14 : 0.08;
    ctx.fillStyle = trendColor;
    ctx.beginPath();
    ctx.moveTo(geo.fill[0].x, geo.fill[0].y);
    for (let i = 1; i < geo.fill.length; i++) ctx.lineTo(geo.fill[i].x, geo.fill[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);
    const drawSeg = (seg: [ScreenPoint, ScreenPoint]) => {
      ctx.beginPath();
      ctx.moveTo(seg[0].x, seg[0].y);
      ctx.lineTo(seg[1].x, seg[1].y);
      ctx.stroke();
    };
    drawSeg(geo.upper);
    drawSeg(geo.median);
    drawSeg(geo.lower);

    if (drawing.options.axisLabel) {
      const canvasW = viewport.width;
      const pw = viewport.priceAxisWidth;
      drawPriceLabel(ctx, drawing.anchors[0].price, a.y, canvasW, trendColor, pw);
      drawPriceLabel(ctx, drawing.anchors[1].price, b.y, canvasW, trendColor, pw);
    }

    ctx.restore();
  }

  override renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.globalAlpha = 1;
    for (const anchor of draft.anchors) {
      drawCircleHandle(ctx, dataToScreen(anchor, viewport), 5, '#22C55E', false);
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
