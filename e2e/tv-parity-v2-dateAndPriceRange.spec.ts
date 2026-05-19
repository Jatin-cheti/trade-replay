/**
 * TV-Parity V2 — 500 comprehensive tests for "dateAndPriceRange".
 * 2-anchor drag-commit measurer. Shows both price delta and time span.
 * Default color #2962ff.
 * Rail: Measure  testId: tool-dateAndPriceRange
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "dateAndPriceRange",
  testId: "tool-dateAndPriceRange",
  railTestId: "rail-forecasting",
  kind: "measurer",
  anchorCount: 2,
  commitMode: "drag",
});
