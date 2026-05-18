/**
 * TV-Parity 500 Tests — Gann Square Fixed (fib category)
 * 2-anchor drag-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "gannSquareFixed",
  testId: "tool-gannSquareFixed",
  railTestId: "rail-fib",
  anchorCount: 2,
  commitMode: "drag",
});
