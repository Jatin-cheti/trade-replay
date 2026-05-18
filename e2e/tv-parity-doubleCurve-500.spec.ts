/**
 * TV-Parity 500 Tests — DOUBLE CURVE tool
 *
 * 2-anchor drag — S-shaped (two-segment) bezier curve.
 * Rail: rail-brush
 * testId: tool-doubleCurve
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "doubleCurve",
  testId: "tool-doubleCurve",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
