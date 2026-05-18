/**
 * Generic Pattern Tool — handles all multi-anchor chart pattern variants.
 *
 * TV parity: All patterns (ABCD, XABCD, Cypher, Head & Shoulders, Triangle,
 * Three Drives, Elliott waves, etc.) share the same rendering:
 * - Polyline connecting all anchors in order
 * - Semi-transparent fill polygon
 * - Per-anchor labels (A, B, C, D / 1-5 / LS, H, N, etc.)
 * - Elliott waves: dashed connector from first to last anchor
 *
 * Selection handles at every anchor.
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
  distanceToSegment,
  applyLineStyle,
  drawCircleHandle,
  drawPriceLabel,
} from '../geometry.ts';
import type { ScreenPoint } from '../types.ts';
import { BaseTool } from './base.ts';

type PatternVariant = Extract<DrawingVariant,
  | 'xabcd'
  | 'cypherPattern'
  | 'headAndShoulders'
  | 'abcdPattern'
  | 'trianglePattern'
  | 'threeDrives'
  | 'elliottImpulse'
  | 'elliottCorrection'
  | 'elliottTriangle'
  | 'elliottDoubleCombo'
  | 'elliottTripleCombo'
  | 'sineLine'
  | 'cyclicLines'
  | 'timeCycles'
>;

const ANCHOR_LABELS: Record<string, string[]> = {
  xabcd:           ['X', 'A', 'B', 'C', 'D'],
  cypherPattern:   ['X', 'A', 'B', 'C', 'D'],
  headAndShoulders:['LS', 'H', 'N', 'H', 'RS'],
  abcdPattern:     ['A', 'B', 'C', 'D'],
  trianglePattern: ['A', 'B', 'C'],
  threeDrives:     ['1', '2', '3', '4', '5', '6', '7'],
  elliottImpulse:  ['1', '2', '3', '4', '5'],
  elliottCorrection:['A', 'B', 'C'],
  elliottTriangle: ['A', 'B', 'C', 'D', 'E'],
  elliottDoubleCombo:['W', 'X', 'Y'],
  elliottTripleCombo:['W', 'X', 'Y', 'XX', 'Z'],
};

const ANCHOR_COUNTS: Partial<Record<string, number>> = {
  xabcd: 5, cypherPattern: 5, headAndShoulders: 5, abcdPattern: 4,
  trianglePattern: 3, threeDrives: 7, elliottImpulse: 5,
  elliottCorrection: 3, elliottTriangle: 5, elliottDoubleCombo: 3,
  elliottTripleCombo: 5, sineLine: 2, cyclicLines: 2, timeCycles: 2,
};

class PatternTool extends BaseTool {
  readonly variant: DrawingVariant;
  readonly label: string;
  readonly anchorCount: number;
  readonly isPointOnly = false;
  private readonly _isElliott: boolean;
  private readonly _isCyclic: boolean;

  constructor(variant: PatternVariant, label: string) {
    super();
    this.variant = variant;
    this.label = label;
    this.anchorCount = ANCHOR_COUNTS[variant] ?? 2;
    this._isElliott = variant.startsWith('elliott');
    this._isCyclic = variant === 'cyclicLines' || variant === 'timeCycles';
  }

  override hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const pts = drawing.anchors.map((a) => dataToScreen(a, viewport));

    if (this.variant === 'sineLine') {
      return this._hitTestSine(pts, pointer, viewport);
    }
    if (this._isCyclic) {
      return this._hitTestCyclic(pts, pointer, viewport);
    }

    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      best = Math.min(best, distanceToSegment(pointer, pts[i], pts[i + 1]));
    }
    return best;
  }

  private _hitTestSine(pts: ScreenPoint[], pointer: { x: number; y: number }, viewport: Viewport): number {
    const halfW = Math.abs(pts[1].x - pts[0].x);
    const amp = pts[1].y - pts[0].y;
    if (halfW < 2) return Infinity;
    let minDist = Infinity;
    let prevPt: ScreenPoint | null = null;
    const w = viewport.width - viewport.priceAxisWidth;
    for (let x = Math.max(0, pts[0].x - halfW * 10); x <= Math.min(w, pts[0].x + halfW * 10); x += 4) {
      const phase = ((x - pts[0].x) / halfW) * Math.PI;
      const y = pts[0].y + amp * Math.sin(phase);
      const curr = { x, y };
      if (prevPt) {
        minDist = Math.min(minDist, distanceToSegment(pointer, prevPt, curr));
      }
      prevPt = curr;
    }
    return minDist;
  }

  private _hitTestCyclic(pts: ScreenPoint[], pointer: { x: number; y: number }, viewport: Viewport): number {
    const spacing = Math.abs(pts[1].x - pts[0].x);
    const h = viewport.height - viewport.timeAxisHeight;
    if (spacing < 4) return Infinity;
    let minDist = Infinity;
    const w = viewport.width - viewport.priceAxisWidth;
    for (let x = pts[0].x; x <= w; x += spacing) {
      const d = Math.abs(pointer.x - x);
      if (d < minDist) minDist = d;
    }
    for (let x = pts[0].x - spacing; x >= 0; x -= spacing) {
      const d = Math.abs(pointer.x - x);
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
    if (!drawing.anchors.length) return;
    const pts = drawing.anchors.map((a) => dataToScreen(a, viewport));
    const color = drawing.options.color;
    const w = viewport.width - viewport.priceAxisWidth;
    const h = viewport.height - viewport.timeAxisHeight;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);

    if (this.variant === 'sineLine') {
      this._renderSine(ctx, pts, color, w);
    } else if (this._isCyclic) {
      this._renderCyclic(ctx, pts, color, w, h);
    } else {
      // Polygon fill
      if (pts.length >= 3) {
        ctx.globalAlpha = selected ? 0.1 : 0.05;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Polyline
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      // Elliott dashed connector (first → last)
      if (this._isElliott && pts.length >= 3) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        ctx.restore();
      }

      // Anchor labels
      const labels = ANCHOR_LABELS[this.variant] ?? [];
      for (let i = 0; i < Math.min(labels.length, pts.length); i++) {
        this._drawLabel(ctx, labels[i], pts[i], i > 0 ? pts[i - 1] : null, color, drawing.options.lineWidth);
      }
    }

    ctx.restore();
  }

  private _renderSine(ctx: CanvasRenderingContext2D, pts: ScreenPoint[], color: string, w: number): void {
    if (pts.length < 2) return;
    const halfW = Math.abs(pts[1].x - pts[0].x);
    const amp = pts[1].y - pts[0].y;
    if (halfW < 2) return;
    ctx.beginPath();
    let first = true;
    for (let x = Math.max(0, pts[0].x - halfW * 10); x <= Math.min(w, pts[0].x + halfW * 10); x += 2) {
      const phase = ((x - pts[0].x) / halfW) * Math.PI;
      const y = pts[0].y + amp * Math.sin(phase);
      if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  private _renderCyclic(ctx: CanvasRenderingContext2D, pts: ScreenPoint[], color: string, w: number, h: number): void {
    if (pts.length < 2) return;
    const spacing = Math.abs(pts[1].x - pts[0].x);
    if (spacing < 4) return;
    ctx.beginPath();
    for (let x = pts[0].x; x <= w; x += spacing) {
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    for (let x = pts[0].x - spacing; x >= 0; x -= spacing) {
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
    }
    ctx.stroke();
  }

  private _drawLabel(
    ctx: CanvasRenderingContext2D,
    label: string,
    pt: ScreenPoint,
    prev: ScreenPoint | null,
    color: string,
    lw: number,
  ): void {
    const isAbove = prev ? pt.y < prev.y : true;
    const offsetY = isAbove ? -14 : 18;
    ctx.save();
    ctx.font = `bold 10px sans-serif`;
    const m = ctx.measureText(label);
    const boxW = Math.max(16, m.width + 6);
    const boxH = 14;
    const bx = pt.x - boxW / 2;
    const by = pt.y + offsetY - boxH / 2;
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pt.x, pt.y + offsetY);
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
    if (!drawing.anchors.length) return null;
    const pts = drawing.anchors.map((a) => dataToScreen(a, viewport));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return {
      xRange: [Math.min(...xs), Math.max(...xs)],
      yRange: [Math.min(...ys), Math.max(...ys)],
    };
  }
}

// --- Exports ---

export class AbcdPatternTool extends PatternTool {
  constructor() { super('abcdPattern', 'ABCD Pattern'); }
}
export class XabcdPatternTool extends PatternTool {
  constructor() { super('xabcd', 'XABCD Pattern'); }
}
export class CypherPatternTool extends PatternTool {
  constructor() { super('cypherPattern', 'Cypher Pattern'); }
}
export class HeadAndShouldersTool extends PatternTool {
  constructor() { super('headAndShoulders', 'Head and Shoulders'); }
}
export class TrianglePatternTool extends PatternTool {
  constructor() { super('trianglePattern', 'Triangle Pattern'); }
}
export class ThreeDrivesTool extends PatternTool {
  constructor() { super('threeDrives', 'Three Drives'); }
}
export class ElliottImpulseTool extends PatternTool {
  constructor() { super('elliottImpulse', 'Elliott Impulse Wave'); }
}
export class ElliottCorrectionTool extends PatternTool {
  constructor() { super('elliottCorrection', 'Elliott Correction Wave'); }
}
export class ElliottTriangleTool extends PatternTool {
  constructor() { super('elliottTriangle', 'Elliott Triangle Wave'); }
}
export class ElliottDoubleComboTool extends PatternTool {
  constructor() { super('elliottDoubleCombo', 'Elliott Double Combo'); }
}
export class ElliottTripleComboTool extends PatternTool {
  constructor() { super('elliottTripleCombo', 'Elliott Triple Combo'); }
}
export class SineLineTool extends PatternTool {
  constructor() { super('sineLine', 'Sine Line'); }
}
export class CyclicLinesTool extends PatternTool {
  constructor() { super('cyclicLines', 'Cyclic Lines'); }
}
export class TimeCyclesTool extends PatternTool {
  constructor() { super('timeCycles', 'Time Cycles'); }
}
