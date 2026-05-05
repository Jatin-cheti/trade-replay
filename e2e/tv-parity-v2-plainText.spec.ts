/**
 * TV-Parity V2 — 500 comprehensive tests for "plainText".
 * Rail: rail-text. 1-anchor click-commit. TV: text
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "plainText",
  testId: "tool-plain-text",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
