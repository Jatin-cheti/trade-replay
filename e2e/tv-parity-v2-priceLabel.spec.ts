/**
 * TV-Parity V2 — 500 comprehensive tests for "priceLabel".
 * Rail: rail-text. 1-anchor click-commit. TV: price-label
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "priceLabel",
  testId: "tool-price-label",
  railTestId: "rail-text",
  anchorCount: 1,
  commitMode: "click",
  selectionGeometry: "horizontal",
});
