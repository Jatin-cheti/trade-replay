/**
 * Fib Time Zone — TradingView parity.
 * Vertical lines spaced at Fibonacci sequence multiples of the unit width
 * (anchor[0]→anchor[1] is the unit). Default Fib indices: 1,2,3,5,8,13,21,34.
 * Anchor count: 2.
 */
import type { Drawing, DrawingVariant, Viewport, AxisHighlight } from '../types.ts';
import { dataToScreen, drawCircleHandle } from '../geometry.ts';
import { FibBaseTool, rgbFromHex, resolveLevels } from './fibBase.ts';

const FIB_TIME_INDICES: readonly number[] = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55];

export class FibTimeZoneTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'fibTimeZone';
  readonly label = 'Fib Time Zone';
  protected override getDefaultLevels(): readonly number[] {
    return FIB_TIME_INDICES;
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
    const indices = resolveLevels(drawing.options, FIB_TIME_INDICES);
    const baseAlpha = drawing.options.opacity ?? 1;
    const top = 0;
    const bottom = viewport.height - viewport.timeAxisHeight;

    ctx.save();
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    ctx.strokeStyle = `rgba(${rgbFromHex(drawing.options.color)}, ${baseAlpha})`;
    for (const idx of indices) {
      const x = a.x + unit * idx;
      ctx.setLineDash(idx === 0 || idx === 1 ? [] : [3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      if (drawing.options.priceLabel ?? true) {
        ctx.font = `${Math.max(10, (drawing.options.textSize ?? 12) - 2)}px ${drawing.options.font ?? 'JetBrains Mono'}, sans-serif`;
        ctx.fillStyle = `rgba(${rgbFromHex(drawing.options.color)}, ${baseAlpha})`;
        ctx.textBaseline = 'top';
        ctx.fillText(String(idx), x + 4, top + 4);
      }
    }
    ctx.setLineDash([]);
    if (selected || hovered) {
      drawCircleHandle(ctx, a, 5, drawing.options.color, false);
      drawCircleHandle(ctx, b, 5, drawing.options.color, false);
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
