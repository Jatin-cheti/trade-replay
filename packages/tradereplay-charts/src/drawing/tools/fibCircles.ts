/**
 * Fib Circles — TradingView parity.
 * Concentric circles centered at anchor[0], radii at fib multiples of |a-b|.
 * Anchor count: 2.
 */
import type { Drawing, DrawingVariant, Viewport, AxisHighlight } from '../types.ts';
import { dataToScreen, drawCircleHandle, distancePx } from '../geometry.ts';
import { FibBaseTool, rgbFromHex, colorForFibLevel, resolveLevels } from './fibBase.ts';

const DEFAULTS: readonly number[] = [0.382, 0.5, 0.618, 1, 1.618, 2.618];

export class FibCirclesTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'fibCircles';
  readonly label = 'Fib Circles';
  protected override getDefaultLevels(): readonly number[] {
    return DEFAULTS;
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
    const r = distancePx(a, b);
    if (r === 0) return;
    const levels = resolveLevels(drawing.options, DEFAULTS);
    const baseAlpha = drawing.options.opacity ?? 1;
    const fallback = drawing.options.color;

    ctx.save();
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    for (const lv of levels) {
      ctx.strokeStyle = `rgba(${rgbFromHex(colorForFibLevel(lv, fallback))}, ${baseAlpha})`;
      ctx.beginPath();
      ctx.arc(a.x, a.y, r * lv, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(120, 123, 134, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (selected || hovered) {
      drawCircleHandle(ctx, a, 5, fallback, false);
      drawCircleHandle(ctx, b, 5, fallback, false);
    }
    ctx.restore();
  }

  override getAxisHighlight(drawing: Drawing, viewport: Viewport): AxisHighlight | null {
    if (drawing.anchors.length < 2) return null;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const r = distancePx(a, b);
    return {
      xRange: [a.x - r, a.x + r],
      yRange: [a.y - r, a.y + r],
    };
  }
}
