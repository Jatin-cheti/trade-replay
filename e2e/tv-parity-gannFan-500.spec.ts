/**
 * TV-Parity 500 Tests — Gann Fan (fib category)
 * 2-anchor drag-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "gannFan",
  testId: "tool-gannFan",
  railTestId: "rail-fib",
  anchorCount: 2,
  commitMode: "drag",
});
