/**
 * HorizontalLine tool — an infinite horizontal line at a fixed price level.
 *
 * TV parity:
 * - Single click to place (uses anchor[0].price, time is irrelevant)
 * - Extends full canvas width
 * - Price label on Y-axis
 * - Hit test: within 6px vertically
 */

import type { Drawing, DrawPoint, HandleDescriptor, DrawingOptions, Viewport } from '../types.ts';
import { DEFAULT_DRAWING_OPTIONS } from '../types.ts';
import { dataToScreen, applyLineStyle, drawPriceLabel } from '../geometry.ts';

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class HorizontalLineTool {
  readonly variant = 'hline' as const;
  readonly label = 'Horizontal Line';
  readonly anchorCount = 1;
  readonly isPointOnly = false;

  createDraft(p1: DrawPoint, options: DrawingOptions): Drawing {
    return {
      id: makeId(),
      variant: this.variant,
      anchors: [{ ...p1 }, { ...p1, time: (Number(p1.time) + 86400) as DrawPoint['time'] }],
      options: { ...DEFAULT_DRAWING_OPTIONS, ...options },
      visible: true,
      locked: false,
      selected: false,
      zIndex: 20,
      renderOrder: Date.now(),
    };
  }

  updateDraft(draft: Drawing, pointer: DrawPoint): Drawing {
    // For hline, only the price matters; update anchor[0].price
    const anchors = draft.anchors.map((a) => ({ ...a, price: pointer.price }));
    return { ...draft, anchors };
  }

  finalize(draft: Drawing): Drawing | null {
    return draft;
  }

  hitTest(drawing: Drawing, pointer: { x: number; y: number }, viewport: Viewport): number {
    if (!drawing.anchors[0]) return Infinity;
    const a = dataToScreen(drawing.anchors[0], viewport);
    return Math.abs(pointer.y - a.y);
  }

  getHandles(drawing: Drawing, viewport: Viewport): HandleDescriptor[] {
    const a = dataToScreen(drawing.anchors[0], viewport);
    const midX = (viewport.width - viewport.priceAxisWidth) / 2;
    return [
      { anchorIndex: 0, center: { x: midX, y: a.y }, radius: 5, active: false },
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
    const w = viewport.width - viewport.priceAxisWidth;

    ctx.save();

    if (selected || hovered) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = drawing.options.color;
      ctx.lineWidth = 9;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, a.y);
      ctx.lineTo(w, a.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = drawing.options.color;
    ctx.lineWidth = drawing.options.lineWidth + (selected ? 1 : 0);
    applyLineStyle(ctx, drawing.options.lineStyle, drawing.options.lineWidth);
    ctx.beginPath();
    ctx.moveTo(0, a.y);
    ctx.lineTo(w, a.y);
    ctx.stroke();

    if (drawing.options.axisLabel) {
      drawPriceLabel(ctx, drawing.anchors[0].price, a.y, viewport.width, drawing.options.color, viewport.priceAxisWidth);
    }

    ctx.restore();
  }

  renderPreview(ctx: CanvasRenderingContext2D, draft: Drawing, viewport: Viewport): void {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this.render(ctx, draft, viewport, false, false);
    ctx.restore();
  }
}
