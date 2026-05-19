/**
 * TV-Parity V2 — 500 comprehensive tests for "curveTool" (Curve).
 * 2-anchor drag Bezier/spline curve.
 * Default color #2962ff. Rail: rail-brush  testId: tool-curveTool
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "curveTool",
  testId: "tool-curveTool",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
