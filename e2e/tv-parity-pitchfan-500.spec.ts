/**
 * TV-Parity 500 Tests — Pitchfan (fib category)
 * 3-anchor tool — same commit pattern as pitchfork (drag commits, anchors auto-fill).
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "pitchfan",
  testId: "tool-pitchfan",
  railTestId: "rail-fib",
  anchorCount: 3,
});
