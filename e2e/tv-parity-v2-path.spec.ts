/**
 * TV-Parity V2 — 500 comprehensive tests for "path".
 * 2-anchor drag freehand path (anchors: 2 per toolRegistry).
 * Default color #2962ff. Rail: rail-brush  testId: tool-path
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "path",
  testId: "tool-path",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
