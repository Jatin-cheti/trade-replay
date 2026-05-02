/**
 * Fib Speed Resistance Fan — TradingView parity.
 * Diagonal rays from anchor[0] passing through the fib-level points along
 * the rectangle defined by anchor[0]→anchor[1].
 * Levels (default): 0.382, 0.5, 0.618.
 * Anchor count: 2.
 */
import type { Drawing, DrawingVariant, Viewport, AxisHighlight } from '../types.ts';
import { dataToScreen, drawCircleHandle, rayEndpoint } from '../geometry.ts';
import { FibBaseTool, rgbFromHex, colorForFibLevel, resolveLevels } from './fibBase.ts';

const DEFAULTS: readonly number[] = [0.382, 0.5, 0.618];

export class FibSpeedResistFanTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'fibSpeedResistFan';
  readonly label = 'Fib Speed Resistance Fan';
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
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;
    const levels = resolveLevels(drawing.options, DEFAULTS);
    const baseAlpha = drawing.options.opacity ?? 1;
    const fallback = drawing.options.color;

    ctx.save();
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    // Diagonal main fan line a→b extended.
    const mainEnd = rayEndpoint(a, b, w, h);
    ctx.strokeStyle = `rgba(${rgbFromHex(colorForFibLevel(0.5, fallback))}, ${baseAlpha})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(mainEnd.x, mainEnd.y);
    ctx.stroke();

    // Per-level rays: each ray passes through point (b.x, a.y + (b.y - a.y) * level).
    for (const lv of levels) {
      const y = a.y + (b.y - a.y) * lv;
      const through = { x: b.x, y };
      const end = rayEndpoint(a, through, w, h);
      const color = colorForFibLevel(lv, fallback);
      ctx.strokeStyle = `rgba(${rgbFromHex(color)}, ${baseAlpha})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      if (drawing.options.priceLabel ?? true) {
        ctx.font = `${Math.max(10, (drawing.options.textSize ?? 12) - 2)}px ${drawing.options.font ?? 'JetBrains Mono'}, sans-serif`;
        ctx.fillStyle = `rgba(${rgbFromHex(color)}, ${baseAlpha})`;
        ctx.textBaseline = 'middle';
        ctx.fillText(String(lv), b.x + 4, y);
      }
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
