/**
 * TV-Parity 500 Tests — Fib Channel (fib category)
 * 2-anchor drag-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibChannel",
  testId: "tool-fibChannel",
  railTestId: "rail-fib",
  anchorCount: 2,
  commitMode: "drag",
});
