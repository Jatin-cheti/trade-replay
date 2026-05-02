/**
 * Fib Wedge — TradingView parity.
 * Anchor count: 2. Renders fib retracement levels as wedge-shaped (converging)
 * lines from anchor[0] to a horizontal line passing through anchor[1].
 */
import type { Drawing, DrawingVariant, Viewport, AxisHighlight } from '../types.ts';
import { dataToScreen, drawCircleHandle } from '../geometry.ts';
import { FibBaseTool, rgbFromHex, colorForFibLevel, resolveLevels } from './fibBase.ts';

const DEFAULTS: readonly number[] = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export class FibWedgeTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'fibWedge';
  readonly label = 'Fib Wedge';
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
    const levels = resolveLevels(drawing.options, DEFAULTS);
    const baseAlpha = drawing.options.opacity ?? 1;
    const fallback = drawing.options.color;
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const width = right - left;

    ctx.save();
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    for (const lv of levels) {
      const y = a.y + (b.y - a.y) * lv;
      const x = left + width * lv;
      ctx.strokeStyle = `rgba(${rgbFromHex(colorForFibLevel(lv, fallback))}, ${baseAlpha})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
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
    return {
      xRange: [Math.min(a.x, b.x), Math.max(a.x, b.x)],
      yRange: [Math.min(a.y, b.y), Math.max(a.y, b.y)],
    };
  }
}
