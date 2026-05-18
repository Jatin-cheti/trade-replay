/**
 * TV-Parity 500 Tests — ELLIPSE shape
 *
 * 2-anchor drag — anchors define ellipse bounding box.
 * Rail: rail-brush
 * testId: tool-ellipse
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "ellipse",
  testId: "tool-ellipse",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
