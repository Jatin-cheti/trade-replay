/**
 * Pane layout model for multi-pane charts.
 *
 * The chart canvas is divided into stacked horizontal panes sharing a single
 * time axis.  Each pane has its own price scale and can contain any number of
 * series.  A thin divider strip between panes acts as a visual separator and
 * a future resize handle.
 */

/** Opaque identifier for a pane. */
export type PaneId = string;

/** Pixel-level rectangle for a rendered pane (canvas coordinates). */
export interface PaneRect {
  /** Y offset from the top of the chart drawing area (excludes time axis). */
  top: number;
  /** Pixel height available to this pane for content (excludes divider). */
  h: number;
}

/** User-facing pane definition stored in chart state. */
export interface PaneDef {
  id: PaneId;
  /**
   * Relative height weight.  Panes share `totalH` proportionally.
   * A value of `1` means equal height to every other pane with `height: 1`.
   */
  height: number;
}

/** Height in pixels of the divider strip rendered between two adjacent panes. */
export const PANE_DIVIDER_H = 4;

/**
 * Compute pixel geometry for each pane.
 *
 * @param panes  Ordered array of pane definitions (main pane first).
 * @param totalH Total chart area height in pixels (i.e. `ch()`, excluding the
 *               time axis strip at the bottom).
 * @returns An array of `(PaneDef & PaneRect)` objects in the same order as
 *          `panes`, with `top` and `h` filled in.
 *
 * Invariant: `totalH === sum(rect.h) + (panes.length - 1) * PANE_DIVIDER_H`
 * (rounding errors of at most 1 pixel per pane may apply).
 */
export function computePaneLayout(
  panes: readonly PaneDef[],
  totalH: number,
): Array<PaneDef & PaneRect> {
  if (panes.length === 0) return [];

  const nDividers = panes.length - 1;
  const availH = Math.max(0, totalH - nDividers * PANE_DIVIDER_H);
  const totalWeight = panes.reduce((s, p) => s + Math.max(0, p.height), 0) || 1;

  const result: Array<PaneDef & PaneRect> = [];
  let y = 0;

  for (let i = 0; i < panes.length; i++) {
    const pane = panes[i];
    // Use Math.round so cumulative rounding stays within ±1px.
    const h = Math.round(availH * (Math.max(0, pane.height) / totalWeight));
    result.push({ ...pane, top: y, h });
    y += h + PANE_DIVIDER_H;
  }

  return result;
}
