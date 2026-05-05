/**
 * TV-Parity V2 — 500 comprehensive tests for "signpost".
 * Rail: rail-text. 1-anchor click-commit. TV: signpost
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "signpost",
  testId: "tool-signpost",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
