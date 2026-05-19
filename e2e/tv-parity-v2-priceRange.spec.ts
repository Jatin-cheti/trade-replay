/**
 * TV-Parity V2 — 500 comprehensive tests for "priceRange".
 * 2-anchor drag-commit measurer. Shows price delta in a shaded rectangle.
 * Default color #2962ff. TV shortcut Alt+P.
 * Rail: Measure  testId: tool-priceRange
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "priceRange",
  testId: "tool-priceRange",
  railTestId: "rail-forecasting",
  kind: "measurer",
  anchorCount: 2,
  commitMode: "drag",
});
