/**
 * TV-Parity 500 Tests — Pitchfan (3-anchor drag, family='fib').
 * Rail: rail-fib. Anchor auto-fill on drag (down→move→up commits all 3 anchors).
 * Median ray from p0 to mid(p1,p2) extended to edge; 2 outer parallel rays through
 * p1 and p2 with same direction vector; dashed grey reaction segment p1↔p2.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "pitchfan",
  testId: "pitchfan",
  railTestId: "rail-fib",
  anchorCount: 3,
});
