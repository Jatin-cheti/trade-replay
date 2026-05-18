/**
 * TV-Parity 500 Tests — DATE RANGE (Measurer) tool
 *
 * Behaviors captured from TradingView via tv-capture-forecasting-volume-measurers.spec.ts.
 *
 * Draw mechanics (TV parity):
 *   Drag to create a rectangle spanning a date range.
 *   Label shown: "<N> bars" — only bar count, no price delta.
 *   The rectangle spans the full visible price range vertically (TV behavior),
 *   or from anchor[0].price to anchor[1].price if drawn with a Y component.
 *   TV default color: blue (#2962ff) with semi-transparent fill.
 *
 * Rail: rail-forecasting
 * testId: tool-dateRange
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "dateRange",
  testId: "tool-dateRange",
  railTestId: "rail-forecasting",
  kind: "measurer",
  anchorCount: 2,
  commitMode: "drag",
});
