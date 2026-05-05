/**
 * TV-Parity V2 — 500 comprehensive tests for "post".
 * Rail: rail-text. 1-anchor click-commit. TV: tweet-post
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "post",
  testId: "tool-post",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
