/**
 * Fib Spiral — TradingView parity.
 * Logarithmic (golden) spiral originating at anchor[0], scaled so that one
 * quarter-turn radius equals |a-b|. Anchor count: 2.
 */
import type { Drawing, DrawingVariant, Viewport, AxisHighlight } from '../types.ts';
import { dataToScreen, drawCircleHandle, distancePx } from '../geometry.ts';
import { FibBaseTool, rgbFromHex } from './fibBase.ts';

const PHI = 1.6180339887;

export class FibSpiralTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'fibSpiral';
  readonly label = 'Fib Spiral';

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
    const r0 = distancePx(a, b);
    if (r0 === 0) return;
    const baseAlpha = drawing.options.opacity ?? 1;
    const fallback = drawing.options.color;
    const startAngle = Math.atan2(b.y - a.y, b.x - a.x);
    // Logarithmic spiral: r(θ) = r0 * φ^(θ/(π/2)) — radius grows by φ per quarter-turn.
    const k = Math.log(PHI) / (Math.PI / 2);
    const turns = 4;
    const samples = 240;
    ctx.save();
    ctx.strokeStyle = `rgba(${rgbFromHex(fallback)}, ${baseAlpha})`;
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    ctx.beginPath();
    for (let i = 0; i <= samples * turns; i += 1) {
      const theta = (i / samples) * 2 * Math.PI;
      const r = r0 * Math.exp(k * theta);
      const x = a.x + r * Math.cos(startAngle + theta);
      const y = a.y + r * Math.sin(startAngle + theta);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (selected || hovered) {
      drawCircleHandle(ctx, a, 5, fallback, false);
      drawCircleHandle(ctx, b, 5, fallback, false);
    }
    ctx.restore();
  }

  override getAxisHighlight(): AxisHighlight | null {
    return null;
  }
}
