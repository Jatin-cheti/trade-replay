/**
 * TV-Parity V2 — 500 comprehensive tests for "doubleCurve".
 * 2-anchor drag double Bezier curve.
 * Default color #2962ff. Rail: rail-brush  testId: tool-doubleCurve
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "doubleCurve",
  testId: "tool-doubleCurve",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
