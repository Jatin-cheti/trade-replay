/**
 * TV-Parity 500 Tests — Fib Circles (2-anchor drag, family='fib').
 * Rail: rail-fib. Levels: 0.382, 0.5, 0.618, 1, 1.618, 2.618.
 * Concentric full circles centered at anchor[0]; radius = distancePx(a,b)*level.
 * No-op when r=0. Dashed grey a→b connector.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibCircles",
  testId: "fib-circles",
  railTestId: "rail-fib",
  anchorCount: 2,
});
