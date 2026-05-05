/**
 * TV-Parity V2 — 500 comprehensive tests for "priceNote".
 * Rail: rail-text. 1-anchor click-commit. TV: price-note
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "priceNote",
  testId: "tool-price-note",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
