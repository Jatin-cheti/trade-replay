/**
 * TV-Parity 500 Tests — CURVE tool
 *
 * 2-anchor drag — single bezier curve between anchors.
 * Rail: rail-brush
 * testId: tool-curveTool
 */

import { registerExtendedSuite } from "./tv-parity-extended-factory";

registerExtendedSuite({
  variant: "curveTool",
  testId: "tool-curveTool",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
