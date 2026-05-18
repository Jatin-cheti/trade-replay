/**
 * TV-Parity 500 Tests — BAR PATTERN tool
 *
 * Behaviors captured from TradingView via tv-capture-forecasting-volume-measurers.spec.ts.
 *
 * Draw mechanics (TV parity):
 *   Drag from anchor[0] to anchor[1].
 *   Tool renders a candlestick bar preview between the two anchors,
 *   mirroring the OHLC bars from the source region.
 *   No fill — only bar wicks and bodies.
 *
 * Rail: rail-forecasting
 * testId: tool-barPattern
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "barPattern",
  testId: "tool-barPattern",
  railTestId: "rail-forecasting",
  kind: "barPattern",
  anchorCount: 2,
  commitMode: "drag",
});
