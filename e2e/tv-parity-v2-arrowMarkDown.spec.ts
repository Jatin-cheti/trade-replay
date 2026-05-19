/**
 * TV-Parity V2 — 500 comprehensive tests for "arrowMarkDown".
 * 1-anchor single-click downward arrow marker. Default color #f23645 (red).
 * Rail: rail-brush  testId: tool-arrowMarkDown
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "arrowMarkDown",
  testId: "tool-arrowMarkDown",
  railTestId: "rail-brush",
  kind: "arrowMark",
  anchorCount: 1,
  commitMode: "click",
});
