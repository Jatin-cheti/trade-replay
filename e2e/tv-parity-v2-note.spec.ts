/**
 * TV-Parity V2 — 500 comprehensive tests for "note".
 * Rail: rail-text. 1-anchor click-commit. TV: price-note (note variant)
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "note",
  testId: "tool-note",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
