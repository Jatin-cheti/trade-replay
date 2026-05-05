/**
 * TV-Parity V2 — 500 comprehensive tests for "idea".
 * Rail: rail-text. 1-anchor click-commit. TV: idea
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "idea",
  testId: "tool-idea",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
