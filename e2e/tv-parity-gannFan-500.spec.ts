/**
 * TV-Parity 500 Tests — Gann Fan (2-anchor drag, family='fib').
 * Rail: rail-fib.
 * 9 rays from anchor[0] using anchor[0]→anchor[1] as the 1/1 baseline.
 * Slope ratios: 1/8, 1/4, 1/3, 1/2, 1/1, 2/1, 3/1, 4/1, 8/1.
 * m≥1 → x-compressed (dx/m); m<1 → y-compressed (dy*m). Extended to canvas edge.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "gannFan",
  testId: "gann-fan",
  railTestId: "rail-fib",
  anchorCount: 2,
});
