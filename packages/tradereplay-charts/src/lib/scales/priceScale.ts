/**
 * Per-pane price scale helpers.
 *
 * All functions operate in **canvas pixel coordinates** and are pane-aware:
 * they receive the pane's pixel origin (`paneTop`) and height (`paneH`) so
 * the same math works for any pane regardless of its position in the chart.
 *
 * Coordinate convention (matches HTML Canvas):
 *   - y = paneTop                → top of the pane  (highest price)
 *   - y = paneTop + paneH        → bottom of the pane (lowest price)
 */

import type { ScaleMargins } from '../createChart';

/**
 * Map a price value to a canvas Y coordinate within a pane.
 *
 * @param price    The price to convert.
 * @param min      Minimum visible price (corresponds to the pane bottom).
 * @param max      Maximum visible price (corresponds to the pane top).
 * @param paneTop  Canvas Y of the top edge of the pane.
 * @param paneH    Pixel height of the pane.
 */
export function priceToY(
  price: number,
  min: number,
  max: number,
  paneTop: number,
  paneH: number,
): number {
  const range = max - min || 1;
  return paneTop + paneH - ((price - min) / range) * paneH;
}

/**
 * Map a canvas Y coordinate within a pane back to a price value.
 *
 * @param y        Canvas Y coordinate.
 * @param min      Minimum visible price.
 * @param max      Maximum visible price.
 * @param paneTop  Canvas Y of the top edge of the pane.
 * @param paneH    Pixel height of the pane.
 */
export function yToPrice(
  y: number,
  min: number,
  max: number,
  paneTop: number,
  paneH: number,
): number {
  const range = max - min || 1;
  return min + ((paneTop + paneH - y) / paneH) * range;
}

/**
 * Map a price to a canvas Y coordinate using per-series scale margins.
 *
 * Used for overlay series that share a pane but have their own scale (e.g.
 * volume histogram with `scaleMargins: { top: 0.72, bottom: 0 }`).
 *
 * @param price         The price to convert.
 * @param min           Minimum visible price for this series' range.
 * @param max           Maximum visible price for this series' range.
 * @param scaleMargins  Fractional top/bottom margins within the pane.
 * @param paneTop       Canvas Y of the top edge of the pane.
 * @param paneH         Pixel height of the pane.
 */
export function sepPriceToY(
  price: number,
  min: number,
  max: number,
  scaleMargins: ScaleMargins,
  paneTop: number,
  paneH: number,
): number {
  const top = scaleMargins.top * paneH;
  const bottom = (1 - scaleMargins.bottom) * paneH;
  const rh = bottom - top || 1;
  const range = max - min || 1;
  return paneTop + bottom - ((price - min) / range) * rh;
}

/**
 * Inverse of `sepPriceToY`: canvas Y → price for an overlay series.
 *
 * @param y             Canvas Y coordinate.
 * @param min           Minimum visible price for this series' range.
 * @param max           Maximum visible price for this series' range.
 * @param scaleMargins  Fractional top/bottom margins within the pane.
 * @param paneTop       Canvas Y of the top edge of the pane.
 * @param paneH         Pixel height of the pane.
 */
export function sepYToPrice(
  y: number,
  min: number,
  max: number,
  scaleMargins: ScaleMargins,
  paneTop: number,
  paneH: number,
): number {
  const top = scaleMargins.top * paneH;
  const bottom = (1 - scaleMargins.bottom) * paneH;
  const rh = bottom - top || 1;
  const range = max - min || 1;
  const paneY = y - paneTop;
  return min + ((bottom - paneY) / rh) * range;
}
