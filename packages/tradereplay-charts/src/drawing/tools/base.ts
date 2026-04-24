/**
 * BaseTool — abstract base class for all drawing tools.
 *
 * Provides shared utilities: ID generation, default rendering helpers,
 * and default hit-test for 2-anchor line tools.
 */

import type {
  Drawing,
  DrawPoint,
  DrawingVariant,
  DrawingOptions,
  HandleDescriptor,
  IDrawingTool,
  Viewport,
  AxisHighlight,
} from '../types.ts';
import { DEFAULT_DRAWING_OPTIONS } from '../types.ts';
import {
  dataToScreen,
  distanceToSegment,
  applyLineStyle,
  drawCircleHandle,
} from '../geometry.ts';

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function computeBounds(anchors: DrawPoint[]): Drawing['bounds'] {
  if (!anchors.length) return undefined;
  let minTime = Infinity, maxTime = -Infinity;
  let minPrice = Infinity, maxPrice = -Infinity;
  for (const a of anchors) {
    const t = Number(a.time);
    if (!Number.isFinite(t)) continue;
    minTime = Math.min(minTime, t);
    maxTime = Math.max(maxTime, t);
    minPrice = Math.min(minPrice, a.price);
    maxPrice = Math.max(maxPrice, a.price);
  }
  if (!Number.isFinite(minTime)) return undefined;
  return {
    minTime: minTime as DrawPoint['time'],
    maxTime: maxTime as DrawPoint['time'],
    minPrice,
    maxPrice,
  };
}

export abstract class BaseTool implements IDrawingTool {
  abstract readonly variant: DrawingVariant;
  abstract readonly label: string;
  abstract readonly anchorCount: number;
  readonly isPointOnly: boolean = false;

  createDraft(p1: DrawPoint, options: DrawingOptions): Drawing {
    const anchors: DrawPoint[] = Array.from({ length: this.anchorCount }, () => ({ ...p1 }));
    return this._makeDrawing(anchors, options);
  }

  updateDraft(draft: Drawing, pointer: DrawPoint): Drawing {
    const anchors = [...draft.anchors];
    anchors[1] = pointer;
    return { ...draft, anchors, bounds: computeBounds(anchors) };
  }

  finalize(draft: Drawing): Drawing | null {
    // Discard zero-length drawings (pointer didn't move)
    if (draft.anchors.length >= 2) {
      const [a, b] = draft.anchors;
      if (a.time === b.time && a.price === b.price) return null;
    }
    return { ...draft, bounds: computeBounds(draft.anchors) };
  }

  hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (drawing.anchors.length < 2) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    return distanceToSegment(pointer, a, b);
  }

  getHandles(drawing: Drawing, viewport: Viewport): HandleDescriptor[] {
    return drawing.anchors.map((anchor, index) => ({
      anchorIndex: index,
      center: dataToScreen(anchor, viewport),
      radius: 5,
      active: false,
    }));
  }

  /**
   * Default axis-highlight: covers the bounding box of the first two anchors.
   * Individual tools override this (HLine: yRange only; VLine: xRange only;
   * Ray/Trend with extend flags: expand to canvas edges).
   */
  getAxisHighlight(drawing: Drawing, viewport: Viewport): AxisHighlight | null {
    if (drawing.anchors.length < 2) return null;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    return {
      xRange: [Math.min(a.x, b.x), Math.max(a.x, b.x)],
      yRange: [Math.min(a.y, b.y), Math.max(a.y, b.y)],
    };
  }

  render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    viewport: Viewport,
    selected: boolean,
    hovered: boolean,
  ): void {
    if (drawing.anchors.length < 2) return;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);

    ctx.save();
    ctx.strokeStyle = drawing.options.color;
    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);

    // Selection highlight (slightly wider transparent stroke behind)
    if (selected || hovered) {
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 8;
      ctx.strokeStyle = drawing.options.color;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);
    ctx.strokeStyle = drawing.options.color;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    // Preview uses same render but with lowered opacity
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.restore();

    // Render anchor handle for first point
    if (draft.anchors.length >= 1) {
      const a = dataToScreen(draft.anchors[0], viewport);
      drawCircleHandle(ctx, a, 5, draft.options.color, false);
    }
  }

  protected _makeDrawing(anchors: DrawPoint[], options: DrawingOptions): Drawing {
    return {
      id: makeId(),
      variant: this.variant,
      anchors,
      options: { ...DEFAULT_DRAWING_OPTIONS, ...options },
      visible: true,
      locked: false,
      selected: false,
      bounds: computeBounds(anchors),
      zIndex: 20,
      renderOrder: Date.now(),
    };
  }
}
