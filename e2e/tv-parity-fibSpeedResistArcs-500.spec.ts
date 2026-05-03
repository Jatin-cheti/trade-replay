/**
 * TV-Parity 500 Tests — Fib Speed Resistance Arcs (2-anchor drag, family='fib').
 * Rail: rail-fib. Levels: 0.382, 0.5, 0.618.
 * Semicircular arcs centered at anchor[0]; radius = distancePx(a,b)*level.
 * Arc spans [angle-π/2, angle+π/2] where angle = atan2(b-a). Dashed grey connector.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibSpeedResistArcs",
  testId: "fib-speed-resistance-arcs",
  railTestId: "rail-fib",
  anchorCount: 2,
});
