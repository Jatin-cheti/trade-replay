/**
 * TV-Parity V2 — 500 comprehensive tests for "brush".
 * Freehand stroke drawn by dragging. Multiple anchor points captured.
 * Default color #2962ff. Rail: rail-brush  testId: tool-brush
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "brush",
  testId: "tool-brush",
  railTestId: "rail-brush",
  kind: "brush",
  anchorCount: 2,
  commitMode: "drag",
});
