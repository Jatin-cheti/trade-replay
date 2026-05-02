/**
 * Gann Square — adjustable Gann square with 9 angles (1/8 .. 8/1).
 * Anchor count: 2 (defines the square's diagonal endpoints).
 */
import type { Drawing, DrawingVariant, Viewport, AxisHighlight } from '../types.ts';
import { dataToScreen, drawCircleHandle } from '../geometry.ts';
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

export class GannSquareTool extends FibBaseTool {
  readonly variant: DrawingVariant = 'gannSquare';
  readonly label = 'Gann Square';

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
    const baseAlpha = drawing.options.opacity ?? 1;
    const fallback = drawing.options.color;
    ctx.save();
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    ctx.strokeStyle = `rgba(${rgbFromHex(fallback)}, ${baseAlpha})`;
    // Outer rectangle.
    ctx.strokeRect(left, top, w, hgt);
    // Diagonals 1/1 and 1/-1.
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(right, top);
    ctx.moveTo(left, top);
    ctx.lineTo(right, bottom);
    ctx.stroke();
    // Angular rays from origin (left,bottom).
    for (const ang of ANGLES) {
      const dy = -ang.m * w; // 1/1 means rise = run = w
      const ex = right;
      const ey = bottom + dy;
      ctx.beginPath();
      ctx.moveTo(left, bottom);
      ctx.lineTo(ex, Math.max(top, ey));
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
