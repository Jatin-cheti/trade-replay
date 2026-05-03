/**
 * TV-Parity 500 Tests — Gann Box (2-anchor drag, family='fib').
 * Rail: rail-fib. Levels: 0, 0.25, 0.382, 0.5, 0.618, 0.75, 1.
 * Bounding box with internal grid: horizontal lines at top+h*level and vertical
 * lines at left+w*level; both main diagonals; per-level TV Fibonacci colors.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "gannBox",
  testId: "gann-box",
  railTestId: "rail-fib",
  anchorCount: 2,
});
