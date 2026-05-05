/**
 * TV-Parity V2 — 500 comprehensive tests for "table".
 * Rail: rail-text. 1-anchor click-commit. TV: table
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "table",
  testId: "tool-table",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
