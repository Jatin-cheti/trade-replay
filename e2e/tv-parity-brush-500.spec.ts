/**
 * TV-Parity 500 Tests — BRUSH tool
 *
 * Behaviors captured from TradingView via tv-capture-brushes-arrows-shapes.spec.ts.
 * 500 = 100 geometry + 50 selection + 40 edge + 50 undo + 40 toolbar +
 *        30 multi + 30 delete + 30 drag-anchor + 30 escape + 100 brush-stroke.
 *
 * Draw mechanics (TV parity): mouse-down → drag → mouse-up commits a 2-anchor stroke.
 * Rail: rail-brush
 * testId: tool-brush
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "brush",
  testId: "tool-brush",
  railTestId: "rail-brush",
  kind: "brush",
  anchorCount: 2,
  commitMode: "drag",
});
