/**
 * TV-Parity 500 Tests — Fib Time Zone (2-anchor drag, family='fib').
 * Rail: rail-fib. Indices: 0,1,2,3,5,8,13,21,34,55 (Fibonacci sequence).
 * Full-height vertical lines at ax + unit*idx where unit = bx - ax.
 * Indices 0 & 1 solid; rest dashed [3,3]. Labels at top.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibTimeZone",
  testId: "fib-time-zone",
  railTestId: "rail-fib",
  anchorCount: 2,
});
