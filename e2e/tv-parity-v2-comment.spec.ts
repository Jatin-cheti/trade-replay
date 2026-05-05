/**
 * TV-Parity V2 — 500 comprehensive tests for "comment".
 * Rail: rail-text. 1-anchor click-commit. TV: comment
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "comment",
  testId: "tool-comment",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
