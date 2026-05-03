/**
 * TV-Parity 500 Tests — Trend-based Fib Time (2-anchor drag, family='fib').
 * Rail: rail-fib. Levels: 0, 0.382, 0.618, 1, 1.382, 1.618, 2, 2.618.
 * Full-height vertical lines at ax + (bx-ax)*level; per-level TV colors.
 * Levels 0 & 1 solid, others dashed. Dashed grey a→b connector.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibTrendTime",
  testId: "fib-trend-time",
  railTestId: "rail-fib",
  anchorCount: 2,
});
