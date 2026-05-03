/**
 * TV-Parity 500 Tests — Fib Speed Resistance Fan (2-anchor drag, family='fib').
 * Rail: rail-fib. Levels: 0.382, 0.5, 0.618.
 * Rays from anchor[0] through fib-level points at bx column.
 * Main diagonal also extended. Labels at right edge.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibSpeedResistFan",
  testId: "fib-speed-resistance-fan",
  railTestId: "rail-fib",
  anchorCount: 2,
});
