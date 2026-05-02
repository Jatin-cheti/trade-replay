/**
 * Pitchfork tools — Andrews' Pitchfork and variants.
 *
 * TV parity variants:
 * - pitchfork           : Origin=anchor[0], target=mid(anchor[1],anchor[2]), offsetScale=1.0
 * - schiffPitchfork     : Origin=mid(anchor[0],anchor[1]), target=anchor[2], offsetScale=1.0
 * - modifiedSchiffPitchfork: Origin=mid(anchor[0],anchor[1]), target=anchor[2], offsetScale=0.82
 * - insidePitchfork     : Origin=mid(anchor[0],anchor[1]), target=anchor[2], offsetScale=0.62
 *
 * Renders:
 * - Median line from origin → target (extended as ray)
 * - Upper prong (ray from origin through targetOffsetUp)
 * - Lower prong (ray from origin through targetOffsetDown)
 * - Dashed trigger leg connecting anchor[1] → anchor[2]
 * - Translucent fill between upper and lower prongs
 *
 * Hit test: near any of the three prong rays
 */

import type {
  Drawing,
  DrawPoint,
  HandleDescriptor,
  DrawingOptions,
  Viewport,
  AxisHighlight,
  DrawingVariant,
} from '../types.ts';
import {
  dataToScreen,
  distanceToLine,
  distanceToSegment,
  rayEndpoint,
  clipSegment,
  applyLineStyle,
  drawCircleHandle,
  drawPriceLabel,
} from '../geometry.ts';
import type { ScreenPoint } from '../types.ts';
import { BaseTool } from './base.ts';

type PitchforkVariant = Extract<DrawingVariant, 'pitchfork' | 'schiffPitchfork' | 'modifiedSchiffPitchfork' | 'insidePitchfork'>;

function midpoint(a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function computePitchforkGeometry(
  pts: [ScreenPoint, ScreenPoint, ScreenPoint],
  variant: PitchforkVariant,
  w: number,
  h: number,
) {
  const [p0, p1, p2] = pts;

  // Determine origin and target based on variant
  let origin: ScreenPoint;
  let medTarget: ScreenPoint;
  let offsetScale: number;

  if (variant === 'pitchfork') {
    origin = p0;
    medTarget = midpoint(p1, p2);
    offsetScale = 1.0;
  } else {
    origin = midpoint(p0, p1);
    medTarget = p2;
    offsetScale = variant === 'insidePitchfork' ? 0.62 :
                  variant === 'modifiedSchiffPitchfork' ? 0.82 : 1.0;
  }

  // The half-offset vector perpendicular to median line direction
  const medDx = medTarget.x - origin.x;
  const medDy = medTarget.y - origin.y;

  // Perpendicular to direction (p2 - p1) rotated by offsetScale
  const halfVx = (p2.x - p1.x) / 2 * offsetScale;
  const halfVy = (p2.y - p1.y) / 2 * offsetScale;

  // Upper target: medTarget shifted by halfV
  const upperTarget: ScreenPoint = { x: medTarget.x - halfVy, y: medTarget.y + halfVx };
  const lowerTarget: ScreenPoint = { x: medTarget.x + halfVy, y: medTarget.y - halfVx };

  // Extend all three rays to canvas edge
  const medEndPt = rayEndpoint(origin, medTarget, w, h);
  const upperEndPt = rayEndpoint(origin, upperTarget, w, h);
  const lowerEndPt = rayEndpoint(origin, lowerTarget, w, h);

  const medSeg = clipSegment(origin, medEndPt, w, h);
  const upperSeg = clipSegment(origin, upperEndPt, w, h);
  const lowerSeg = clipSegment(origin, lowerEndPt, w, h);

  return {
    origin,
    medTarget,
    medSeg,
    upperSeg,
    lowerSeg,
    triggerStart: p1,
    triggerEnd: p2,
  };
}

class PitchforkToolBase extends BaseTool {
  readonly anchorCount = 3;
  readonly isPointOnly = false;
  protected _variant: PitchforkVariant;
  readonly variant: DrawingVariant;
  readonly label: string;

  constructor(variant: PitchforkVariant, label: string) {
    super();
    this._variant = variant;
    this.variant = variant;
    this.label = label;
  }

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 3) return Infinity;
    const pts = drawing.anchors.map((a) => dataToScreen(a, viewport)) as [ScreenPoint, ScreenPoint, ScreenPoint];
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;

    const geo = computePitchforkGeometry(pts, this._variant, w, h);
    const p = pointer;

    let best = Infinity;
    if (geo.medSeg) best = Math.min(best, distanceToSegment(p, geo.medSeg[0], geo.medSeg[1]));
    if (geo.upperSeg) best = Math.min(best, distanceToSegment(p, geo.upperSeg[0], geo.upperSeg[1]));
    if (geo.lowerSeg) best = Math.min(best, distanceToSegment(p, geo.lowerSeg[0], geo.lowerSeg[1]));
    best = Math.min(best, distanceToSegment(p, geo.triggerStart, geo.triggerEnd));
    return best;
  }

  override render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    viewport: Viewport,
    selected: boolean,
    hovered: boolean,
  ): void {
    if (drawing.anchors.length < 3) return;
    const pts = drawing.anchors.map((a) => dataToScreen(a, viewport)) as [ScreenPoint, ScreenPoint, ScreenPoint];
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;

    const geo = computePitchforkGeometry(pts, this._variant, w, h);
    const color = drawing.options.color;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);

    // Fill between prongs
    if (geo.upperSeg && geo.lowerSeg) {
      ctx.globalAlpha = selected ? 0.12 : 0.07;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(geo.upperSeg[0].x, geo.upperSeg[0].y);
      ctx.lineTo(geo.upperSeg[1].x, geo.upperSeg[1].y);
      ctx.lineTo(geo.lowerSeg[1].x, geo.lowerSeg[1].y);
      ctx.lineTo(geo.lowerSeg[0].x, geo.lowerSeg[0].y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);

    // Median line
    if (geo.medSeg) {
      ctx.beginPath();
      ctx.moveTo(geo.medSeg[0].x, geo.medSeg[0].y);
      ctx.lineTo(geo.medSeg[1].x, geo.medSeg[1].y);
      ctx.stroke();
    }

    // Upper prong
    if (geo.upperSeg) {
      ctx.beginPath();
      ctx.moveTo(geo.upperSeg[0].x, geo.upperSeg[0].y);
      ctx.lineTo(geo.upperSeg[1].x, geo.upperSeg[1].y);
      ctx.stroke();
    }

    // Lower prong
    if (geo.lowerSeg) {
      ctx.beginPath();
      ctx.moveTo(geo.lowerSeg[0].x, geo.lowerSeg[0].y);
      ctx.lineTo(geo.lowerSeg[1].x, geo.lowerSeg[1].y);
      ctx.stroke();
    }

    // Dashed trigger leg connecting anchor[1]→anchor[2]
    ctx.setLineDash([6, 4]);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(geo.triggerStart.x, geo.triggerStart.y);
    ctx.lineTo(geo.triggerEnd.x, geo.triggerEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  override renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.globalAlpha = 1;
    for (const anchor of draft.anchors) {
      drawCircleHandle(ctx, dataToScreen(anchor, viewport), 5, draft.options.color, false);
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

  override getAxisHighlight(drawing: Drawing, viewport: Viewport): AxisHighlight | null {
    if (drawing.anchors.length < 3) return null;
    const pts = drawing.anchors.map((a) => dataToScreen(a, viewport));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      xRange: [Math.min(...xs), Math.max(...xs)],
      yRange: [Math.min(...ys), Math.max(...ys)],
    };
  }
}

/** Andrews' Pitchfork */
export class PitchforkTool extends PitchforkToolBase {
  constructor() { super('pitchfork', "Andrews' Pitchfork"); }
}

/** Schiff Pitchfork */
export class SchiffPitchforkTool extends PitchforkToolBase {
  constructor() { super('schiffPitchfork', 'Schiff Pitchfork'); }
}

/** Modified Schiff Pitchfork */
export class ModifiedSchiffPitchforkTool extends PitchforkToolBase {
  constructor() { super('modifiedSchiffPitchfork', 'Modified Schiff Pitchfork'); }
}

/** Inside Pitchfork */
export class InsidePitchforkTool extends PitchforkToolBase {
  constructor() { super('insidePitchfork', 'Inside Pitchfork'); }
}
