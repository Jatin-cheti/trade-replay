/**
 * TV-Parity 500 Tests — Fib Circles (fib category)
 * 2-anchor drag-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibCircles",
  testId: "tool-fibCircles",
  railTestId: "rail-fib",
  anchorCount: 2,
  commitMode: "drag",
});
