/**
 * TV-Parity 500 Tests — Fib Spiral (fib category)
 * 2-anchor drag-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibSpiral",
  testId: "tool-fibSpiral",
  railTestId: "rail-fib",
  anchorCount: 2,
  commitMode: "drag",
});
