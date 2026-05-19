/**
 * TV-Parity V2 — 500 comprehensive tests for "rectangle".
 * 2-anchor drag-commit rectangle with fill. TV shortcut Alt+R.
 * Default color #2962ff. Rail: rail-brush  testId: tool-rectangle
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "rectangle",
  testId: "tool-rectangle",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
