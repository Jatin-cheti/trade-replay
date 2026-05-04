/**
 * FlatTopBottom tool — two horizontal lines spanning full canvas width with a fill.
 *
 * TV parity:
 * - 2 anchors: anchor[0].price = first horizontal level, anchor[1].price = second level
 * - Both lines extend the full canvas width (x: 0 → canvasWidth)
 * - Semi-transparent fill rectangle between the two price levels
 * - Hit test: either line (within 6px) or inside the fill area
 */

import type {
  Drawing,
  DrawPoint,
  HandleDescriptor,
  DrawingOptions,
  Viewport,
} from '../types.ts';
import {
  dataToScreen,
  applyLineStyle,
  drawCircleHandle,
  hexToRgba,
} from '../geometry.ts';
import { BaseTool } from './base.ts';

type SP = { x: number; y: number };

export class FlatTopBottomTool extends BaseTool {
  readonly variant = 'flatTopBottom' as const;
  readonly label = 'Flat Top/Bottom';
  readonly anchorCount = 2;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: SP, viewport: Viewport): number {
    if (drawing.anchors.length < 2) {
      // 1-anchor preview: hit-test against the single horizontal line
      if (drawing.anchors.length < 1) return Infinity;
      const a = dataToScreen(drawing.anchors[0], viewport);
      return Math.abs(pointer.y - a.y);
    }

    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const w = viewport.width;

    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    // Inside fill
    if (pointer.x >= 0 && pointer.x <= w && pointer.y >= minY && pointer.y <= maxY) {
      return 0;
    }

    // Distance to either horizontal line
    const d1 = Math.abs(pointer.y - a.y);
    const d2 = Math.abs(pointer.y - b.y);
    return Math.min(d1, d2);
  }

  override render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    viewport: Viewport,
    selected: boolean,
    hovered: boolean,
  ): void {
    if (drawing.anchors.length < 1) return;
    const color = drawing.options.color;
    const lw = drawing.options.lineWidth + (selected ? 1 : 0);
    const canvasW = viewport.width;

    const a = dataToScreen(drawing.anchors[0], viewport);

    ctx.save();
    applyLineStyle(ctx, drawing.options.lineStyle, lw);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;

    if (drawing.anchors.length >= 2) {
      const b = dataToScreen(drawing.anchors[1], viewport);
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);

      // Fill
      ctx.fillStyle = hexToRgba(color, 0.08);
      ctx.fillRect(0, minY, canvasW, maxY - minY);

      // Top horizontal line
      ctx.beginPath();
      ctx.moveTo(0, a.y);
      ctx.lineTo(canvasW, a.y);
      ctx.stroke();

      // Bottom horizontal line
      ctx.beginPath();
      ctx.moveTo(0, b.y);
      ctx.lineTo(canvasW, b.y);
      ctx.stroke();
    } else {
      // First anchor only — show single line
      ctx.beginPath();
      ctx.moveTo(0, a.y);
      ctx.lineTo(canvasW, a.y);
      ctx.stroke();
    }

    if (selected || hovered) {
      for (const anchor of drawing.anchors) {
        const sp = dataToScreen(anchor, viewport);
        drawCircleHandle(ctx, sp, 5, color, true);
      }
    }

    ctx.restore();
  }

  override renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.globalAlpha = 1;
    for (const anchor of draft.anchors) {
      const sp = dataToScreen(anchor, viewport);
      drawCircleHandle(ctx, sp, 5, draft.options.color, false);
    }
    ctx.restore();
  }

  override getHandles(drawing: Drawing, viewport: Viewport): HandleDescriptor[] {
    if (drawing.anchors.length < 2) return [];
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const midX = viewport.width / 2;
    return [
      { anchorIndex: 0, center: { x: midX, y: a.y }, radius: 5, active: false },
      { anchorIndex: 1, center: { x: midX, y: b.y }, radius: 5, active: false },
    ];
  }
}
