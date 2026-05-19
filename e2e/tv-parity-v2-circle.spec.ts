/**
 * TV-Parity V2 — 500 comprehensive tests for "circle".
 * 2-anchor drag-commit circle with fill.
 * Default color #2962ff. Rail: rail-brush  testId: tool-circle
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "circle",
  testId: "tool-circle",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
