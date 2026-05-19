/**
 * TV-Parity V2 — 500 comprehensive tests for "polyline".
 * 2-anchor drag polyline (anchors: 2 per toolRegistry).
 * Default color #2962ff. Rail: rail-brush  testId: tool-polyline
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "polyline",
  testId: "tool-polyline",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
