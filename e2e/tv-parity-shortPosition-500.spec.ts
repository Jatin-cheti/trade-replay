/**
 * TV-Parity 500 Tests — SHORT POSITION tool
 *
 * Behaviors captured from TradingView via tv-capture-forecasting-volume-measurers.spec.ts.
 *
 * Draw mechanics (TV parity):
 *   1st click → entry anchor
 *   2nd click → target anchor (below entry for short)
 *   3rd click → stop anchor (above entry for short)
 * Red zone = entry→target, Green zone = entry→stop (for short — reversed from long)
 * Floating label: "Short RR 1.80x · T 80.00 / S 45.00"
 *
 * Rail: rail-forecasting
 * testId: tool-shortPosition
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "shortPosition",
  testId: "tool-shortPosition",
  railTestId: "rail-forecasting",
  kind: "position",
  anchorCount: 3,
  commitMode: "click-sequence",
});
