/**
 * TV-Parity V2 — 500 comprehensive tests for "ellipse".
 * 2-anchor drag-commit ellipse with fill.
 * Default color #2962ff. Rail: rail-brush  testId: tool-ellipse
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "ellipse",
  testId: "tool-ellipse",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
