/**
 * TV-Parity V2 — 500 comprehensive tests for "iconTool".
 * Single-click custom SVG icon marker placed on chart.
 * Default color #2962ff. Rail: rail-icon  testId: tool-iconTool
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "iconTool",
  testId: "tool-iconTool",
  railTestId: "rail-icon",
  kind: "arrowMark",
  anchorCount: 1,
  commitMode: "click",
});
