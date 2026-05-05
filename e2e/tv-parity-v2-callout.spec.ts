/**
 * TV-Parity V2 — 500 comprehensive tests for "callout".
 * Rail: rail-text. 1-anchor click-commit. TV: callout
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "callout",
  testId: "tool-callout",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
