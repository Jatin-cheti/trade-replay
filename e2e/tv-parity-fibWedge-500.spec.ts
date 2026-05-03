/**
 * TV-Parity 500 Tests — Fib Wedge (2-anchor drag, family='fib').
 * Rail: rail-fib. Levels: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.
 * Converging lines from anchor[0]; each ends at (left+width*level, ay+(by-ay)*level).
 * Both x and y are interpolated, producing a wedge (fan) shape.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibWedge",
  testId: "fib-wedge",
  railTestId: "rail-fib",
  anchorCount: 2,
});
