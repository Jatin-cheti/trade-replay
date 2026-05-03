/**
 * TV-Parity 500 Tests — Gann Square (2-anchor drag, family='fib').
 * Rail: rail-fib.
 * Outer rectangle + both diagonals + 9 angular rays from (left,bottom) at slopes
 * 1/8, 1/4, 1/3, 1/2, 1/1, 2/1, 3/1, 4/1, 8/1 — each clamped to y≥top.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "gannSquare",
  testId: "gann-square",
  railTestId: "rail-fib",
  anchorCount: 2,
});
