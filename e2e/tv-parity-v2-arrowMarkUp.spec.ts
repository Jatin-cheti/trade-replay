/**
 * TV-Parity V2 — 500 comprehensive tests for "arrowMarkUp".
 * 1-anchor single-click upward arrow marker. Default color #089981 (green).
 * Rail: rail-brush  testId: tool-arrowMarkUp
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "arrowMarkUp",
  testId: "tool-arrowMarkUp",
  railTestId: "rail-brush",
  kind: "arrowMark",
  anchorCount: 1,
  commitMode: "click",
});
