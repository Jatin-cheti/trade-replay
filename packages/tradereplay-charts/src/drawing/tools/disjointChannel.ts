/**
 * DisjointChannel tool — two independent line segments with a fill between them.
 *
 * TV parity:
 * - 4 anchors: anchor[0]→anchor[1] = segment AB, anchor[2]→anchor[3] = segment CD
 * - Fill polygon: A → B → D → C (closed trapezoid)
 * - During 2-anchor preview: only segment AB shown.
 * - Hit test: any of the 4 border edges or inside the fill polygon.
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
  distanceToSegment,
  applyLineStyle,
  drawCircleHandle,
  hexToRgba,
} from '../geometry.ts';
import { BaseTool } from './base.ts';

type SP = { x: number; y: number };

function shoelaceContains(pt: SP, poly: SP[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export class DisjointChannelTool extends BaseTool {
  readonly variant = 'disjointChannel' as const;
  readonly label = 'Disjoint Channel';
  readonly anchorCount = 4;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: SP, viewport: Viewport): number {
    const anchors = drawing.anchors;
    if (anchors.length < 2) return Infinity;

    const a = dataToScreen(anchors[0], viewport);
    const b = dataToScreen(anchors[1], viewport);

    // Only 2 anchors: hit-test segment AB
    if (anchors.length < 4) {
      return distanceToSegment(pointer, a, b);
    }

    const c = dataToScreen(anchors[2], viewport);
    const d = dataToScreen(anchors[3], viewport);

    // Check fill interior
    const poly = [a, b, d, c];
    if (shoelaceContains(pointer, poly)) return 0;

    // Check 4 border segments
    return Math.min(
      distanceToSegment(pointer, a, b),
      distanceToSegment(pointer, c, d),
      distanceToSegment(pointer, b, d),
      distanceToSegment(pointer, a, c),
    );
  }

  override render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    viewport: Viewport,
    selected: boolean,
    hovered: boolean,
  ): void {
    const anchors = drawing.anchors;
    if (anchors.length < 2) return;

    const a = dataToScreen(anchors[0], viewport);
    const b = dataToScreen(anchors[1], viewport);
    const color = drawing.options.color;
    const lw = drawing.options.lineWidth + (selected ? 1 : 0);

    ctx.save();
    applyLineStyle(ctx, drawing.options.lineStyle, lw);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;

    if (anchors.length >= 4) {
      const c = dataToScreen(anchors[2], viewport);
      const d = dataToScreen(anchors[3], viewport);

      // Fill polygon A→B→D→C
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(d.x, d.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.08);
      ctx.fill();

      // Segment AB
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Segment CD
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();

      // Connecting sides (thin, semi-transparent like TV)
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    } else {
      // Preview with only AB
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if (selected || hovered) {
      for (const anchor of anchors) {
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
    return drawing.anchors.map((anchor, index) => ({
      anchorIndex: index,
      center: dataToScreen(anchor, viewport),
      radius: 5,
      active: false,
    }));
  }
}
