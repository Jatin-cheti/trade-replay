/**
 * TV-Parity 500 Tests — DATE AND PRICE RANGE (Measurer) tool
 *
 * Behaviors captured from TradingView via tv-capture-forecasting-volume-measurers.spec.ts.
 *
 * Draw mechanics (TV parity):
 *   Drag to create a rectangle spanning both a date range AND a price range.
 *   Label shown: "+100.50 (2.45%) 5b" — same as priceRange (combines both).
 *   This is the most information-dense measurer: it shows price change,
 *   percentage change, AND bar count simultaneously.
 *   TV default color: blue (#2962ff) with semi-transparent fill.
 *   The label appears at the top-left corner of the rectangle.
 *
 * Rail: rail-forecasting
 * testId: tool-dateAndPriceRange
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "dateAndPriceRange",
  testId: "tool-dateAndPriceRange",
  railTestId: "rail-forecasting",
  kind: "measurer",
  anchorCount: 2,
  commitMode: "drag",
});
