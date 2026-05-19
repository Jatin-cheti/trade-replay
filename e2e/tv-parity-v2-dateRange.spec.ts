/**
 * TV-Parity V2 — 500 comprehensive tests for "dateRange".
 * 2-anchor drag-commit measurer. Shows bars/days count in a shaded rectangle.
 * Default color #2962ff.
 * Rail: Measure  testId: tool-dateRange
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "dateRange",
  testId: "tool-dateRange",
  railTestId: "rail-forecasting",
  kind: "measurer",
  anchorCount: 2,
  commitMode: "drag",
});
