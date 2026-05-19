/**
 * TV-Parity V2 — 500 comprehensive tests for "rotatedRectangle".
 * 2-anchor drag-commit rectangle with rotation handle.
 * Default color #2962ff. Rail: rail-brush  testId: tool-rotatedRectangle
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "rotatedRectangle",
  testId: "tool-rotatedRectangle",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
