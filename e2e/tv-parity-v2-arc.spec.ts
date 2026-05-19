/**
 * TV-Parity V2 — 500 comprehensive tests for "arc".
 * 2-anchor drag arc shape (start/end define the chord, UI handles midpoint).
 * Default color #2962ff. Rail: rail-brush  testId: tool-arc
 */
import { registerV2ToolSuite } from "./tv-parity-v2-factory";

registerV2ToolSuite({
  variant: "arc",
  testId: "tool-arc",
  railTestId: "rail-brush",
  kind: "shape",
  anchorCount: 2,
  commitMode: "drag",
});
