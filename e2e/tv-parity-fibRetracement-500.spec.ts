/**
 * TV-Parity 500 Tests — Fib Retracement (2-anchor drag, family='fib').
 * Rail: rail-fib. Levels: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236.
 * Horizontal level lines, per-level TV colors, filled bands, dashed grey diagonal.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibRetracement",
  testId: "fib-retracement",
  railTestId: "rail-fib",
  anchorCount: 2,
});
