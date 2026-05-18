/**
 * TV-Parity 500 Tests — Trend-based Fib Time (fib category)
 * 2-anchor drag-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibTrendTime",
  testId: "tool-fibTrendTime",
  railTestId: "rail-fib",
  anchorCount: 2,
  commitMode: "drag",
});
