/**
 * TV-Parity 500 Tests — TRIANGLE shape
 *
 * 2-anchor drag — anchors define base + apex of an isosceles triangle.
 * Rail: rail-brush
 * testId: tool-triangle
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "triangle",
  testId: "tool-triangle",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
