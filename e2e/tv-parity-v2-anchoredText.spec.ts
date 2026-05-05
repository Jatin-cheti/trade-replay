/**
 * TV-Parity V2 — 500 comprehensive tests for "anchoredText".
 * Rail: rail-text. 1-anchor click-commit. TV: text-note
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "anchoredText",
  testId: "tool-anchored-text",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
