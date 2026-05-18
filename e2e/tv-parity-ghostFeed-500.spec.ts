/**
 * TV-Parity 500 Tests — GHOST FEED tool
 *
 * Behaviors captured from TradingView via tv-capture-forecasting-volume-measurers.spec.ts.
 *
 * Draw mechanics (TV parity):
 *   Drag from anchor[0] to anchor[1].
 *   Tool renders a dashed projected candlestick feed extending past anchor[1],
 *   semi-transparent ("ghost") appearance indicating a price projection.
 *   TV uses a dotted/dashed line with lower opacity than a normal drawing.
 *
 * Rail: rail-forecasting
 * testId: tool-ghostFeed
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "ghostFeed",
  testId: "tool-ghostFeed",
  railTestId: "rail-forecasting",
  kind: "ghostFeed",
  anchorCount: 2,
  commitMode: "drag",
});
