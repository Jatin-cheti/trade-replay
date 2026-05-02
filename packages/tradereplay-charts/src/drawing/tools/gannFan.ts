/**
 * Gann Fan — TradingView parity.
 * 8 rays from anchor[0] at slopes 1/8, 1/4, 1/3, 1/2, 1/1, 2/1, 3/1, 4/1, 8/1
 * relative to the unit defined by anchor[0]→anchor[1].
 * Anchor count: 2.
 */
import type { Drawing, DrawingVariant, Viewport, AxisHighlight } from '../types.ts';
import { dataToScreen, drawCircleHandle, rayEndpoint } from '../geometry.ts';
import { FibBaseTool, rgbFromHex } from './fibBase.ts';

const ANGLES: readonly { label: string; m: number }[] = [
  { label: '1/8', m: 1 / 8 },
  { label: '1/4', m: 1 / 4 },
  { label: '1/3', m: 1 / 3 },
  { label: '1/2', m: 1 / 2 },
  { label: '1/1', m: 1 },
  { label: '2/1', m: 2 },
  { label: '3/1', m: 3 },
  { label: '4/1', m: 4 },
  { label: '8/1', m: 8 },
];

export class GannFanTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'gannFan';
  readonly label = 'Gann Fan';

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
    const dx = b.x - a.x;
    const dy = b.y - a.y; // 1/1 baseline slope
    const baseAlpha = drawing.options.opacity ?? 1;
    const fallback = drawing.options.color;
    ctx.save();
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    ctx.strokeStyle = `rgba(${rgbFromHex(fallback)}, ${baseAlpha})`;
    for (const ang of ANGLES) {
      // Slope = ang.m relative to baseline (1/1). For ratios > 1 we shrink x; for < 1 we shrink y.
      const through = ang.m >= 1
        ? { x: a.x + dx / ang.m, y: a.y + dy }
        : { x: a.x + dx, y: a.y + dy * ang.m };
      const end = rayEndpoint(a, through, w, h);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      if (drawing.options.priceLabel ?? true) {
        ctx.font = `${Math.max(10, (drawing.options.textSize ?? 12) - 2)}px ${drawing.options.font ?? 'JetBrains Mono'}, sans-serif`;
        ctx.fillStyle = `rgba(${rgbFromHex(fallback)}, ${baseAlpha})`;
        ctx.fillText(ang.label, end.x - 24, end.y - 4);
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
