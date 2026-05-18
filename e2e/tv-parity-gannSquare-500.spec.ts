/**
 * TV-Parity 500 Tests — Gann Square (fib category)
 * 2-anchor drag-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "gannSquare",
  testId: "tool-gannSquare",
  railTestId: "rail-fib",
  anchorCount: 2,
  commitMode: "drag",
});
