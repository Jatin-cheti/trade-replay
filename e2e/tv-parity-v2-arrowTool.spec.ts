/**
 * TV-Parity V2 — 500 comprehensive tests for "arrowTool" (Arrow).
 * 2-anchor drag-commit line with arrowhead at endpoint B.
 * Default color #2962ff. Rail: rail-brush  testId: tool-arrowTool
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "arrowTool",
  testId: "tool-arrowTool",
  railTestId: "rail-brush",
  kind: "arrowLine",
  anchorCount: 2,
  commitMode: "drag",
});
