/**
 * Trend-Based Fib Time — TradingView parity.
 * Vertical lines at fib multiples of the time-distance between anchor[0] and anchor[1].
 * Anchor count: 2.
 */
import type { Drawing, DrawingVariant, Viewport, AxisHighlight } from '../types.ts';
import { dataToScreen, drawCircleHandle } from '../geometry.ts';
import { FibBaseTool, rgbFromHex, colorForFibLevel, resolveLevels, formatFibLabel } from './fibBase.ts';

const DEFAULTS: readonly number[] = [0, 0.382, 0.618, 1, 1.382, 1.618, 2, 2.618];

export class FibTrendTimeTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'fibTrendTime';
  readonly label = 'Trend-based Fib Time';
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
    const unit = b.x - a.x;
    if (unit === 0) return;
    const levels = resolveLevels(drawing.options, DEFAULTS);
    const baseAlpha = drawing.options.opacity ?? 1;
    const top = 0;
    const bottom = viewport.height - viewport.timeAxisHeight;
    const fallback = drawing.options.color;

    ctx.save();
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    for (const lv of levels) {
      const x = a.x + unit * lv;
      const color = colorForFibLevel(lv, fallback);
      ctx.strokeStyle = `rgba(${rgbFromHex(color)}, ${baseAlpha})`;
      ctx.setLineDash(lv === 0 || lv === 1 ? [] : [3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      if (drawing.options.priceLabel ?? true) {
        ctx.font = `${Math.max(10, (drawing.options.textSize ?? 12) - 2)}px ${drawing.options.font ?? 'JetBrains Mono'}, sans-serif`;
        ctx.fillStyle = `rgba(${rgbFromHex(color)}, ${baseAlpha})`;
        ctx.textBaseline = 'top';
        ctx.fillText(formatFibLabel(lv, lv, 'ratio'), x + 4, top + 4);
      }
    }
    ctx.setLineDash([]);
    // Dashed connector between anchors.
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
    return { xRange: [Math.min(a.x, b.x), Math.max(a.x, b.x)], yRange: null };
  }
}
