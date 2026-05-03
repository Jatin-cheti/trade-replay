/**
 * TV-Parity 500 Tests — Trend-based Fib Extension (2-anchor drag, family='fib').
 * Rail: rail-fib. Levels: 0, 0.382, 0.5, 0.618, 1, 1.272, 1.414, 1.618, 2, 2.618, 3.618, 4.236.
 * Same horizontal-level geometry as Fib Retracement with extension level set.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibExtension",
  testId: "fib-extension",
  railTestId: "rail-fib",
  anchorCount: 2,
});
