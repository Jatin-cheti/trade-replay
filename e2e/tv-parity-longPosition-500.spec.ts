/**
 * TV-Parity 500 Tests — LONG POSITION tool
 *
 * Behaviors captured from TradingView via tv-capture-forecasting-volume-measurers.spec.ts.
 * 500 scenarios: geometry (100) + selection (50) + edge (40) + undo (50) +
 * toolbar (40) + multi (30) + delete (30) + drag-anchor (30) + escape (30) +
 * kind-specific rr-label/fill-zone (100) = 500
 *
 * Draw mechanics (TV parity):
 *   1st click → entry anchor (left vertical line)
 *   2nd click → target anchor (right column, target price)
 *   3rd click → stop anchor (right column, stop price)
 * Green zone = entry→target, Red zone = entry→stop (for long)
 * Floating label: "Long RR 2.50x · T 100.50 / S 50.25"
 *
 * Rail: rail-forecasting
 * testId: tool-longPosition  (legacy: tool-longPosition)
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "longPosition",
  testId: "tool-longPosition",
  railTestId: "rail-forecasting",
  kind: "position",
  anchorCount: 3,
  commitMode: "click-sequence",
});
