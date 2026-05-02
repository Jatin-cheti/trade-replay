/**
 * Gann Box — TradingView parity.
 * Rectangle box with internal grid at fib-multiples horizontally + vertically,
 * plus diagonals 1×1 and 1×8 across the box. Anchor count: 2.
 */
import type { Drawing, DrawingVariant, Viewport, AxisHighlight } from '../types.ts';
import { dataToScreen, drawCircleHandle } from '../geometry.ts';
import { FibBaseTool, rgbFromHex, colorForFibLevel, resolveLevels } from './fibBase.ts';

const DEFAULTS: readonly number[] = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1];

export class GannBoxTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'gannBox';
  readonly label = 'Gann Box';
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
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    const w = right - left;
    const hgt = bottom - top;
    const levels = resolveLevels(drawing.options, DEFAULTS);
    const baseAlpha = drawing.options.opacity ?? 1;
    const fallback = drawing.options.color;

    ctx.save();
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    // Horizontal grid lines.
    for (const lv of levels) {
      const y = top + hgt * lv;
      ctx.strokeStyle = `rgba(${rgbFromHex(colorForFibLevel(lv, fallback))}, ${baseAlpha})`;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    // Vertical grid lines.
    for (const lv of levels) {
      const x = left + w * lv;
      ctx.strokeStyle = `rgba(${rgbFromHex(colorForFibLevel(lv, fallback))}, ${baseAlpha})`;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    // Diagonals.
    ctx.strokeStyle = `rgba(${rgbFromHex(fallback)}, ${baseAlpha})`;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, bottom);
    ctx.moveTo(right, top);
    ctx.lineTo(left, bottom);
    ctx.stroke();
    if (selected || hovered) {
      drawCircleHandle(ctx, a, 5, fallback, false);
      drawCircleHandle(ctx, b, 5, fallback, false);
    }
    ctx.restore();
  }
}
