/**
 * Fib Channel — TradingView parity.
 * Two parallel diagonal lines with extra parallels at fib offsets between them.
 * Anchor count: 2 (defines the trend; fib levels are projected perpendicular).
 */
import type { Drawing, DrawingVariant, Viewport, AxisHighlight } from '../types.ts';
import { dataToScreen, drawCircleHandle } from '../geometry.ts';
import { FibBaseTool, TV_FIB_COLORS, rgbFromHex, colorForFibLevel, formatFibLabel, resolveLevels } from './fibBase.ts';

const DEFAULTS: readonly number[] = [0, 0.5, 1, 1.5, 2];

export class FibChannelTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'fibChannel';
  readonly label = 'Fib Channel';
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

    ctx.save();
    // Each fib level shifts the b.y vertically by `level * (b.y - a.y)`.
    for (const lv of levels) {
      const dy = (b.y - a.y) * lv;
      const color = colorForFibLevel(lv, fallback);
      ctx.strokeStyle = `rgba(${rgbFromHex(color)}, ${baseAlpha})`;
      ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
      ctx.setLineDash(lv === 0 || lv === 1 ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + dy);
      ctx.lineTo(b.x, b.y + dy);
      ctx.stroke();

      if (drawing.options.priceLabel ?? true) {
        const fromAnchor = drawing.anchors[0];
        const toAnchor = drawing.anchors[1];
        const dPrice = (toAnchor.price - fromAnchor.price) * lv;
        const label = formatFibLabel(lv, toAnchor.price + dPrice, drawing.options.fibLabelMode ?? 'ratio-price');
        ctx.font = `${Math.max(10, (drawing.options.textSize ?? 12) - 2)}px ${drawing.options.font ?? 'JetBrains Mono'}, sans-serif`;
        ctx.fillStyle = `rgba(${rgbFromHex(color)}, ${baseAlpha})`;
        ctx.textBaseline = 'middle';
        ctx.fillText(label, b.x + 6, b.y + dy);
      }
    }
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
    return {
      xRange: [Math.min(a.x, b.x), Math.max(a.x, b.x)],
      yRange: [Math.min(a.y, b.y), Math.max(a.y, b.y)],
    };
  }
}

// Re-export TV_FIB_COLORS for downstream consumers.
export { TV_FIB_COLORS };
