/**
 * TV-Parity V2 — 500 comprehensive tests for "image".
 * Rail: rail-text. 1-anchor click-commit. TV: image
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "image",
  testId: "tool-image",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
