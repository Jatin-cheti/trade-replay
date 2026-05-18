/**
 * TV-Parity 500 Tests — Fib Speed Resistance Arcs (fib category)
 * 2-anchor drag-commit drawing.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "fibSpeedResistArcs",
  testId: "tool-fibSpeedResistArcs",
  railTestId: "rail-fib",
  anchorCount: 2,
  commitMode: "drag",
});
