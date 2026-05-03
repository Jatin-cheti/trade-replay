/**
 * TV-Parity 500 Tests — Fib Channel (2-anchor drag, family='fib').
 * Rail: rail-fib. Levels: 0, 0.5, 1, 1.5, 2.
 * Parallel diagonal lines — each level shifts b.y by level*(b.y-a.y).
 * Levels 0 and 1 solid; others dashed [4,4]. Labels at right end.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibChannel",
  testId: "fib-channel",
  railTestId: "rail-fib",
  anchorCount: 2,
});
