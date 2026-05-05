/**
 * TV-Parity V2 — 500 comprehensive tests for "flagMark".
 * Rail: rail-text. 1-anchor click-commit. TV: flag-mark
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "flagMark",
  testId: "tool-flag-mark",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
