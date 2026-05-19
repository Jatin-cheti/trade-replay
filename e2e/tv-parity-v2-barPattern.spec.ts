/**
 * TV-Parity V2 — 500 comprehensive tests for "barPattern".
 * Drag-commit tool that copies a candlestick range and projects it forward.
 * Rail: rail-forecasting  testId: tool-barPattern
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "barPattern",
  testId: "tool-barPattern",
  railTestId: "rail-forecasting",
  kind: "barPattern",
  anchorCount: 2,
  commitMode: "drag",
});
