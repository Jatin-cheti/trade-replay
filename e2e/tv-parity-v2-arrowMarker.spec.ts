/**
 * TV-Parity V2 — 500 comprehensive tests for "arrowMarker".
 * 1-anchor single-click stamp. Small arrow icon at price/time point.
 * Default color #2962ff. Rail: rail-brush  testId: tool-arrowMarker
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "arrowMarker",
  testId: "tool-arrowMarker",
  railTestId: "rail-brush",
  kind: "arrowMark",
  anchorCount: 1,
  commitMode: "click",
});
