/**
 * TV-Parity 500 Tests — Gann Box (fib category)
 * 2-anchor drag-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "gannBox",
  testId: "tool-gannBox",
  railTestId: "rail-fib",
  anchorCount: 2,
  commitMode: "drag",
});
