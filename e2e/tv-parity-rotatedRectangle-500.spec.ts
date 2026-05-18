/**
 * TV-Parity 500 Tests — ROTATED RECTANGLE shape
 *
 * 2-anchor drag — rectangle aligned to the drag vector (rotation derived).
 * Rail: rail-brush
 * testId: tool-rotatedRectangle
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "rotatedRectangle",
  testId: "tool-rotatedRectangle",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
