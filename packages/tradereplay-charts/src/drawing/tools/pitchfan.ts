/**
 * Pitchfan / Andrews Pitchfork — TradingView parity.
 * Anchor count: 3 (pivot + two reaction points).
 * Renders the median line (from pivot to midpoint of [a1,a2]) plus two
 * outer parallel lines through a1 and a2.
 */
import type { Drawing, DrawPoint, DrawingVariant, DrawingOptions, Viewport, AxisHighlight } from '../types.ts';
import { dataToScreen, drawCircleHandle, rayEndpoint } from '../geometry.ts';
import { BaseTool } from './base.ts';
import { rgbFromHex } from './fibBase.ts';

export class PitchfanTool extends BaseTool {
  readonly variant: DrawingVariant = 'pitchfan';
  readonly label = 'Pitchfan';
  readonly anchorCount = 3;

  override createDraft(p1: DrawPoint, options: DrawingOptions): Drawing {
    const anchors: DrawPoint[] = [{ ...p1 }, { ...p1 }, { ...p1 }];
    return this._makeDrawing(anchors, options);
  }

  override updateDraft(drawing: Drawing, pointer: DrawPoint, _vp: Viewport, anchorIndex?: number): Drawing {
    const idx = anchorIndex ?? drawing.anchors.length - 1;
    drawing.anchors[idx] = { ...pointer };
    return drawing;
  }

  override render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    viewport: Viewport,
    selected: boolean,
    hovered: boolean,
  ): void {
    if (drawing.anchors.length < 3) return;
    const p0 = dataToScreen(drawing.anchors[0], viewport);
    const p1 = dataToScreen(drawing.anchors[1], viewport);
    const p2 = dataToScreen(drawing.anchors[2], viewport);
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;
    const baseAlpha = drawing.options.opacity ?? 1;
    const fallback = drawing.options.color;

    ctx.save();
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    ctx.strokeStyle = `rgba(${rgbFromHex(fallback)}, ${baseAlpha})`;

    // Median line p0 → mid extended.
    const medEnd = rayEndpoint(p0, mid, w, h);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(medEnd.x, medEnd.y);
    ctx.stroke();

    // Outer parallel lines through p1 and p2 with the same direction (mid - p0).
    const dirX = medEnd.x - p0.x;
    const dirY = medEnd.y - p0.y;
    for (const through of [p1, p2]) {
      const end = { x: through.x + dirX, y: through.y + dirY };
      ctx.beginPath();
      ctx.moveTo(through.x, through.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // Reaction segment p1↔p2.
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(120, 123, 134, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (selected || hovered) {
      drawCircleHandle(ctx, p0, 5, fallback, false);
      drawCircleHandle(ctx, p1, 5, fallback, false);
      drawCircleHandle(ctx, p2, 5, fallback, false);
    }
    ctx.restore();
  }

  override getAxisHighlight(drawing: Drawing, viewport: Viewport): AxisHighlight | null {
    if (drawing.anchors.length < 3) return null;
    const pts = drawing.anchors.map((a) => dataToScreen(a, viewport));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { xRange: [Math.min(...xs), Math.max(...xs)], yRange: [Math.min(...ys), Math.max(...ys)] };
  }
}
