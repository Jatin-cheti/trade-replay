/**
 * TV-Parity 500 Tests — Fib Retracement (fib category)
 * 2-anchor drag-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibRetracement",
  testId: "tool-fibRetracement",
  railTestId: "rail-fib",
  anchorCount: 2,
  commitMode: "drag",
});
