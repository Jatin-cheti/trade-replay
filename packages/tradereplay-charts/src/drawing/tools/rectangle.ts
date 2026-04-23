/**
 * Rectangle tool — axis-aligned rectangle defined by two diagonal corners.
 *
 * TV parity:
 * - anchor[0] = top-left (or any corner), anchor[1] = opposite corner
 * - Fill with optional semi-transparent fill color
 * - Border with stroke
 * - Hit test: border within 6px OR inside fill area
 */

import type { Drawing, DrawPoint, HandleDescriptor, DrawingOptions, Viewport } from '../types.ts';
import { DEFAULT_DRAWING_OPTIONS } from '../types.ts';
import { dataToScreen, distanceToSegment, hexToRgba } from '../geometry.ts';
import { BaseTool } from './base.ts';

export class RectangleTool extends BaseTool {
  readonly variant = 'rectangle' as const;
  readonly label = 'Rectangle';
  readonly anchorCount = 2;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    // Check if inside fill area
    if (drawing.options.fillColor) {
      if (pointer.x >= minX && pointer.x <= maxX && pointer.y >= minY && pointer.y <= maxY) {
        return 0;
      }
    }

    // Check border edges
    const tl = { x: minX, y: minY };
    const tr = { x: maxX, y: minY };
    const br = { x: maxX, y: maxY };
    const bl = { x: minX, y: maxY };
    return Math.min(
      distanceToSegment(pointer, tl, tr),
      distanceToSegment(pointer, tr, br),
      distanceToSegment(pointer, br, bl),
      distanceToSegment(pointer, bl, tl),
    );
  }

  override getHandles(drawing: Drawing, viewport: Viewport): HandleDescriptor[] {
    if (drawing.anchors.length < 2) return [];
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    return [
      { anchorIndex: 0, center: { x: minX, y: minY }, radius: 5, active: false },
      { anchorIndex: 1, center: { x: maxX, y: maxY }, radius: 5, active: false },
      { anchorIndex: -1, center: { x: maxX, y: minY }, radius: 4, active: false },
      { anchorIndex: -1, center: { x: minX, y: maxY }, radius: 4, active: false },
    ];
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
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);

    ctx.save();

    // Fill
    if (drawing.options.fillColor) {
      ctx.fillStyle = drawing.options.fillColor;
      ctx.fillRect(x, y, w, h);
    } else {
      // Default semi-transparent fill
      ctx.fillStyle = hexToRgba(drawing.options.color, 0.1);
      ctx.fillRect(x, y, w, h);
    }

    // Selection highlight
    if (selected || hovered) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = drawing.options.color;
      ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
      ctx.globalAlpha = 1;
    }

    // Border
    ctx.strokeStyle = drawing.options.color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, w, h);

    ctx.restore();
  }

  override renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.8;
    this.render(ctx, draft, viewport, false, false);
    ctx.restore();
  }
}
