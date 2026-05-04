/**
 * SineLine tool — sinusoidal wave drawn between two anchor points.
 *
 * TV parity:
 * - 2 anchors: anchor[0] = start, anchor[1] = end
 * - The baseline runs from anchor[0] to anchor[1]
 * - A full sine cycle (2π) is drawn along the baseline direction
 * - Amplitude is proportional to the segment length (TV default ~15% of length)
 * - Hit test: checks distance to the rendered curve (sampled at 64 points)
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
} from '../geometry.ts';
import { BaseTool } from './base.ts';

type SP = { x: number; y: number };

const SAMPLE_COUNT = 64;
const AMPLITUDE_RATIO = 0.15; // amplitude = AMPLITUDE_RATIO * segment_length

function sinePoints(a: SP, b: SP): SP[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [a, b];

  // Unit along and unit perpendicular to baseline
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const amp = len * AMPLITUDE_RATIO;
  const pts: SP[] = [];

  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const t = i / SAMPLE_COUNT;
    const along = t * len;
    const wave = Math.sin(t * 2 * Math.PI) * amp;
    pts.push({
      x: a.x + ux * along + px * wave,
      y: a.y + uy * along + py * wave,
    });
  }
  return pts;
}

export class SineLineTool extends BaseTool {
  readonly variant = 'sineLine' as const;
  readonly label = 'Sine Line';
  readonly anchorCount = 2;
  readonly isPointOnly = false;

  override hitTest(drawing: Drawing, pointer: SP, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    const pts = sinePoints(a, b);

    let minDist = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distanceToSegment(pointer, pts[i], pts[i + 1]);
      if (d < minDist) minDist = d;
    }
    return minDist;
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
    const pts = sinePoints(a, b);

    const color = drawing.options.color;
    const lw = drawing.options.lineWidth + (selected ? 1 : 0);

    ctx.save();
    applyLineStyle(ctx, drawing.options.lineStyle, lw);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;

    if (selected || hovered) {
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 9;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = lw;
      applyLineStyle(ctx, drawing.options.lineStyle, lw);
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    if (selected || hovered) {
      drawCircleHandle(ctx, a, 5, color, true);
      drawCircleHandle(ctx, b, 5, color, true);
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
