/**
 * TV-Parity 500 Tests — PRICE RANGE (Measurer) tool
 *
 * Behaviors captured from TradingView via tv-capture-forecasting-volume-measurers.spec.ts.
 *
 * Draw mechanics (TV parity):
 *   Drag to create a rectangle. The rectangle spans:
 *     X: time from anchor[0].time to anchor[1].time
 *     Y: price from anchor[0].price to anchor[1].price
 *   Label shown inside (top of rect): "+100.50 (2.45%) 5b"
 *     format: "<sign><delta_price> (<pct>%) <bars>b"
 *   TV default color: blue (#2962ff) with semi-transparent fill.
 *   TV keyboard shortcut: Alt+P
 *
 * Rail: rail-forecasting  (TV places measurers under Measure in the rail)
 * testId: tool-priceRange
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "priceRange",
  testId: "tool-priceRange",
  railTestId: "rail-forecasting",
  kind: "measurer",
  anchorCount: 2,
  commitMode: "drag",
});
