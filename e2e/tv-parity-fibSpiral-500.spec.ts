/**
 * TV-Parity 500 Tests — Fib Spiral (2-anchor drag, family='fib').
 * Rail: rail-fib. No discrete levels — renders a single logarithmic golden spiral.
 * r(θ) = r0 * φ^(θ/(π/2)), r0 = distancePx(a,b), φ = 1.618, 4 turns × 240 samples.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibSpiral",
  testId: "fib-spiral",
  railTestId: "rail-fib",
  anchorCount: 2,
});
