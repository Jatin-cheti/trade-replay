/**
 * Gann Square Fixed — fixed-aspect Gann square with 1×1, 1×2, 1×4, 1×8 angles.
 * Anchor count: 1 (origin) — extends the square fixed-size to the right.
 */
import type { Drawing, DrawPoint, DrawingVariant, DrawingOptions, Viewport, AxisHighlight, HandleDescriptor } from '../types.ts';
import { dataToScreen, drawCircleHandle, distancePx } from '../geometry.ts';
import { BaseTool } from './base.ts';
import { rgbFromHex } from './fibBase.ts';

const ANGLES: readonly { ratio: string; m: number }[] = [
  { ratio: '1/8', m: 1 / 8 },
  { ratio: '1/4', m: 1 / 4 },
  { ratio: '1/3', m: 1 / 3 },
  { ratio: '1/2', m: 1 / 2 },
  { ratio: '1/1', m: 1 },
  { ratio: '2/1', m: 2 },
  { ratio: '3/1', m: 3 },
  { ratio: '4/1', m: 4 },
  { ratio: '8/1', m: 8 },
];

export class GannSquareFixedTool extends BaseTool {
  readonly variant: DrawingVariant = 'gannSquareFixed';
  readonly label = 'Gann Square Fixed';
  readonly anchorCount = 1;
  override readonly isPointOnly = true;

  override createDraft(p1: DrawPoint, options: DrawingOptions): Drawing {
    return this._makeDrawing([{ ...p1 }], options);
  }

  override render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    viewport: Viewport,
    selected: boolean,
    hovered: boolean,
  ): void {
    if (drawing.anchors.length < 1) return;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const baseAlpha = drawing.options.opacity ?? 1;
    const fallback = drawing.options.color;
    const size = 200; // fixed canvas px square side
    ctx.save();
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    ctx.strokeStyle = `rgba(${rgbFromHex(fallback)}, ${baseAlpha})`;
    ctx.strokeRect(a.x, a.y - size, size, size);
    for (const ang of ANGLES) {
      const dx = size;
      const dy = -ang.m * size;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + dx, Math.max(a.y - size, a.y + dy));
      ctx.stroke();
      if (drawing.options.priceLabel ?? true) {
        ctx.font = `${Math.max(10, (drawing.options.textSize ?? 12) - 2)}px ${drawing.options.font ?? 'JetBrains Mono'}, sans-serif`;
        ctx.fillStyle = `rgba(${rgbFromHex(fallback)}, ${baseAlpha})`;
        ctx.fillText(ang.ratio, a.x + dx + 4, Math.max(a.y - size, a.y + dy));
      }
    }
    if (selected || hovered) {
      drawCircleHandle(ctx, a, 5, fallback, false);
    }
    ctx.restore();
  }

  override getHandles(drawing: Drawing, viewport: Viewport): HandleDescriptor[] {
    if (drawing.anchors.length < 1) return [];
    return [{ anchorIndex: 0, center: dataToScreen(drawing.anchors[0], viewport), radius: 5, active: false }];
  }

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 1) return Number.POSITIVE_INFINITY;
    const a = dataToScreen(drawing.anchors[0], viewport);
    return distancePx(a, pointer);
  }

  override getAxisHighlight(drawing: Drawing, viewport: Viewport): AxisHighlight | null {
    if (drawing.anchors.length < 1) return null;
    const a = dataToScreen(drawing.anchors[0], viewport);
    return { xRange: [a.x, a.x + 200], yRange: [a.y - 200, a.y] };
  }
}
