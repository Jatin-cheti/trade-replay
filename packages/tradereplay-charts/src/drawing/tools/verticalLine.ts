/**
 * VerticalLine tool — an infinite vertical line at a fixed bar time.
 *
 * TV parity:
 * - Single click to place (uses anchor[0].time, price is irrelevant)
 * - Extends full canvas height
 * - Time label on X-axis
 * - Hit test: within 6px horizontally
 */

import type { Drawing, DrawPoint, HandleDescriptor, DrawingOptions, Viewport, AxisHighlight } from '../types.ts';
import { DEFAULT_DRAWING_OPTIONS } from '../types.ts';
import { dataToScreen, applyLineStyle } from '../geometry.ts';

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class VerticalLineTool {
  readonly variant = 'vline' as const;
  readonly label = 'Vertical Line';
  readonly anchorCount = 1;
  readonly isPointOnly = false;

  createDraft(p1: DrawPoint, options: DrawingOptions): Drawing {
    const priceRange = 1000; // large enough
    return {
      id: makeId(),
      variant: this.variant,
      anchors: [
        { ...p1, price: p1.price + priceRange },
        { ...p1, price: p1.price - priceRange },
      ],
      options: { ...DEFAULT_DRAWING_OPTIONS, ...options },
      visible: true,
      locked: false,
      selected: false,
      zIndex: 20,
      renderOrder: Date.now(),
    };
  }

  updateDraft(draft: Drawing, pointer: DrawPoint): Drawing {
    // For vline, only the time matters
    const anchors = draft.anchors.map((a) => ({ ...a, time: pointer.time }));
    return { ...draft, anchors };
  }

  finalize(draft: Drawing): Drawing | null {
    return draft;
  }

  hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (!drawing.anchors[0]) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    return Math.abs(pointer.x - a.x);
  }

  getHandles(drawing: Drawing, viewport: Viewport): HandleDescriptor[] {
    const a = dataToScreen(drawing.anchors[0], viewport);
    const midY = (viewport.height - viewport.timeAxisHeight) / 2;
    return [
      { anchorIndex: 0, center: { x: a.x, y: midY }, radius: 5, active: false },
    ];
  }

  render(
    ctx: CanvasRenderingContext2D,
    drawing: Drawing,
    viewport: Viewport,
    selected: boolean,
    hovered: boolean,
  ): void {
    if (!drawing.anchors[0]) return;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const h = viewport.height - viewport.timeAxisHeight;

    ctx.save();

    if (selected || hovered) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = drawing.options.color;
      ctx.lineWidth = 9;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(a.x, 0);
      ctx.lineTo(a.x, h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = drawing.options.color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);
    ctx.beginPath();
    ctx.moveTo(a.x, 0);
    ctx.lineTo(a.x, h);
    ctx.stroke();

    ctx.restore();
  }

  renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.restore();
  }

  /**
   * VerticalLine axis-highlight: only bounds X (single time).
   * yRange is null because the line extends full canvas height.
   */
  getAxisHighlight(drawing: Drawing, viewport: Viewport): AxisHighlight | null {
    if (!drawing.anchors[0]) return null;
    const a = dataToScreen(drawing.anchors[0], viewport);
    return { xRange: [a.x, a.x], yRange: null };
  }
}
