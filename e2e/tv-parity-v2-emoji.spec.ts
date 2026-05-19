/**
 * TV-Parity V2 — 500 comprehensive tests for "emoji".
 * Single-click emoji icon marker placed on chart.
 * Default color #2962ff. Rail: rail-icon  testId: tool-emoji
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "emoji",
  testId: "tool-emoji",
  railTestId: "rail-icon",
  kind: "arrowMark",
  anchorCount: 1,
  commitMode: "click",
});
