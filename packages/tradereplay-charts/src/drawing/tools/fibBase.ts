/**
 * Shared TradingView Fibonacci/Gann rendering utilities and base tool.
 *
 * TV parity rules encoded here:
 *  - Per-level color palette (TV_FIB_COLORS) — exact hex values observed in
 *    TradingView's default Fib Retracement/Extension drawings.
 *  - `<ratio> (<price>)` left-aligned labels next to each level line.
 *  - Dashed grey diagonal connecting anchor[0] → anchor[1] (TV signature).
 *  - Filled bands between adjacent levels using the lower-edge color at
 *    fillAlpha = baseAlpha * 0.08 (matches TV's default level fill).
 *
 * Used by FibRetracementTool, FibExtensionTool, FibTrendTimeTool, etc.
 */

import type {
  Drawing,
  DrawPoint,
  DrawingOptions,
  Viewport,
  HandleDescriptor,
  AxisHighlight,
} from '../types.ts';
import { dataToScreen, drawCircleHandle } from '../geometry.ts';
import { BaseTool } from './base.ts';

/** TradingView Fibonacci-level color palette. Keys are level values as strings. */
export const TV_FIB_COLORS: Readonly<Record<string, string>> = Object.freeze({
  '0': '#787b86',
  '0.236': '#f23645',
  '0.382': '#ff9800',
  '0.5': '#fbc02d',
  '0.618': '#4caf50',
  '0.786': '#00bcd4',
  '1': '#787b86',
  '1.272': '#2962ff',
  '1.414': '#2962ff',
  '1.618': '#2962ff',
  '2': '#2962ff',
  '2.272': '#9c27b0',
  '2.414': '#9c27b0',
  '2.618': '#f23645',
  '3.618': '#9c27b0',
  '4.236': '#e91e63',
});

/** TV's default level set for Fib Retracement (and most fib tools). */
export const TV_DEFAULT_RETRACEMENT_LEVELS: readonly number[] = Object.freeze([
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236,
]);

/** TV's default level set for Trend-Based Fib Extension. */
export const TV_DEFAULT_EXTENSION_LEVELS: readonly number[] = Object.freeze([
  0, 0.382, 0.5, 0.618, 1, 1.272, 1.414, 1.618, 2, 2.618, 3.618, 4.236,
]);

/** Hex → "r, g, b" string for use in rgba(...) wrappers. */
export function rgbFromHex(hex: string): string {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h.split('').map((c) => c + c).join('')
      : h.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
}

/** Returns the TV color for a given level, or fallback to drawing color. */
export function colorForFibLevel(level: number, fallback: string): string {
  return TV_FIB_COLORS[String(level)] ?? fallback;
}

/** Format a fib label per TV's `<ratio> (<price>)` rules. */
export function formatFibLabel(
  level: number,
  price: number,
  mode: DrawingOptions['fibLabelMode'] = 'ratio-price',
): string {
  const priceStr = price.toFixed(2);
  if (mode === 'price') return `(${priceStr})`;
  if (mode === 'percent') return `${(level * 100).toFixed(1)}%`;
  if (mode === 'ratio') return `${level}`;
  return `${level} (${priceStr})`;
}

/** Resolve effective level set: explicit options > tool default. */
export function resolveLevels(
  options: DrawingOptions,
  toolDefault: readonly number[],
): readonly number[] {
  return options.fibLevels && options.fibLevels.length > 0 ? options.fibLevels : toolDefault;
}

/**
 * Shared Fib base tool: 2-anchor with TV-parity render of horizontal level
 * lines, fills, labels, and dashed diagonal.
 *
 * Subclasses may override `getDefaultLevels` to use a different canonical
 * level set (e.g., extension uses TV_DEFAULT_EXTENSION_LEVELS).
 */
export abstract class FibBaseTool extends BaseTool {
  readonly anchorCount = 2;

  protected getDefaultLevels(): readonly number[] {
    return TV_DEFAULT_RETRACEMENT_LEVELS;
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
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const width = right - left;
    const levels = resolveLevels(drawing.options, this.getDefaultLevels());
    const baseAlpha = drawing.options.opacity ?? 1;
    const fillAlpha = Math.max(0.04, baseAlpha * 0.08);
    const fallback = drawing.options.color;

    ctx.save();

    // 1) Fill bands between adjacent levels.
    for (let li = 0; li < levels.length - 1; li += 1) {
      const y1 = a.y + (b.y - a.y) * levels[li];
      const y2 = a.y + (b.y - a.y) * levels[li + 1];
      ctx.fillStyle = `rgba(${rgbFromHex(colorForFibLevel(levels[li], fallback))}, ${fillAlpha})`;
      ctx.fillRect(left, Math.min(y1, y2), width, Math.abs(y2 - y1));
    }

    // 2) Horizontal level lines + labels.
    const showLabel = drawing.options.priceLabel ?? true;
    const labelMode = drawing.options.fibLabelMode ?? 'ratio-price';
    const fontSize = Math.max(10, (drawing.options.textSize ?? 12) - 2);
    const fontFamily = drawing.options.font ?? 'JetBrains Mono';
    const fromAnchor = drawing.anchors[0];
    const toAnchor = drawing.anchors[1] ?? drawing.anchors[0];

    for (const level of levels) {
      const y = a.y + (b.y - a.y) * level;
      const lineColor = colorForFibLevel(level, fallback);
      ctx.strokeStyle = `rgba(${rgbFromHex(lineColor)}, ${baseAlpha})`;
      ctx.lineWidth = drawing.options.lineWidth + (selected || hovered ? 1 : 0);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();

      if (showLabel) {
        const value = fromAnchor.price + (toAnchor.price - fromAnchor.price) * level;
        const label = formatFibLabel(level, value, labelMode);
        ctx.font = `${fontSize}px ${fontFamily}, sans-serif`;
        ctx.fillStyle = `rgba(${rgbFromHex(lineColor)}, ${baseAlpha})`;
        ctx.textBaseline = 'middle';
        ctx.fillText(label, left + 6, y - 6);
      }
    }

    // 3) Dashed grey diagonal connecting anchor[0] → anchor[1].
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(120, 123, 134, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4) Selection halo at anchors.
    if (selected || hovered) {
      drawCircleHandle(ctx, a, 5, fallback, false);
      drawCircleHandle(ctx, b, 5, fallback, false);
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
    if (drawing.anchors.length < 2) return null;
    const a = dataToScreen(drawing.anchors[0], viewport);
    const b = dataToScreen(drawing.anchors[1], viewport);
    return {
      xRange: [Math.min(a.x, b.x), Math.max(a.x, b.x)],
      yRange: [Math.min(a.y, b.y), Math.max(a.y, b.y)],
    };
  }

  /** Helper exposed for tests: project a level onto canvas y given two anchors. */
  static levelToY(level: number, a: DrawPoint, b: DrawPoint, viewport: Viewport): number {
    const aS = dataToScreen(a, viewport);
    const bS = dataToScreen(b, viewport);
    return aS.y + (bS.y - aS.y) * level;
  }
}
