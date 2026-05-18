/**
 * TV-Parity 500 Tests — Trend-based Fib Extension (fib category)
 * 2-anchor drag-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibExtension",
  testId: "tool-fibExtension",
  railTestId: "rail-fib",
  anchorCount: 2,
  commitMode: "drag",
});
