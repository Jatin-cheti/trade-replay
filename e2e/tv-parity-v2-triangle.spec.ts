/**
 * TV-Parity V2 — 500 comprehensive tests for "triangle".
 * 2-anchor drag triangle shape with fill (anchors: 2 per toolRegistry).
 * Default color #2962ff. Rail: rail-brush  testId: tool-triangle
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "triangle",
  testId: "tool-triangle",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
