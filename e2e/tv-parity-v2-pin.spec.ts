/**
 * TV-Parity V2 — 500 comprehensive tests for "pin".
 * Rail: rail-text. 1-anchor click-commit. TV: pin
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "pin",
  testId: "tool-pin",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
